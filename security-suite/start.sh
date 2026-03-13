#!/bin/bash

# Solana Security Testing Suite - Startup Script

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🛡️  SOLANA SECURITY TESTING SUITE                          ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null)
if [ -z "$NODE_VERSION" ]; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi
echo "✅ Node.js: $NODE_VERSION"

# Check Python
PYTHON_VERSION=$(python3 --version 2>/dev/null)
if [ -z "$PYTHON_VERSION" ]; then
    echo "⚠️  Python3 not found. Python detectors will be disabled."
else
    echo "✅ Python: $PYTHON_VERSION"
fi

# Check cargo-fuzz
if command -v cargo &> /dev/null && cargo fuzz --help &> /dev/null; then
    echo "✅ cargo-fuzz: installed"
else
    echo "⚠️  cargo-fuzz not installed. Fuzzer will provide setup instructions."
fi

echo ""
echo "🚀 Starting security suite on http://localhost:4000"
echo ""
echo "   Available scanners:"
echo "   • Static Analyzer   - Pattern-based Rust/Anchor analysis"
echo "   • Pattern Scanner   - Solana-specific vulnerability patterns"
echo "   • Attack Tests      - 20+ attack scenarios"
echo "   • API Tests         - Endpoint security testing"
echo "   • Fuzzer           - cargo-fuzz crash discovery"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

# Start the server
npm run dev
