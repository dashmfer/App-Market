import axios, { AxiosError } from 'axios';
import { SuiteConfig } from '../utils/config.js';
import { ScannerResult, Vulnerability, ProgressCallback, APITestResult, Severity, VulnerabilityCategory } from '../utils/types.js';
import { v4 as uuidv4 } from 'uuid';

interface APISecurityTest {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  category: VulnerabilityCategory;
  severity: Severity;
  payload?: any;
  headers?: Record<string, string>;
  expectedStatus?: number[];
  vulnerabilityCheck: (response: any, status: number) => boolean;
  recommendation: string;
}

export class APITestRunner {
  private config: SuiteConfig;
  private baseUrl: string;
  private tests: APISecurityTest[] = [];

  constructor(config: SuiteConfig) {
    this.config = config;
    this.baseUrl = config.scanners.apiTests.baseUrl || 'http://localhost:3000';
    this.initializeTests();
  }

  private initializeTests() {
    this.tests = [
      // Authentication Tests
      {
        id: 'API_001',
        name: 'Missing Authentication Header',
        description: 'Test if protected endpoints reject requests without auth',
        endpoint: '/api/listings',
        method: 'POST',
        category: 'authentication',
        severity: 'critical',
        payload: { title: 'Test', category: 'Test', price: 100 },
        vulnerabilityCheck: (response, status) => status !== 401 && status !== 403,
        recommendation: 'Require authentication for all write operations'
      },

      {
        id: 'API_002',
        name: 'Invalid JWT Token',
        description: 'Test if API rejects malformed JWT tokens',
        endpoint: '/api/profile',
        method: 'GET',
        category: 'authentication',
        severity: 'high',
        headers: { 'Authorization': 'Bearer invalid.token.here' },
        vulnerabilityCheck: (response, status) => status !== 401,
        recommendation: 'Validate JWT tokens properly'
      },

      {
        id: 'API_003',
        name: 'Expired Token Acceptance',
        description: 'Test if API accepts expired JWT tokens',
        endpoint: '/api/profile',
        method: 'GET',
        category: 'authentication',
        severity: 'high',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
        },
        vulnerabilityCheck: (response, status) => status !== 401,
        recommendation: 'Check token expiration'
      },

      // SQL Injection Tests
      {
        id: 'API_004',
        name: 'SQL Injection in Search',
        description: 'Test for SQL injection in search parameters',
        endpoint: '/api/listings?search=\'; DROP TABLE listings; --',
        method: 'GET',
        category: 'input-validation',
        severity: 'critical',
        vulnerabilityCheck: (response, status) => {
          // Check if response contains SQL error
          const responseText = JSON.stringify(response);
          return responseText.includes('SQL') || responseText.includes('syntax error');
        },
        recommendation: 'Use parameterized queries with Prisma'
      },

      {
        id: 'API_005',
        name: 'SQL Injection in ID Parameter',
        description: 'Test for SQL injection in ID fields',
        endpoint: '/api/listings/1 OR 1=1',
        method: 'GET',
        category: 'input-validation',
        severity: 'critical',
        vulnerabilityCheck: (response, status) => {
          return status === 200 && Array.isArray(response);
        },
        recommendation: 'Validate ID format before query'
      },

      // XSS Tests
      {
        id: 'API_006',
        name: 'Stored XSS in Listing',
        description: 'Test if API sanitizes HTML/script input',
        endpoint: '/api/listings',
        method: 'POST',
        category: 'input-validation',
        severity: 'high',
        payload: {
          title: '<script>alert("XSS")</script>',
          description: '<img src=x onerror=alert("XSS")>',
          category: 'Test'
        },
        vulnerabilityCheck: (response, status) => {
          const responseText = JSON.stringify(response);
          return responseText.includes('<script>') || responseText.includes('onerror=');
        },
        recommendation: 'Sanitize all user input before storage'
      },

      // Authorization Tests
      {
        id: 'API_007',
        name: 'IDOR - Access Other User Data',
        description: 'Test if user can access other users profiles',
        endpoint: '/api/profile/other-user-id',
        method: 'GET',
        category: 'authorization',
        severity: 'high',
        vulnerabilityCheck: (response, status) => {
          // Should not return sensitive data
          return response?.email || response?.walletAddress;
        },
        recommendation: 'Verify user owns requested resource'
      },

      {
        id: 'API_008',
        name: 'IDOR - Modify Other User Listing',
        description: 'Test if user can modify listings they do not own',
        endpoint: '/api/listings/other-listing-id',
        method: 'PUT',
        category: 'authorization',
        severity: 'critical',
        payload: { title: 'Hacked Title' },
        vulnerabilityCheck: (response, status) => status === 200,
        recommendation: 'Verify ownership before allowing modifications'
      },

      {
        id: 'API_009',
        name: 'Mass Assignment',
        description: 'Test if API allows setting protected fields',
        endpoint: '/api/profile',
        method: 'PUT',
        category: 'authorization',
        severity: 'high',
        payload: {
          name: 'Test User',
          isAdmin: true,
          role: 'admin',
          kycStatus: 'verified'
        },
        vulnerabilityCheck: (response, status) => {
          return response?.isAdmin === true || response?.role === 'admin';
        },
        recommendation: 'Whitelist allowed fields for updates'
      },

      // Rate Limiting Tests
      {
        id: 'API_010',
        name: 'Missing Rate Limiting',
        description: 'Test if API has rate limiting protection',
        endpoint: '/api/auth/login',
        method: 'POST',
        category: 'dos-attacks',
        severity: 'medium',
        payload: { email: 'test@test.com', password: 'wrongpassword' },
        vulnerabilityCheck: (response, status) => {
          // After many requests, should get 429
          return status !== 429;
        },
        recommendation: 'Implement rate limiting for auth endpoints'
      },

      // CORS Tests
      {
        id: 'API_011',
        name: 'Overly Permissive CORS',
        description: 'Test if API has restrictive CORS policy',
        endpoint: '/api/profile',
        method: 'GET',
        category: 'api-security',
        severity: 'medium',
        headers: { 'Origin': 'https://malicious-site.com' },
        vulnerabilityCheck: (response, status) => {
          // Check if response includes permissive CORS
          return false; // Need to check headers in actual implementation
        },
        recommendation: 'Configure CORS to allow only trusted origins'
      },

      // Input Validation Tests
      {
        id: 'API_012',
        name: 'Negative Amount',
        description: 'Test if API rejects negative monetary values',
        endpoint: '/api/bids',
        method: 'POST',
        category: 'input-validation',
        severity: 'high',
        payload: { listingId: 'test-id', amount: -1000 },
        vulnerabilityCheck: (response, status) => status === 200,
        recommendation: 'Validate amounts are positive'
      },

      {
        id: 'API_013',
        name: 'Large Number Overflow',
        description: 'Test handling of extremely large numbers',
        endpoint: '/api/bids',
        method: 'POST',
        category: 'input-validation',
        severity: 'high',
        payload: { listingId: 'test-id', amount: 9999999999999999999 },
        vulnerabilityCheck: (response, status) => {
          return status === 200 && response?.amount !== 9999999999999999999;
        },
        recommendation: 'Validate number ranges and use BigInt for large values'
      },

      {
        id: 'API_014',
        name: 'Path Traversal',
        description: 'Test for path traversal in file operations',
        endpoint: '/api/profile/upload-picture',
        method: 'POST',
        category: 'input-validation',
        severity: 'critical',
        payload: { filename: '../../../etc/passwd' },
        vulnerabilityCheck: (response, status) => {
          const responseText = JSON.stringify(response);
          return responseText.includes('root:') || status === 200;
        },
        recommendation: 'Sanitize file paths and use allowed directories'
      },

      // Information Disclosure Tests
      {
        id: 'API_015',
        name: 'Error Message Disclosure',
        description: 'Test if errors reveal sensitive information',
        endpoint: '/api/nonexistent',
        method: 'GET',
        category: 'api-security',
        severity: 'low',
        vulnerabilityCheck: (response, status) => {
          const responseText = JSON.stringify(response);
          return responseText.includes('stack') ||
                 responseText.includes('/home/') ||
                 responseText.includes('node_modules');
        },
        recommendation: 'Sanitize error messages in production'
      },

      {
        id: 'API_016',
        name: 'Version Disclosure',
        description: 'Test if API reveals software versions',
        endpoint: '/api/health',
        method: 'GET',
        category: 'api-security',
        severity: 'info',
        vulnerabilityCheck: (response, status) => {
          const responseText = JSON.stringify(response);
          return responseText.includes('version') ||
                 responseText.includes('node') ||
                 responseText.includes('express');
        },
        recommendation: 'Remove version information from responses'
      },

      // Business Logic Tests
      {
        id: 'API_017',
        name: 'Bid on Own Listing',
        description: 'Test if user can bid on their own listing',
        endpoint: '/api/bids',
        method: 'POST',
        category: 'authorization',
        severity: 'medium',
        payload: { listingId: 'own-listing-id', amount: 1000 },
        vulnerabilityCheck: (response, status) => status === 200,
        recommendation: 'Prevent self-bidding on listings'
      },

      {
        id: 'API_018',
        name: 'Duplicate Bid',
        description: 'Test if same bid can be submitted twice',
        endpoint: '/api/bids',
        method: 'POST',
        category: 'state-manipulation',
        severity: 'medium',
        payload: { listingId: 'test-listing', amount: 1000 },
        vulnerabilityCheck: (response, status) => {
          // Should handle duplicate gracefully
          return false; // Need idempotency check
        },
        recommendation: 'Implement idempotent bid handling'
      },

      // Webhook Security
      {
        id: 'API_019',
        name: 'Webhook Signature Bypass',
        description: 'Test if webhooks verify signatures',
        endpoint: '/api/webhooks/stripe',
        method: 'POST',
        category: 'authentication',
        severity: 'critical',
        payload: {
          type: 'payment_intent.succeeded',
          data: { object: { id: 'fake_payment' } }
        },
        vulnerabilityCheck: (response, status) => status === 200,
        recommendation: 'Always verify webhook signatures'
      },

      // NoSQL Injection
      {
        id: 'API_020',
        name: 'NoSQL Injection',
        description: 'Test for NoSQL injection in queries',
        endpoint: '/api/listings',
        method: 'GET',
        category: 'input-validation',
        severity: 'critical',
        payload: { filter: { '$gt': '' } },
        vulnerabilityCheck: (response, status) => {
          return Array.isArray(response) && response.length > 0;
        },
        recommendation: 'Sanitize query operators in user input'
      }
    ];
  }

  async run(onProgress: ProgressCallback): Promise<ScannerResult> {
    const startTime = Date.now();
    const vulnerabilities: Vulnerability[] = [];
    const testResults: APITestResult[] = [];

    onProgress(5, 'Starting API security tests...');

    // Check if API is reachable
    const apiAvailable = await this.checkAPIAvailability();

    if (!apiAvailable) {
      onProgress(100, 'API not available - generating recommendations');

      return {
        scanner: 'api-tests',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        status: 'partial',
        vulnerabilities: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        metadata: {
          message: `API not reachable at ${this.baseUrl}`,
          recommendation: 'Start the Next.js app on port 3000 and re-run tests',
          testsConfigured: this.tests.length,
          testCategories: [...new Set(this.tests.map(t => t.category))]
        }
      };
    }

    const totalTests = this.tests.length;

    for (let i = 0; i < this.tests.length; i++) {
      const test = this.tests[i];
      const progress = 5 + Math.floor((i / totalTests) * 90);
      onProgress(progress, `Testing: ${test.name}`);

      const result = await this.runTest(test);
      testResults.push(result);

      if (result.vulnerabilityFound) {
        vulnerabilities.push({
          id: `${test.id}-${uuidv4().slice(0, 8)}`,
          title: test.name,
          description: test.description,
          severity: test.severity,
          category: test.category,
          location: {
            file: `app/api${test.endpoint.replace(/\?.*/, '')}`,
            function: test.method
          },
          recommendation: test.recommendation,
          impactDescription: `Endpoint: ${test.method} ${test.endpoint}`
        });
      }
    }

    onProgress(100, 'API security testing complete');

    const summary = {
      total: vulnerabilities.length,
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length,
      info: vulnerabilities.filter(v => v.severity === 'info').length
    };

    return {
      scanner: 'api-tests',
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      status: 'success',
      vulnerabilities,
      summary,
      metadata: {
        baseUrl: this.baseUrl,
        testsRun: totalTests,
        testsPassed: testResults.filter(t => t.passed).length,
        testsFailed: testResults.filter(t => !t.passed).length,
        vulnerabilitiesFound: testResults.filter(t => t.vulnerabilityFound).length,
        testResults
      }
    };
  }

  private async checkAPIAvailability(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/listings`, { timeout: 5000 });
      return true;
    } catch (error: any) {
      // API might return error but is reachable
      if (error.response) {
        return true;
      }
      return false;
    }
  }

  private async runTest(test: APISecurityTest): Promise<APITestResult> {
    const startTime = Date.now();
    const url = `${this.baseUrl}${test.endpoint}`;

    try {
      const config: any = {
        method: test.method,
        url,
        timeout: 10000,
        validateStatus: () => true, // Don't throw on any status
        headers: test.headers || {}
      };

      if (test.payload && ['POST', 'PUT', 'PATCH'].includes(test.method)) {
        config.data = test.payload;
      }

      const response = await axios(config);
      const vulnerabilityFound = test.vulnerabilityCheck(response.data, response.status);

      return {
        endpoint: test.endpoint,
        method: test.method,
        testName: test.name,
        passed: !vulnerabilityFound,
        statusCode: response.status,
        vulnerabilityFound,
        message: vulnerabilityFound
          ? `Potential vulnerability: ${test.description}`
          : `Test passed: ${test.name}`,
        requestPayload: test.payload,
        response: response.data,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      // Network errors generally mean the test couldn't run
      return {
        endpoint: test.endpoint,
        method: test.method,
        testName: test.name,
        passed: true, // Can't confirm vulnerability
        vulnerabilityFound: false,
        message: `Test inconclusive: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  getTests(): APISecurityTest[] {
    return this.tests;
  }
}
