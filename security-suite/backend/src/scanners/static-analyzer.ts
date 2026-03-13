import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SuiteConfig, resolveContractPath } from '../utils/config.js';
import { ScannerResult, Vulnerability, ProgressCallback, Severity, VulnerabilityCategory } from '../utils/types.js';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Pattern {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: VulnerabilityCategory;
  pattern: RegExp;
  recommendation: string;
  cwe?: string;
  multiline?: boolean;
  context?: number;
  negative?: RegExp; // Pattern that should NOT be present (indicates fix)
}

export class StaticAnalyzer {
  private config: SuiteConfig;
  private contractPath: string;
  private contractContent: string = '';
  private patterns: Pattern[] = [];

  constructor(config: SuiteConfig) {
    this.config = config;
    this.contractPath = resolveContractPath(config);
    this.initializePatterns();
  }

  private initializePatterns() {
    this.patterns = [
      // CRITICAL - Missing Signer Checks
      {
        id: 'MISSING_SIGNER_CHECK',
        name: 'Missing Signer Validation',
        description: 'Function accepts authority/admin without verifying signature',
        severity: 'critical',
        category: 'access-control',
        pattern: /pub\s+(\w+):\s*(?:Signer|AccountInfo)[^}]*(?!has_one|constraint)/gm,
        recommendation: 'Add #[account(signer)] or has_one constraint to verify signer',
        cwe: 'CWE-285'
      },

      // CRITICAL - Unchecked Arithmetic
      {
        id: 'UNCHECKED_ARITHMETIC',
        name: 'Potential Integer Overflow/Underflow',
        description: 'Arithmetic operation without checked_* methods or overflow protection',
        severity: 'critical',
        category: 'arithmetic',
        pattern: /(\w+)\s*[\+\-\*]\s*(\w+)(?!\s*\.checked_|\s*\.saturating_)/gm,
        negative: /checked_add|checked_sub|checked_mul|checked_div|saturating_/,
        recommendation: 'Use checked_add(), checked_sub(), checked_mul() or saturating_* methods',
        cwe: 'CWE-190'
      },

      // CRITICAL - Missing Owner Check
      {
        id: 'MISSING_OWNER_CHECK',
        name: 'Missing Account Owner Validation',
        description: 'Account used without verifying program ownership',
        severity: 'critical',
        category: 'account-validation',
        pattern: /AccountInfo<'info>(?![^}]*owner\s*=)/gm,
        recommendation: 'Add owner = program_id constraint or explicit owner check',
        cwe: 'CWE-284'
      },

      // HIGH - Arbitrary CPI
      {
        id: 'ARBITRARY_CPI',
        name: 'Potentially Unsafe Cross-Program Invocation',
        description: 'CPI call with user-provided program ID could allow arbitrary program execution',
        severity: 'high',
        category: 'reentrancy',
        pattern: /invoke(?:_signed)?\s*\(\s*&[^,]+,\s*(?:ctx\.accounts\.)?(\w+)/gm,
        recommendation: 'Validate the target program ID before CPI calls',
        cwe: 'CWE-749'
      },

      // HIGH - Missing Rent Exemption Check
      {
        id: 'MISSING_RENT_CHECK',
        name: 'Missing Rent Exemption Validation',
        description: 'Account initialization without rent exemption check',
        severity: 'high',
        category: 'account-validation',
        pattern: /init(?:_if_needed)?\s*,(?![^]]*rent_exempt)/gm,
        negative: /rent_exempt/,
        recommendation: 'Add rent_exempt = "enforce" to init constraints',
        cwe: 'CWE-400'
      },

      // HIGH - PDA Seed Collision
      {
        id: 'PDA_SEED_COLLISION',
        name: 'Potential PDA Seed Collision',
        description: 'PDA seeds may collide with other PDAs causing unauthorized access',
        severity: 'high',
        category: 'account-validation',
        pattern: /seeds\s*=\s*\[\s*b"(\w+)"\s*\]/gm,
        recommendation: 'Use unique, descriptive seed prefixes and include all relevant identifiers',
        cwe: 'CWE-327'
      },

      // HIGH - Fee Manipulation
      {
        id: 'FEE_MANIPULATION',
        name: 'Potential Fee Manipulation',
        description: 'Fee calculation may be manipulated through rounding or overflow',
        severity: 'high',
        category: 'economic-attacks',
        pattern: /(?:fee|commission|royalty)\s*[=:]\s*\w+\s*[\*\/]\s*\w+/gim,
        recommendation: 'Lock fees at transaction creation and use safe math',
        cwe: 'CWE-682'
      },

      // MEDIUM - Timestamp Dependence
      {
        id: 'TIMESTAMP_MANIPULATION',
        name: 'Timestamp Dependence',
        description: 'Using block timestamp for critical logic - can be slightly manipulated',
        severity: 'medium',
        category: 'state-manipulation',
        pattern: /Clock::get\(\)(?:\?)?\.unix_timestamp/gm,
        recommendation: 'Allow for small timestamp variations in time-critical logic',
        cwe: 'CWE-829'
      },

      // MEDIUM - Missing Zero Check
      {
        id: 'MISSING_ZERO_CHECK',
        name: 'Missing Zero Amount Check',
        description: 'Amount parameter not validated for zero value',
        severity: 'medium',
        category: 'input-validation',
        pattern: /amount:\s*u64(?![^}]*require!\s*\(\s*amount\s*>\s*0)/gm,
        recommendation: 'Add require!(amount > 0) validation',
        cwe: 'CWE-20'
      },

      // MEDIUM - Unbounded Iteration
      {
        id: 'UNBOUNDED_ITERATION',
        name: 'Unbounded Loop/Iteration',
        description: 'Loop without upper bound may cause DoS through gas exhaustion',
        severity: 'medium',
        category: 'dos-attacks',
        pattern: /for\s+\w+\s+in\s+(?:\w+\.)?(?:iter|into_iter)\s*\(\)/gm,
        negative: /\.take\(|\.iter\(\)\.enumerate\(\)|MAX_/,
        recommendation: 'Add maximum iteration bounds or use pagination',
        cwe: 'CWE-400'
      },

      // MEDIUM - Missing Bump Seed
      {
        id: 'MISSING_BUMP_SEED',
        name: 'Missing Bump Seed in PDA',
        description: 'PDA derivation without bump seed may fail on some valid PDAs',
        severity: 'medium',
        category: 'account-validation',
        pattern: /seeds\s*=\s*\[[^\]]+\](?![^}]*bump)/gm,
        recommendation: 'Include bump seed in PDA derivation',
        cwe: 'CWE-330'
      },

      // MEDIUM - Account Close Vulnerability
      {
        id: 'ACCOUNT_CLOSE_VULN',
        name: 'Account Close Without Proper Cleanup',
        description: 'Account closure may leave dangling references or allow rent extraction',
        severity: 'medium',
        category: 'state-manipulation',
        pattern: /close\s*=\s*(\w+)(?![^}]*has_one)/gm,
        recommendation: 'Verify account relationships before closing',
        cwe: 'CWE-672'
      },

      // LOW - Magic Numbers
      {
        id: 'MAGIC_NUMBERS',
        name: 'Magic Numbers in Code',
        description: 'Hardcoded numbers should be constants for clarity and maintenance',
        severity: 'low',
        category: 'input-validation',
        pattern: /(?:==|!=|>|<|>=|<=)\s*(\d{3,})/gm,
        recommendation: 'Replace magic numbers with named constants',
        cwe: 'CWE-547'
      },

      // LOW - Missing Event Emission
      {
        id: 'MISSING_EVENT',
        name: 'State Change Without Event',
        description: 'Important state changes should emit events for off-chain tracking',
        severity: 'low',
        category: 'state-manipulation',
        pattern: /(?:\.status\s*=|\.amount\s*=)(?![^;]*emit!)/gm,
        recommendation: 'Emit events for all significant state changes',
        cwe: 'CWE-778'
      },

      // INFO - TODO Comments
      {
        id: 'TODO_COMMENTS',
        name: 'TODO/FIXME Comments',
        description: 'Unresolved TODO or FIXME comments may indicate incomplete implementation',
        severity: 'info',
        category: 'input-validation',
        pattern: /\/\/\s*(TODO|FIXME|HACK|XXX):/gi,
        recommendation: 'Address all TODO/FIXME items before deployment',
        cwe: 'CWE-398'
      },

      // HIGH - Reentrancy in State Update
      {
        id: 'REENTRANCY_STATE',
        name: 'Potential Reentrancy - State After External Call',
        description: 'State updated after external call may allow reentrancy',
        severity: 'high',
        category: 'reentrancy',
        pattern: /transfer\s*\([\s\S]*?\)\?[\s\S]*?(\w+)\s*\.\s*(\w+)\s*=/gm,
        recommendation: 'Update state before making external calls (Checks-Effects-Interactions)',
        cwe: 'CWE-841'
      },

      // CRITICAL - Missing Escrow Balance Check
      {
        id: 'ESCROW_BALANCE_CHECK',
        name: 'Missing Escrow Balance Validation',
        description: 'Escrow operations without proper balance verification',
        severity: 'critical',
        category: 'economic-attacks',
        pattern: /escrow(?:_account)?\.lamports\(\)(?![^;]*>=)/gm,
        recommendation: 'Verify escrow has sufficient balance before transfers',
        cwe: 'CWE-20'
      },

      // HIGH - Missing Deadline Check
      {
        id: 'MISSING_DEADLINE',
        name: 'Missing Time Deadline Check',
        description: 'Time-sensitive operations without deadline validation',
        severity: 'high',
        category: 'state-manipulation',
        pattern: /auction_end|deadline|expiry(?![^}]*current_time|Clock::get)/gim,
        recommendation: 'Add proper timestamp comparison for time-sensitive operations',
        cwe: 'CWE-367'
      },

      // CRITICAL - Unauthorized Admin Action
      {
        id: 'UNAUTHORIZED_ADMIN',
        name: 'Potential Unauthorized Admin Access',
        description: 'Admin function without proper authority verification',
        severity: 'critical',
        category: 'access-control',
        pattern: /fn\s+(?:set_|update_|change_)(\w+)(?![^{]*has_one\s*=\s*admin)/gm,
        recommendation: 'Add has_one = admin constraint for admin functions',
        cwe: 'CWE-269'
      },

      // HIGH - Double Spend Risk
      {
        id: 'DOUBLE_SPEND',
        name: 'Potential Double Spend',
        description: 'Withdrawal or transfer without proper state marking',
        severity: 'high',
        category: 'economic-attacks',
        pattern: /transfer\s*\([^)]+\)(?![^;]*status\s*=|claimed\s*=)/gm,
        recommendation: 'Mark withdrawals as claimed/completed before transfer',
        cwe: 'CWE-367'
      }
    ];
  }

  async run(onProgress: ProgressCallback): Promise<ScannerResult> {
    const startTime = Date.now();
    const vulnerabilities: Vulnerability[] = [];

    try {
      // Load contract
      onProgress(10, 'Loading contract file...');
      this.contractContent = fs.readFileSync(this.contractPath, 'utf-8');

      const lines = this.contractContent.split('\n');
      const totalPatterns = this.patterns.length;

      // Run each pattern
      for (let i = 0; i < this.patterns.length; i++) {
        const pattern = this.patterns[i];
        const progress = 10 + Math.floor((i / totalPatterns) * 80);
        onProgress(progress, `Checking: ${pattern.name}`);

        const matches = this.findPatternMatches(pattern, lines);

        for (const match of matches) {
          // Skip if negative pattern is present (indicating fix)
          if (pattern.negative) {
            const lineContent = lines[match.line - 1] || '';
            const contextLines = lines.slice(Math.max(0, match.line - 5), match.line + 5).join('\n');
            if (pattern.negative.test(lineContent) || pattern.negative.test(contextLines)) {
              continue;
            }
          }

          vulnerabilities.push({
            id: `${pattern.id}-${uuidv4().slice(0, 8)}`,
            title: pattern.name,
            description: pattern.description,
            severity: pattern.severity,
            category: pattern.category,
            location: {
              file: this.contractPath,
              line: match.line,
              function: match.function
            },
            codeSnippet: match.snippet,
            recommendation: pattern.recommendation,
            cwe: pattern.cwe,
            exploitDifficulty: this.getExploitDifficulty(pattern.severity),
            impactDescription: this.getImpactDescription(pattern.category)
          });
        }
      }

      onProgress(95, 'Finalizing analysis...');

      // Calculate summary
      const summary = {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        medium: vulnerabilities.filter(v => v.severity === 'medium').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length,
        info: vulnerabilities.filter(v => v.severity === 'info').length
      };

      onProgress(100, 'Static analysis complete');

      return {
        scanner: 'static-analyzer',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        status: 'success',
        vulnerabilities,
        summary,
        metadata: {
          contractPath: this.contractPath,
          contractLines: lines.length,
          patternsChecked: this.patterns.length
        }
      };

    } catch (error: any) {
      return {
        scanner: 'static-analyzer',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        status: 'error',
        vulnerabilities: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        error: error.message
      };
    }
  }

  private findPatternMatches(pattern: Pattern, lines: string[]): Array<{ line: number; snippet: string; function: string }> {
    const matches: Array<{ line: number; snippet: string; function: string }> = [];
    const fullContent = lines.join('\n');

    let currentFunction = '';
    let match;

    // Track current function context
    const functionRegex = /(?:pub\s+)?fn\s+(\w+)/g;
    const functionLines: Map<number, string> = new Map();

    lines.forEach((line, idx) => {
      const fnMatch = /(?:pub\s+)?fn\s+(\w+)/.exec(line);
      if (fnMatch) {
        currentFunction = fnMatch[1];
      }
      functionLines.set(idx + 1, currentFunction);
    });

    // Reset regex
    pattern.pattern.lastIndex = 0;

    while ((match = pattern.pattern.exec(fullContent)) !== null) {
      const lineNumber = fullContent.substring(0, match.index).split('\n').length;
      const startLine = Math.max(0, lineNumber - 2);
      const endLine = Math.min(lines.length, lineNumber + 3);
      const snippet = lines.slice(startLine, endLine).map((l, i) => `${startLine + i + 1}: ${l}`).join('\n');

      matches.push({
        line: lineNumber,
        snippet,
        function: functionLines.get(lineNumber) || 'unknown'
      });
    }

    return matches;
  }

  private getExploitDifficulty(severity: Severity): 'easy' | 'medium' | 'hard' {
    switch (severity) {
      case 'critical': return 'easy';
      case 'high': return 'medium';
      default: return 'hard';
    }
  }

  private getImpactDescription(category: VulnerabilityCategory): string {
    const impacts: Record<VulnerabilityCategory, string> = {
      'account-validation': 'Unauthorized account access or manipulation',
      'arithmetic': 'Fund loss through overflow/underflow exploitation',
      'access-control': 'Privilege escalation or unauthorized actions',
      'economic-attacks': 'Financial loss or market manipulation',
      'reentrancy': 'Multiple execution leading to fund drainage',
      'state-manipulation': 'Corrupted state or inconsistent data',
      'input-validation': 'Unexpected behavior from malformed inputs',
      'dos-attacks': 'Service disruption or resource exhaustion',
      'api-security': 'Data exposure or unauthorized access',
      'authentication': 'Identity bypass or session hijacking',
      'authorization': 'Access to restricted resources'
    };

    return impacts[category] || 'Unknown impact';
  }

  getContractInfo(): any {
    try {
      const content = fs.readFileSync(this.contractPath, 'utf-8');
      const lines = content.split('\n');

      // Extract functions
      const functions = [...content.matchAll(/(?:pub\s+)?fn\s+(\w+)/g)].map(m => m[1]);

      // Extract structs
      const structs = [...content.matchAll(/pub\s+struct\s+(\w+)/g)].map(m => m[1]);

      // Extract errors
      const errors = [...content.matchAll(/#\[error_code\][\s\S]*?pub\s+enum\s+\w+\s*\{([\s\S]*?)\}/g)];

      return {
        path: this.contractPath,
        lines: lines.length,
        functions: functions.length,
        structs: structs.length,
        functionList: functions,
        structList: structs,
        hasAnchor: content.includes('#[program]'),
        programId: content.match(/declare_id!\s*\(\s*"([^"]+)"\s*\)/)?.[1] || 'unknown'
      };
    } catch (error) {
      return { error: 'Could not load contract info' };
    }
  }
}
