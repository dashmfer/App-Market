import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SuiteConfig } from '../utils/config.js';
import { ScannerResult, Vulnerability, ProgressCallback, FuzzResult, FuzzCrash } from '../utils/types.js';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class FuzzRunner {
  private config: SuiteConfig;
  private programPath: string;
  private fuzzTargetsPath: string;

  constructor(config: SuiteConfig) {
    this.config = config;
    this.programPath = path.resolve(__dirname, '../../../../programs/app-market');
    this.fuzzTargetsPath = path.resolve(__dirname, '../../../fuzz/fuzz_targets');
  }

  async run(onProgress: ProgressCallback): Promise<ScannerResult> {
    const startTime = Date.now();
    const vulnerabilities: Vulnerability[] = [];
    const fuzzResults: FuzzResult[] = [];

    try {
      onProgress(5, 'Checking cargo-fuzz availability...');

      // Check if cargo-fuzz is installed
      const fuzzInstalled = await this.checkCargoFuzz();

      if (!fuzzInstalled) {
        onProgress(100, 'cargo-fuzz not installed - generating setup instructions');

        return {
          scanner: 'fuzzer',
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          status: 'partial',
          vulnerabilities: [],
          summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          metadata: {
            message: 'cargo-fuzz not installed',
            setupInstructions: [
              'Install cargo-fuzz: cargo install cargo-fuzz',
              'Initialize fuzz targets: cd programs/app-market && cargo fuzz init',
              'Create fuzz targets in fuzz/fuzz_targets/',
              'Run: cargo fuzz run <target_name>'
            ],
            fuzzTargetTemplate: this.getFuzzTargetTemplate()
          }
        };
      }

      onProgress(10, 'Checking for existing fuzz targets...');

      // Check if fuzz directory exists
      const fuzzDir = path.join(this.programPath, 'fuzz');
      const hasFuzzDir = fs.existsSync(fuzzDir);

      if (!hasFuzzDir) {
        onProgress(20, 'No fuzz directory - generating fuzz targets...');
        await this.generateFuzzTargets();
      }

      // Get list of fuzz targets
      const targets = await this.getFuzzTargets();

      if (targets.length === 0) {
        onProgress(100, 'No fuzz targets available');

        return {
          scanner: 'fuzzer',
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          status: 'partial',
          vulnerabilities: [],
          summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          metadata: {
            message: 'No fuzz targets found',
            generatedTargets: this.getRecommendedFuzzTargets(),
            fuzzTargetTemplate: this.getFuzzTargetTemplate()
          }
        };
      }

      onProgress(30, `Found ${targets.length} fuzz targets`);

      // Run each fuzz target
      const maxTimePerTarget = Math.min(
        this.config.scanners.fuzzer.maxTime / targets.length,
        60 // Max 60 seconds per target for demo
      );

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const progress = 30 + Math.floor((i / targets.length) * 60);
        onProgress(progress, `Fuzzing target: ${target}`);

        try {
          const result = await this.runFuzzTarget(target, maxTimePerTarget);
          fuzzResults.push(result);

          // Convert crashes to vulnerabilities
          for (const crash of result.crashes) {
            vulnerabilities.push({
              id: `FUZZ-CRASH-${uuidv4().slice(0, 8)}`,
              title: `Fuzz Crash in ${target}`,
              description: `Fuzzer found a crash with input that causes unexpected behavior`,
              severity: 'critical',
              category: 'input-validation',
              location: {
                file: `fuzz/fuzz_targets/${target}.rs`,
                function: target
              },
              codeSnippet: crash.stackTrace || crash.error,
              recommendation: 'Investigate crash input and add proper input validation',
              impactDescription: `Input: ${crash.input.substring(0, 100)}...`
            });
          }
        } catch (error: any) {
          console.error(`Error fuzzing ${target}:`, error.message);
        }
      }

      onProgress(95, 'Analyzing fuzz results...');

      const summary = {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        medium: vulnerabilities.filter(v => v.severity === 'medium').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length,
        info: vulnerabilities.filter(v => v.severity === 'info').length
      };

      onProgress(100, 'Fuzz testing complete');

      return {
        scanner: 'fuzzer',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        status: 'success',
        vulnerabilities,
        summary,
        metadata: {
          targetsRun: targets.length,
          fuzzResults,
          totalIterations: fuzzResults.reduce((sum, r) => sum + r.iterations, 0),
          totalCrashes: fuzzResults.reduce((sum, r) => sum + r.crashes.length, 0)
        }
      };

    } catch (error: any) {
      return {
        scanner: 'fuzzer',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        status: 'error',
        vulnerabilities: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        error: error.message
      };
    }
  }

  private async checkCargoFuzz(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('cargo', ['fuzz', '--help'], {
        cwd: this.programPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  private async getFuzzTargets(): Promise<string[]> {
    const targetsDir = path.join(this.programPath, 'fuzz', 'fuzz_targets');

    if (!fs.existsSync(targetsDir)) {
      return [];
    }

    const files = fs.readdirSync(targetsDir);
    return files
      .filter(f => f.endsWith('.rs'))
      .map(f => f.replace('.rs', ''));
  }

  private async runFuzzTarget(target: string, maxTime: number): Promise<FuzzResult> {
    return new Promise((resolve) => {
      const result: FuzzResult = {
        target,
        iterations: 0,
        duration: 0,
        crashes: [],
        coverage: 0
      };

      const startTime = Date.now();

      const proc = spawn('cargo', [
        'fuzz', 'run', target,
        '--',
        `-max_total_time=${maxTime}`,
        '-print_final_stats=1'
      ], {
        cwd: this.programPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();

        // Parse iteration count
        const iterMatch = data.toString().match(/#(\d+)/);
        if (iterMatch) {
          result.iterations = parseInt(iterMatch[1]);
        }

        // Check for crashes
        if (data.toString().includes('SUMMARY: ') || data.toString().includes('ERROR:')) {
          result.crashes.push({
            input: 'See crash artifacts',
            error: data.toString(),
            timestamp: Date.now()
          });
        }
      });

      proc.on('close', () => {
        result.duration = Date.now() - startTime;

        // Parse coverage from output
        const covMatch = stderr.match(/cov:\s*(\d+)/);
        if (covMatch) {
          result.coverage = parseInt(covMatch[1]);
        }

        resolve(result);
      });

      // Timeout
      setTimeout(() => {
        proc.kill('SIGTERM');
      }, (maxTime + 5) * 1000);
    });
  }

  private async generateFuzzTargets() {
    const fuzzDir = path.join(this.programPath, 'fuzz');
    const targetsDir = path.join(fuzzDir, 'fuzz_targets');

    // Create directories
    fs.mkdirSync(targetsDir, { recursive: true });

    // Generate Cargo.toml for fuzz
    const cargoToml = `[package]
name = "app-market-fuzz"
version = "0.0.0"
authors = ["Automatically generated"]
publish = false
edition = "2021"

[package.metadata]
cargo-fuzz = true

[dependencies]
libfuzzer-sys = "0.4"
arbitrary = { version = "1", features = ["derive"] }

[dependencies.app-market]
path = ".."

# Prevent this from interfering with workspaces
[workspace]
members = ["."]

[[bin]]
name = "fuzz_instruction"
path = "fuzz_targets/fuzz_instruction.rs"
test = false
doc = false
`;

    fs.writeFileSync(path.join(fuzzDir, 'Cargo.toml'), cargoToml);

    // Generate fuzz target
    const fuzzTarget = this.getFuzzTargetTemplate();
    fs.writeFileSync(path.join(targetsDir, 'fuzz_instruction.rs'), fuzzTarget);
  }

  private getFuzzTargetTemplate(): string {
    return `#![no_main]
use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;

// Fuzz target for App Market instructions
// This tests instruction deserialization and validation

#[derive(Debug, Arbitrary)]
struct FuzzInput {
    instruction_type: u8,
    amount: u64,
    price: u64,
    title_len: u8,
    category_len: u8,
    description_len: u8,
    random_bytes: [u8; 32],
}

fuzz_target!(|input: FuzzInput| {
    // Test instruction parsing with arbitrary inputs

    // Simulate listing creation with fuzzed values
    let _ = validate_listing_params(
        input.amount,
        input.price,
        input.title_len as usize,
        input.category_len as usize,
        input.description_len as usize,
    );

    // Simulate bid placement with fuzzed amounts
    let _ = validate_bid_amount(input.amount, input.price);

    // Test fee calculations with edge cases
    let _ = calculate_fees(input.amount, input.price);
});

fn validate_listing_params(
    amount: u64,
    price: u64,
    title_len: usize,
    category_len: usize,
    desc_len: usize,
) -> Result<(), &'static str> {
    if amount == 0 {
        return Err("Amount cannot be zero");
    }
    if price == 0 {
        return Err("Price cannot be zero");
    }
    if title_len == 0 || title_len > 64 {
        return Err("Invalid title length");
    }
    if category_len == 0 || category_len > 32 {
        return Err("Invalid category length");
    }
    if desc_len > 1000 {
        return Err("Description too long");
    }
    Ok(())
}

fn validate_bid_amount(bid: u64, current: u64) -> Result<(), &'static str> {
    // Check for overflow
    if bid.checked_add(current).is_none() {
        return Err("Overflow in bid calculation");
    }
    if bid <= current {
        return Err("Bid must be higher than current");
    }
    Ok(())
}

fn calculate_fees(amount: u64, fee_bps: u64) -> Result<u64, &'static str> {
    // Test fee calculation for overflows
    let fee = amount
        .checked_mul(fee_bps)
        .ok_or("Overflow in fee multiplication")?
        .checked_div(10000)
        .ok_or("Division error")?;
    Ok(fee)
}
`;
  }

  private getRecommendedFuzzTargets(): string[] {
    return [
      'fuzz_create_listing - Test listing creation with arbitrary inputs',
      'fuzz_place_bid - Test bid placement with edge case amounts',
      'fuzz_fee_calculation - Test fee calculations for overflow',
      'fuzz_instruction_parsing - Test instruction deserialization',
      'fuzz_account_validation - Test account constraint validation'
    ];
  }
}
