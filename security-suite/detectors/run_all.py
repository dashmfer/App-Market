#!/usr/bin/env python3
"""
Solana Smart Contract Security Analyzer
Run all detectors against the contract and output results as JSON
"""

import json
import sys
import os
import re
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
from enum import Enum

# Add detectors directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from account_validation import AccountValidationDetector
from arithmetic_issues import ArithmeticDetector
from access_control import AccessControlDetector
from economic_attacks import EconomicAttackDetector
from input_validation import InputValidationDetector
from state_manipulation import StateManipulationDetector

class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

@dataclass
class Finding:
    id: str
    title: str
    description: str
    severity: str
    category: str
    file: str
    line: Optional[int]
    function: Optional[str]
    code_snippet: Optional[str]
    recommendation: str
    cwe: Optional[str] = None

class SolanaSecurityAnalyzer:
    def __init__(self, contract_path: str):
        self.contract_path = contract_path
        self.content = ""
        self.lines: List[str] = []
        self.findings: List[Finding] = []
        self.detectors = []

    def load_contract(self) -> bool:
        """Load the contract file"""
        try:
            with open(self.contract_path, 'r', encoding='utf-8') as f:
                self.content = f.read()
                self.lines = self.content.split('\n')
            return True
        except Exception as e:
            print(f"Error loading contract: {e}", file=sys.stderr)
            return False

    def initialize_detectors(self):
        """Initialize all detector modules"""
        self.detectors = [
            AccountValidationDetector(self.content, self.lines, self.contract_path),
            ArithmeticDetector(self.content, self.lines, self.contract_path),
            AccessControlDetector(self.content, self.lines, self.contract_path),
            EconomicAttackDetector(self.content, self.lines, self.contract_path),
            InputValidationDetector(self.content, self.lines, self.contract_path),
            StateManipulationDetector(self.content, self.lines, self.contract_path),
        ]

    def run_analysis(self) -> Dict[str, Any]:
        """Run all detectors and collect findings"""
        if not self.load_contract():
            return {"error": "Failed to load contract"}

        self.initialize_detectors()

        all_findings = []
        for detector in self.detectors:
            try:
                findings = detector.detect()
                all_findings.extend(findings)
            except Exception as e:
                print(f"Error in detector {detector.__class__.__name__}: {e}", file=sys.stderr)

        # Deduplicate findings
        seen = set()
        unique_findings = []
        for f in all_findings:
            key = f"{f['title']}:{f.get('line', 0)}"
            if key not in seen:
                seen.add(key)
                unique_findings.append(f)

        # Sort by severity
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        unique_findings.sort(key=lambda x: severity_order.get(x['severity'], 5))

        # Calculate summary
        summary = {
            "total": len(unique_findings),
            "critical": sum(1 for f in unique_findings if f['severity'] == 'critical'),
            "high": sum(1 for f in unique_findings if f['severity'] == 'high'),
            "medium": sum(1 for f in unique_findings if f['severity'] == 'medium'),
            "low": sum(1 for f in unique_findings if f['severity'] == 'low'),
            "info": sum(1 for f in unique_findings if f['severity'] == 'info'),
        }

        return {
            "scanner": "python-static-analyzer",
            "contract_path": self.contract_path,
            "contract_lines": len(self.lines),
            "findings": unique_findings,
            "summary": summary
        }


def main():
    # Default contract path
    script_dir = Path(__file__).parent
    default_path = script_dir.parent.parent / "programs" / "app-market" / "src" / "lib.rs"

    contract_path = sys.argv[1] if len(sys.argv) > 1 else str(default_path)

    if not os.path.exists(contract_path):
        print(json.dumps({"error": f"Contract not found: {contract_path}"}))
        sys.exit(1)

    analyzer = SolanaSecurityAnalyzer(contract_path)
    results = analyzer.run_analysis()

    # Output as JSON
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
