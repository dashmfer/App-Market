import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SuiteConfig, resolveContractPath } from '../utils/config.js';
import { ScannerResult, Vulnerability, ProgressCallback, Severity, VulnerabilityCategory } from '../utils/types.js';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Solana/Anchor specific vulnerability patterns
interface VulnPattern {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: VulnerabilityCategory;
  check: (content: string, lines: string[]) => PatternMatch[];
  recommendation: string;
  cwe?: string;
}

interface PatternMatch {
  line: number;
  column?: number;
  snippet: string;
  function?: string;
  details?: string;
}

export class PatternScanner {
  private config: SuiteConfig;
  private contractPath: string;
  private patterns: VulnPattern[] = [];

  constructor(config: SuiteConfig) {
    this.config = config;
    this.contractPath = resolveContractPath(config);
    this.initializePatterns();
  }

  private initializePatterns() {
    this.patterns = [
      // 1. Missing has_one constraint
      {
        id: 'MISSING_HAS_ONE',
        name: 'Missing has_one Relationship Constraint',
        description: 'Account relationship not enforced with has_one constraint',
        severity: 'high',
        category: 'account-validation',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];
          const structRegex = /#\[derive\(Accounts\)\]\s*pub\s+struct\s+(\w+)[\s\S]*?\{([\s\S]*?)\n\}/g;

          let match;
          while ((match = structRegex.exec(content)) !== null) {
            const structName = match[1];
            const structBody = match[2];

            // Check if struct has seller, buyer, admin but no has_one
            const hasSellerField = /seller:\s*(?:Signer|AccountInfo|Account)/.test(structBody);
            const hasAdminField = /admin:\s*(?:Signer|AccountInfo|Account)/.test(structBody);
            const hasHasOne = /#\[account\([^)]*has_one/.test(structBody);

            if ((hasSellerField || hasAdminField) && !hasHasOne) {
              const lineNum = content.substring(0, match.index).split('\n').length;
              matches.push({
                line: lineNum,
                snippet: this.getContextLines(lines, lineNum, 5),
                function: structName,
                details: `Struct ${structName} has seller/admin fields without has_one constraint`
              });
            }
          }

          return matches;
        },
        recommendation: 'Add has_one constraints to verify account relationships',
        cwe: 'CWE-285'
      },

      // 2. Unsafe PDA derivation
      {
        id: 'UNSAFE_PDA_DERIVATION',
        name: 'Unsafe PDA Seed Derivation',
        description: 'PDA derived with potentially predictable or collision-prone seeds',
        severity: 'high',
        category: 'account-validation',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find simple seed patterns that may be vulnerable
          const seedRegex = /seeds\s*=\s*\[\s*b"(\w+)"\s*\]/g;
          let match;

          while ((match = seedRegex.exec(content)) !== null) {
            const seedValue = match[1];
            if (seedValue.length < 5 || /^(seed|pda|account)$/i.test(seedValue)) {
              const lineNum = content.substring(0, match.index).split('\n').length;
              matches.push({
                line: lineNum,
                snippet: this.getContextLines(lines, lineNum, 3),
                details: `Simple seed "${seedValue}" may cause collisions`
              });
            }
          }

          return matches;
        },
        recommendation: 'Use descriptive, unique seed prefixes with multiple components',
        cwe: 'CWE-330'
      },

      // 3. Missing lamport balance check before transfer
      {
        id: 'MISSING_BALANCE_CHECK',
        name: 'Transfer Without Balance Verification',
        description: 'SOL transfer without checking source has sufficient balance',
        severity: 'critical',
        category: 'economic-attacks',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find transfer operations
          const transferRegex = /\*\*\s*(\w+)\.to_account_info\(\)\.try_borrow_mut_lamports\(\)\?/g;
          let match;

          while ((match = transferRegex.exec(content)) !== null) {
            const accountName = match[1];
            const position = match.index;

            // Check if there's a balance check before this transfer (within 50 lines)
            const precedingContent = content.substring(Math.max(0, position - 2000), position);
            const hasBalanceCheck = /lamports\(\)\s*>=|lamports\(\)\s*>|\.lamports\(\)\.checked_sub/.test(precedingContent);

            if (!hasBalanceCheck) {
              const lineNum = content.substring(0, position).split('\n').length;
              matches.push({
                line: lineNum,
                snippet: this.getContextLines(lines, lineNum, 3),
                details: `Transfer from ${accountName} without balance verification`
              });
            }
          }

          return matches;
        },
        recommendation: 'Always verify account has sufficient lamports before transfer',
        cwe: 'CWE-20'
      },

      // 4. State change after CPI
      {
        id: 'STATE_AFTER_CPI',
        name: 'State Change After Cross-Program Invocation',
        description: 'State modified after CPI call may allow reentrancy',
        severity: 'high',
        category: 'reentrancy',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find CPI calls
          const cpiRegex = /invoke(?:_signed)?\s*\(\s*&/g;
          let match;

          while ((match = cpiRegex.exec(content)) !== null) {
            const position = match.index;
            const followingContent = content.substring(position, position + 500);

            // Check for state changes after CPI
            if (/\?;\s*\n\s*\w+\s*\.\s*\w+\s*=/.test(followingContent)) {
              const lineNum = content.substring(0, position).split('\n').length;
              matches.push({
                line: lineNum,
                snippet: this.getContextLines(lines, lineNum, 5),
                details: 'State modification detected after CPI call'
              });
            }
          }

          return matches;
        },
        recommendation: 'Update state before CPI calls (Checks-Effects-Interactions pattern)',
        cwe: 'CWE-841'
      },

      // 5. Unsafe unwrap usage
      {
        id: 'UNSAFE_UNWRAP',
        name: 'Unsafe unwrap() Usage',
        description: 'unwrap() can panic and halt program execution',
        severity: 'medium',
        category: 'input-validation',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          const unwrapRegex = /\.unwrap\(\)/g;
          let match;

          while ((match = unwrapRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            const line = lines[lineNum - 1] || '';

            // Skip if in test code or if has expect message
            if (!line.includes('#[test]') && !line.includes('.expect(')) {
              matches.push({
                line: lineNum,
                snippet: this.getContextLines(lines, lineNum, 2),
                details: 'unwrap() may panic on None/Err'
              });
            }
          }

          return matches;
        },
        recommendation: 'Use ok_or(), map_err(), or ? operator instead of unwrap()',
        cwe: 'CWE-248'
      },

      // 6. Missing rent exemption
      {
        id: 'MISSING_RENT_EXEMPT',
        name: 'Account Without Rent Exemption Check',
        description: 'Account may be purged if not rent-exempt',
        severity: 'medium',
        category: 'account-validation',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find init without rent_exempt
          const initRegex = /#\[account\(\s*init\s*,(?![^)]*rent_exempt)[^)]*\)/g;
          let match;

          while ((match = initRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            matches.push({
              line: lineNum,
              snippet: this.getContextLines(lines, lineNum, 3),
              details: 'Account initialization without rent exemption enforcement'
            });
          }

          return matches;
        },
        recommendation: 'Add rent_exempt = "enforce" to account initialization',
        cwe: 'CWE-400'
      },

      // 7. Missing authority verification in sensitive operations
      {
        id: 'MISSING_AUTHORITY_CHECK',
        name: 'Sensitive Operation Without Authority Check',
        description: 'Critical operation may be called by unauthorized users',
        severity: 'critical',
        category: 'access-control',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find sensitive functions
          const sensitivePatterns = [
            /fn\s+(withdraw|transfer|close|update_admin|set_fee|pause)/g,
            /fn\s+(\w*(?:admin|owner|auth)\w*)/gi
          ];

          for (const pattern of sensitivePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              const fnName = match[1];
              const fnStart = match.index;

              // Get function body (roughly)
              const fnContent = content.substring(fnStart, fnStart + 1000);

              // Check for authority verification
              const hasAuthCheck = /has_one\s*=\s*(?:admin|authority|owner)|\.admin\s*==|\.authority\s*==|Signer.*admin|constraint\s*=\s*.*admin/.test(fnContent);

              if (!hasAuthCheck) {
                const lineNum = content.substring(0, fnStart).split('\n').length;
                matches.push({
                  line: lineNum,
                  snippet: this.getContextLines(lines, lineNum, 3),
                  function: fnName,
                  details: `Sensitive function ${fnName} may lack authority verification`
                });
              }
            }
          }

          return matches;
        },
        recommendation: 'Add has_one = admin or explicit authority verification',
        cwe: 'CWE-862'
      },

      // 8. Duplicate withdrawal vulnerability
      {
        id: 'DUPLICATE_WITHDRAWAL',
        name: 'Potential Duplicate Withdrawal',
        description: 'Withdrawal may be claimed multiple times',
        severity: 'critical',
        category: 'economic-attacks',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find withdrawal functions
          const withdrawRegex = /fn\s+(withdraw|claim|redeem)\w*\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\s*\}/g;
          let match;

          while ((match = withdrawRegex.exec(content)) !== null) {
            const fnName = match[1];
            const fnBody = match[2];

            // Check if there's a claimed/processed flag
            const hasClaimedCheck = /claimed|processed|withdrawn|status\s*==|\.is_some\(\)/.test(fnBody);
            const marksAsClaimed = /claimed\s*=\s*true|status\s*=/.test(fnBody);

            if (!hasClaimedCheck || !marksAsClaimed) {
              const lineNum = content.substring(0, match.index).split('\n').length;
              matches.push({
                line: lineNum,
                snippet: this.getContextLines(lines, lineNum, 5),
                function: fnName,
                details: 'Withdrawal function may allow duplicate claims'
              });
            }
          }

          return matches;
        },
        recommendation: 'Mark withdrawals as claimed before transfer and verify claim status',
        cwe: 'CWE-367'
      },

      // 9. Unbounded data structure
      {
        id: 'UNBOUNDED_VEC',
        name: 'Unbounded Vector/Collection',
        description: 'Growing collections without limits can cause DoS',
        severity: 'medium',
        category: 'dos-attacks',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find Vec fields in structs
          const vecRegex = /pub\s+(\w+):\s*Vec<[^>]+>/g;
          let match;

          while ((match = vecRegex.exec(content)) !== null) {
            const fieldName = match[1];
            const position = match.index;

            // Check for MAX constant or capacity check
            const surroundingContent = content.substring(Math.max(0, position - 500), position + 500);
            const hasLimit = /MAX_|\.len\(\)\s*<|\.len\(\)\s*>=|capacity/.test(surroundingContent);

            if (!hasLimit) {
              const lineNum = content.substring(0, position).split('\n').length;
              matches.push({
                line: lineNum,
                snippet: this.getContextLines(lines, lineNum, 2),
                details: `Vector field ${fieldName} has no apparent size limit`
              });
            }
          }

          return matches;
        },
        recommendation: 'Add maximum size constraints to collections',
        cwe: 'CWE-400'
      },

      // 10. Price manipulation vulnerability
      {
        id: 'PRICE_MANIPULATION',
        name: 'Potential Price Manipulation',
        description: 'Price calculation may be manipulated through flash loans or sandwiching',
        severity: 'high',
        category: 'economic-attacks',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find price calculations
          const priceRegex = /(?:price|amount|value)\s*(?:=|:)\s*\w+\s*[\*\/]\s*\w+/gi;
          let match;

          while ((match = priceRegex.exec(content)) !== null) {
            const position = match.index;
            const surroundingContent = content.substring(Math.max(0, position - 500), position + 500);

            // Check for oracle or TWAP
            const hasOracleCheck = /oracle|pyth|switchboard|twap|time_weighted/i.test(surroundingContent);

            if (!hasOracleCheck) {
              const lineNum = content.substring(0, position).split('\n').length;
              matches.push({
                line: lineNum,
                snippet: this.getContextLines(lines, lineNum, 3),
                details: 'Price calculation without oracle/TWAP verification'
              });
            }
          }

          return matches;
        },
        recommendation: 'Use trusted price oracles with TWAP for price-sensitive operations',
        cwe: 'CWE-682'
      },

      // 11. Account data not zeroed on close
      {
        id: 'DATA_NOT_ZEROED',
        name: 'Account Data Not Zeroed on Close',
        description: 'Closed account data may be read by subsequent owner',
        severity: 'low',
        category: 'state-manipulation',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find close operations
          const closeRegex = /close\s*=\s*(\w+)/g;
          let match;

          while ((match = closeRegex.exec(content)) !== null) {
            const position = match.index;
            const surroundingContent = content.substring(Math.max(0, position - 200), position + 200);

            // Check if data is zeroed
            const dataZeroed = /\.data\.borrow_mut\(\)\.fill\(0\)|memset.*0/.test(surroundingContent);

            if (!dataZeroed) {
              const lineNum = content.substring(0, position).split('\n').length;
              matches.push({
                line: lineNum,
                snippet: this.getContextLines(lines, lineNum, 2),
                details: 'Account closed without zeroing data'
              });
            }
          }

          return matches;
        },
        recommendation: 'Zero account data before closing for sensitive data',
        cwe: 'CWE-212'
      },

      // 12. Missing instruction discriminator validation
      {
        id: 'MISSING_DISCRIMINATOR',
        name: 'Missing Account Discriminator Check',
        description: 'Account type not verified through discriminator',
        severity: 'high',
        category: 'account-validation',
        check: (content, lines) => {
          const matches: PatternMatch[] = [];

          // Find AccountInfo usage without Account wrapper
          const accountInfoRegex = /(\w+):\s*AccountInfo<'info>/g;
          let match;

          while ((match = accountInfoRegex.exec(content)) !== null) {
            const accountName = match[1];
            const position = match.index;

            // Skip system accounts
            if (/system_program|rent|clock|token_program/i.test(accountName)) {
              continue;
            }

            const lineNum = content.substring(0, position).split('\n').length;
            matches.push({
              line: lineNum,
              snippet: this.getContextLines(lines, lineNum, 2),
              details: `Raw AccountInfo ${accountName} without type validation`
            });
          }

          return matches;
        },
        recommendation: 'Use Account<T> wrapper or manually verify account discriminator',
        cwe: 'CWE-20'
      }
    ];
  }

  private getContextLines(lines: string[], lineNum: number, context: number): string {
    const start = Math.max(0, lineNum - context - 1);
    const end = Math.min(lines.length, lineNum + context);
    return lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
  }

  async run(onProgress: ProgressCallback): Promise<ScannerResult> {
    const startTime = Date.now();
    const vulnerabilities: Vulnerability[] = [];

    try {
      onProgress(10, 'Loading contract file...');
      const content = fs.readFileSync(this.contractPath, 'utf-8');
      const lines = content.split('\n');

      const totalPatterns = this.patterns.length;

      for (let i = 0; i < this.patterns.length; i++) {
        const pattern = this.patterns[i];
        const progress = 10 + Math.floor((i / totalPatterns) * 85);
        onProgress(progress, `Pattern check: ${pattern.name}`);

        const matches = pattern.check(content, lines);

        for (const match of matches) {
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
            impactDescription: match.details
          });
        }
      }

      onProgress(100, 'Pattern scanning complete');

      const summary = {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        medium: vulnerabilities.filter(v => v.severity === 'medium').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length,
        info: vulnerabilities.filter(v => v.severity === 'info').length
      };

      return {
        scanner: 'pattern-scanner',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        status: 'success',
        vulnerabilities,
        summary,
        metadata: {
          patternsChecked: this.patterns.length,
          contractLines: lines.length
        }
      };

    } catch (error: any) {
      return {
        scanner: 'pattern-scanner',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        status: 'error',
        vulnerabilities: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        error: error.message
      };
    }
  }
}
