import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Scanners
import { StaticAnalyzer } from './scanners/static-analyzer.js';
import { PatternScanner } from './scanners/pattern-scanner.js';
import { FuzzRunner } from './scanners/fuzz-runner.js';
import { AnchorTestRunner } from './tests/anchor-test-runner.js';
import { APITestRunner } from './tests/api-test-runner.js';

// Results
import { ResultsAggregator } from './results/aggregator.js';
import { ReportGenerator } from './results/report-generator.js';

// Utils
import { loadConfig } from './utils/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// State
let scanResults: Map<string, any> = new Map();
let isScanning = false;
let currentScan: string | null = null;

// Initialize scanners
const staticAnalyzer = new StaticAnalyzer(config);
const patternScanner = new PatternScanner(config);
const fuzzRunner = new FuzzRunner(config);
const anchorTestRunner = new AnchorTestRunner(config);
const apiTestRunner = new APITestRunner(config);
const resultsAggregator = new ResultsAggregator();
const reportGenerator = new ReportGenerator(config);

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('status', {
    isScanning,
    currentScan,
    results: Object.fromEntries(scanResults)
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Emit progress updates
function emitProgress(scanner: string, progress: number, message: string, data?: any) {
  io.emit('progress', { scanner, progress, message, data, timestamp: Date.now() });
}

function emitResult(scanner: string, result: any) {
  scanResults.set(scanner, result);
  io.emit('result', { scanner, result, timestamp: Date.now() });
}

// API Routes

// Get current status
app.get('/api/status', (req, res) => {
  res.json({
    isScanning,
    currentScan,
    results: Object.fromEntries(scanResults),
    config: {
      scanners: config.scanners,
      paths: config.paths
    }
  });
});

// Run all scans
app.post('/api/scan/all', async (req, res) => {
  if (isScanning) {
    return res.status(409).json({ error: 'Scan already in progress' });
  }

  isScanning = true;
  scanResults.clear();

  res.json({ message: 'Scan started', scanId: Date.now() });

  try {
    // Run static analyzer
    currentScan = 'static-analyzer';
    emitProgress('static-analyzer', 0, 'Starting static analysis...');
    const staticResults = await staticAnalyzer.run((progress, msg) => {
      emitProgress('static-analyzer', progress, msg);
    });
    emitResult('static-analyzer', staticResults);

    // Run pattern scanner
    currentScan = 'pattern-scanner';
    emitProgress('pattern-scanner', 0, 'Starting pattern scanning...');
    const patternResults = await patternScanner.run((progress, msg) => {
      emitProgress('pattern-scanner', progress, msg);
    });
    emitResult('pattern-scanner', patternResults);

    // Run anchor tests
    currentScan = 'anchor-tests';
    emitProgress('anchor-tests', 0, 'Starting Anchor attack tests...');
    const anchorResults = await anchorTestRunner.run((progress, msg) => {
      emitProgress('anchor-tests', progress, msg);
    });
    emitResult('anchor-tests', anchorResults);

    // Run API tests
    currentScan = 'api-tests';
    emitProgress('api-tests', 0, 'Starting API security tests...');
    const apiResults = await apiTestRunner.run((progress, msg) => {
      emitProgress('api-tests', progress, msg);
    });
    emitResult('api-tests', apiResults);

    // Run fuzzer (if enabled and available)
    if (config.scanners.fuzzer.enabled) {
      currentScan = 'fuzzer';
      emitProgress('fuzzer', 0, 'Starting fuzz testing...');
      const fuzzResults = await fuzzRunner.run((progress, msg) => {
        emitProgress('fuzzer', progress, msg);
      });
      emitResult('fuzzer', fuzzResults);
    }

    // Aggregate results
    currentScan = 'aggregating';
    emitProgress('aggregator', 0, 'Aggregating results...');
    const aggregatedResults = resultsAggregator.aggregate(Object.fromEntries(scanResults));
    emitResult('aggregated', aggregatedResults);

    io.emit('scanComplete', {
      success: true,
      results: aggregatedResults,
      timestamp: Date.now()
    });

  } catch (error: any) {
    io.emit('scanError', {
      error: error.message,
      scanner: currentScan,
      timestamp: Date.now()
    });
  } finally {
    isScanning = false;
    currentScan = null;
  }
});

// Run individual scanner
app.post('/api/scan/:scanner', async (req, res) => {
  const { scanner } = req.params;

  if (isScanning) {
    return res.status(409).json({ error: 'Scan already in progress' });
  }

  isScanning = true;
  currentScan = scanner;

  res.json({ message: `${scanner} scan started`, scanId: Date.now() });

  try {
    let result;

    switch (scanner) {
      case 'static-analyzer':
        emitProgress(scanner, 0, 'Starting static analysis...');
        result = await staticAnalyzer.run((progress, msg) => {
          emitProgress(scanner, progress, msg);
        });
        break;

      case 'pattern-scanner':
        emitProgress(scanner, 0, 'Starting pattern scanning...');
        result = await patternScanner.run((progress, msg) => {
          emitProgress(scanner, progress, msg);
        });
        break;

      case 'anchor-tests':
        emitProgress(scanner, 0, 'Starting Anchor attack tests...');
        result = await anchorTestRunner.run((progress, msg) => {
          emitProgress(scanner, progress, msg);
        });
        break;

      case 'api-tests':
        emitProgress(scanner, 0, 'Starting API security tests...');
        result = await apiTestRunner.run((progress, msg) => {
          emitProgress(scanner, progress, msg);
        });
        break;

      case 'fuzzer':
        emitProgress(scanner, 0, 'Starting fuzz testing...');
        result = await fuzzRunner.run((progress, msg) => {
          emitProgress(scanner, progress, msg);
        });
        break;

      default:
        throw new Error(`Unknown scanner: ${scanner}`);
    }

    emitResult(scanner, result);
    io.emit('scanComplete', {
      success: true,
      scanner,
      result,
      timestamp: Date.now()
    });

  } catch (error: any) {
    io.emit('scanError', {
      error: error.message,
      scanner,
      timestamp: Date.now()
    });
  } finally {
    isScanning = false;
    currentScan = null;
  }
});

// Get results
app.get('/api/results', (req, res) => {
  const aggregated = resultsAggregator.aggregate(Object.fromEntries(scanResults));
  res.json(aggregated);
});

// Get specific scanner results
app.get('/api/results/:scanner', (req, res) => {
  const { scanner } = req.params;
  const result = scanResults.get(scanner);

  if (!result) {
    return res.status(404).json({ error: 'No results for this scanner' });
  }

  res.json(result);
});

// Generate PDF report
app.get('/api/report/pdf', async (req, res) => {
  try {
    const aggregated = resultsAggregator.aggregate(Object.fromEntries(scanResults));
    const pdfBuffer = await reportGenerator.generatePDF(aggregated);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=security-report.pdf');
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate JSON report
app.get('/api/report/json', (req, res) => {
  const aggregated = resultsAggregator.aggregate(Object.fromEntries(scanResults));
  res.json(aggregated);
});

// Contract info endpoint
app.get('/api/contract', (req, res) => {
  const contractInfo = staticAnalyzer.getContractInfo();
  res.json(contractInfo);
});

// Clear results
app.post('/api/clear', (req, res) => {
  scanResults.clear();
  io.emit('resultsCleared', { timestamp: Date.now() });
  res.json({ message: 'Results cleared' });
});

// Start server
const PORT = config.server.port || 4000;
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🛡️  SOLANA SECURITY TESTING SUITE                          ║
║                                                               ║
║   Server running on: http://localhost:${PORT}                  ║
║   Dashboard: http://localhost:${PORT}                          ║
║                                                               ║
║   Available Scanners:                                         ║
║   • Static Analyzer - Rust/Anchor pattern detection           ║
║   • Pattern Scanner - Custom vulnerability patterns           ║
║   • Anchor Tests   - Attack scenario testing                  ║
║   • API Tests      - Endpoint security testing                ║
║   • Fuzzer         - Cargo-fuzz integration                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export { app, io };
