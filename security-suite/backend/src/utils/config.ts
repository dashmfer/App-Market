import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SuiteConfig {
  server: {
    port: number;
    host: string;
  };
  paths: {
    contractPath: string;
    apiBasePath: string;
    reportsDir: string;
    pythonPath: string;
  };
  scanners: {
    staticAnalyzer: {
      enabled: boolean;
      severity: string[];
    };
    patternScanner: {
      enabled: boolean;
      customPatterns: boolean;
    };
    fuzzer: {
      enabled: boolean;
      maxTime: number;
      maxIterations: number;
    };
    anchorTests: {
      enabled: boolean;
      useBankrun: boolean;
    };
    apiTests: {
      enabled: boolean;
      baseUrl: string;
    };
  };
  reporting: {
    format: string[];
    includeCodeSnippets: boolean;
    includeFixes: boolean;
  };
  vulnerabilityCategories: string[];
}

export function loadConfig(): SuiteConfig {
  const configPath = path.join(__dirname, '../../../config/suite-config.json');

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.warn('Could not load config, using defaults');
    return getDefaultConfig();
  }
}

export function getDefaultConfig(): SuiteConfig {
  return {
    server: {
      port: 4000,
      host: 'localhost'
    },
    paths: {
      contractPath: '../programs/app-market/src/lib.rs',
      apiBasePath: '../app/api',
      reportsDir: './reports',
      pythonPath: 'python3'
    },
    scanners: {
      staticAnalyzer: {
        enabled: true,
        severity: ['critical', 'high', 'medium', 'low', 'info']
      },
      patternScanner: {
        enabled: true,
        customPatterns: true
      },
      fuzzer: {
        enabled: true,
        maxTime: 300,
        maxIterations: 100000
      },
      anchorTests: {
        enabled: true,
        useBankrun: true
      },
      apiTests: {
        enabled: true,
        baseUrl: 'http://localhost:3000'
      }
    },
    reporting: {
      format: ['pdf', 'json', 'html'],
      includeCodeSnippets: true,
      includeFixes: true
    },
    vulnerabilityCategories: [
      'account-validation',
      'arithmetic',
      'access-control',
      'economic-attacks',
      'reentrancy',
      'state-manipulation',
      'input-validation',
      'dos-attacks'
    ]
  };
}

export function resolveContractPath(config: SuiteConfig): string {
  const basePath = path.join(__dirname, '../../../');
  return path.resolve(basePath, config.paths.contractPath);
}

export function resolveApiPath(config: SuiteConfig): string {
  const basePath = path.join(__dirname, '../../../');
  return path.resolve(basePath, config.paths.apiBasePath);
}

export function resolveReportsPath(config: SuiteConfig): string {
  const basePath = path.join(__dirname, '../../../');
  return path.resolve(basePath, config.paths.reportsDir);
}
