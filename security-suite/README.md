# Solana Security Testing Suite

A comprehensive security testing suite for Solana smart contracts with a unified dashboard interface.

## Features

### 5 Integrated Security Testing Components

1. **Static Analyzer** - Pattern-based analysis detecting 20+ vulnerability types
2. **Pattern Scanner** - Solana/Anchor-specific vulnerability patterns (12 detectors)
3. **Attack Test Suite** - 20+ attack scenarios (Anchor/TypeScript based)
4. **API Security Tests** - 20 endpoint security tests
5. **Fuzzer Integration** - cargo-fuzz for crash discovery

### Unified Dashboard (Port 4000)

- Real-time scanning progress via WebSocket
- Severity-based vulnerability cards (Critical/High/Medium/Low/Info)
- Risk score calculation
- PDF report generation
- Interactive vulnerability details

## Quick Start

### Prerequisites

```bash
# Node.js 18+
node --version

# Python 3.8+
python3 --version

# Optional: cargo-fuzz for fuzzing
cargo install cargo-fuzz
```

### Installation

```bash
cd security-suite
npm install
```

### Running the Suite

```bash
# Start the dashboard server (Port 4000)
npm run dev

# Open in browser
open http://localhost:4000
```

### Available Commands

```bash
# Run all tests from CLI
npm run test:all

# Run individual scanners
npm run test:static    # Python static analyzer
npm run test:anchor    # Anchor attack tests
npm run test:api       # API security tests
npm run test:fuzz      # Cargo fuzz tests

# Generate PDF report
npm run report
```

## Dashboard Usage

1. **Run All Scans** - Click "Run All Scans" to execute all scanners sequentially
2. **Run Selected** - Select a scanner from sidebar and click "Run Selected"
3. **View Results** - Click on any finding to see full details
4. **Download Report** - Generate and download a PDF report
5. **Filter** - Filter findings by severity using the filter buttons

## Vulnerability Categories

| Category | Description |
|----------|-------------|
| account-validation | Missing signer, owner, PDA checks |
| arithmetic | Integer overflow/underflow |
| access-control | Missing admin/authority checks |
| economic-attacks | Fee manipulation, double spend |
| reentrancy | Unsafe external calls |
| state-manipulation | Invalid state transitions |
| input-validation | Missing input validation |
| dos-attacks | Denial of service vectors |
| api-security | Endpoint vulnerabilities |
| authentication | Auth bypass issues |
| authorization | Access control bypass |

## Attack Test Scenarios

The suite includes 20+ attack scenarios testing:

- Unauthorized admin access
- Fake PDA injection
- Integer overflow on bids
- Double withdrawal
- Front-running/sniping
- Fee manipulation
- Timelock bypass
- Dispute griefing
- And more...

## Python Detectors

6 Python-based detector modules:

1. `account_validation.py` - Account/PDA checks
2. `arithmetic_issues.py` - Math safety
3. `access_control.py` - Permission checks
4. `economic_attacks.py` - Fund safety
5. `input_validation.py` - Input sanitization
6. `state_manipulation.py` - State machine safety

Run manually:
```bash
python3 detectors/run_all.py
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/status | GET | Current status and results |
| /api/scan/all | POST | Run all scanners |
| /api/scan/:scanner | POST | Run specific scanner |
| /api/results | GET | Get aggregated results |
| /api/results/:scanner | GET | Get scanner-specific results |
| /api/report/pdf | GET | Download PDF report |
| /api/report/json | GET | Get JSON report |
| /api/clear | POST | Clear all results |

## Configuration

Edit `config/suite-config.json`:

```json
{
  "server": {
    "port": 4000
  },
  "paths": {
    "contractPath": "../programs/app-market/src/lib.rs",
    "apiBasePath": "../app/api"
  },
  "scanners": {
    "staticAnalyzer": { "enabled": true },
    "patternScanner": { "enabled": true },
    "fuzzer": { "enabled": true, "maxTime": 300 },
    "anchorTests": { "enabled": true },
    "apiTests": { "enabled": true, "baseUrl": "http://localhost:3000" }
  }
}
```

## Output

### Risk Score

Calculated as:
- Critical: 40 points each
- High: 25 points each
- Medium: 10 points each
- Low: 3 points each
- Info: 1 point each

Score capped at 100.

### PDF Report Includes

- Executive summary
- Risk score visualization
- Severity breakdown
- Detailed findings with code snippets
- Category analysis
- Recommendations

## Extending the Suite

### Adding Custom Detectors

1. Create new file in `detectors/` inheriting from `BaseDetector`
2. Implement `detect()` method returning findings
3. Import and add to `run_all.py`

### Adding Attack Scenarios

1. Add to `attackScenarios` array in `anchor-test-runner.ts`
2. Include: id, name, description, category, severity, testCode

### Adding API Tests

1. Add to `tests` array in `api-test-runner.ts`
2. Include: endpoint, method, vulnerabilityCheck function

## Security Notes

- This tool is for **authorized security testing only**
- Results should be verified manually
- Some findings may be false positives
- Always perform professional audit before mainnet deployment

## License

MIT
