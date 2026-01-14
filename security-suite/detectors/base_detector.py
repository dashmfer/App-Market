"""
Base detector class for Solana security analysis
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from abc import ABC, abstractmethod


class BaseDetector(ABC):
    """Base class for all security detectors"""

    def __init__(self, content: str, lines: List[str], file_path: str):
        self.content = content
        self.lines = lines
        self.file_path = file_path
        self.findings: List[Dict[str, Any]] = []

    @abstractmethod
    def detect(self) -> List[Dict[str, Any]]:
        """Run detection and return findings"""
        pass

    def add_finding(
        self,
        finding_id: str,
        title: str,
        description: str,
        severity: str,
        category: str,
        line: Optional[int] = None,
        function: Optional[str] = None,
        code_snippet: Optional[str] = None,
        recommendation: str = "",
        cwe: Optional[str] = None
    ):
        """Add a finding to the list"""
        self.findings.append({
            "id": finding_id,
            "title": title,
            "description": description,
            "severity": severity,
            "category": category,
            "location": {
                "file": self.file_path,
                "line": line,
                "function": function
            },
            "codeSnippet": code_snippet,
            "recommendation": recommendation,
            "cwe": cwe
        })

    def get_line_number(self, position: int) -> int:
        """Get line number from character position"""
        return self.content[:position].count('\n') + 1

    def get_context_lines(self, line_num: int, context: int = 3) -> str:
        """Get surrounding lines for context"""
        start = max(0, line_num - context - 1)
        end = min(len(self.lines), line_num + context)
        return '\n'.join(
            f"{i + 1}: {self.lines[i]}"
            for i in range(start, end)
        )

    def find_function_at_line(self, line_num: int) -> Optional[str]:
        """Find the function name containing this line"""
        current_function = None
        brace_depth = 0

        for i, line in enumerate(self.lines[:line_num], 1):
            # Check for function definition
            fn_match = re.search(r'(?:pub\s+)?fn\s+(\w+)', line)
            if fn_match:
                current_function = fn_match.group(1)

            # Track brace depth to know when function ends
            brace_depth += line.count('{') - line.count('}')
            if brace_depth == 0 and current_function:
                current_function = None

        return current_function

    def find_all_matches(self, pattern: str, flags: int = 0) -> List[Tuple[int, str, re.Match]]:
        """Find all pattern matches with line numbers"""
        matches = []
        for match in re.finditer(pattern, self.content, flags):
            line_num = self.get_line_number(match.start())
            snippet = self.get_context_lines(line_num)
            matches.append((line_num, snippet, match))
        return matches

    def check_pattern_absence(self, pattern: str, context_pattern: str) -> bool:
        """Check if pattern is absent in context"""
        for match in re.finditer(context_pattern, self.content, re.MULTILINE):
            context = match.group(0)
            if not re.search(pattern, context):
                return True
        return False
