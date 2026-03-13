// Vulnerability severity levels
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Vulnerability categories
export type VulnerabilityCategory =
  | 'account-validation'
  | 'arithmetic'
  | 'access-control'
  | 'economic-attacks'
  | 'reentrancy'
  | 'state-manipulation'
  | 'input-validation'
  | 'dos-attacks'
  | 'api-security'
  | 'authentication'
  | 'authorization';

// Individual vulnerability finding
export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: VulnerabilityCategory;
  location: {
    file: string;
    line?: number;
    endLine?: number;
    function?: string;
  };
  codeSnippet?: string;
  recommendation?: string;
  references?: string[];
  cwe?: string;
  exploitDifficulty?: 'easy' | 'medium' | 'hard';
  impactDescription?: string;
}

// Scanner result
export interface ScannerResult {
  scanner: string;
  timestamp: number;
  duration: number;
  status: 'success' | 'error' | 'partial';
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  metadata?: Record<string, any>;
  error?: string;
}

// Aggregated results
export interface AggregatedResults {
  timestamp: number;
  scanners: string[];
  totalVulnerabilities: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  categoryCounts: Record<VulnerabilityCategory, number>;
  allVulnerabilities: Vulnerability[];
  scannerResults: Record<string, ScannerResult>;
  riskScore: number;
  recommendations: string[];
}

// Test case for Anchor tests
export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: VulnerabilityCategory;
  severity: Severity;
  attackVector: string;
  expectedResult: 'should_fail' | 'should_succeed' | 'should_revert';
  run: () => Promise<TestResult>;
}

// Test result
export interface TestResult {
  testId: string;
  passed: boolean;
  vulnerabilityFound: boolean;
  message: string;
  error?: string;
  duration: number;
  details?: Record<string, any>;
}

// Fuzz target result
export interface FuzzResult {
  target: string;
  iterations: number;
  duration: number;
  crashes: FuzzCrash[];
  coverage: number;
}

export interface FuzzCrash {
  input: string;
  error: string;
  stackTrace?: string;
  timestamp: number;
}

// API test result
export interface APITestResult {
  endpoint: string;
  method: string;
  testName: string;
  passed: boolean;
  statusCode?: number;
  vulnerabilityFound: boolean;
  message: string;
  requestPayload?: any;
  response?: any;
  duration: number;
}

// Progress callback type
export type ProgressCallback = (progress: number, message: string) => void;
