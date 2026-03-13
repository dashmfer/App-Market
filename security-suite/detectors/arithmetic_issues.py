"""
Arithmetic Issues Detector
Checks for overflow, underflow, and precision issues
"""

import re
from typing import List, Dict, Any
from base_detector import BaseDetector


class ArithmeticDetector(BaseDetector):
    """Detect arithmetic vulnerabilities"""

    def detect(self) -> List[Dict[str, Any]]:
        self.findings = []

        self.check_unchecked_math()
        self.check_division_issues()
        self.check_type_casting()
        self.check_fee_calculations()

        return self.findings

    def check_unchecked_math(self):
        """Check for arithmetic without checked operations"""
        # Pattern for basic arithmetic that's not using checked methods
        # Look for: a + b, a - b, a * b where it's not .checked_ or .saturating_

        # Find lines with arithmetic
        arithmetic_lines = []
        for i, line in enumerate(self.lines, 1):
            # Skip comments
            if line.strip().startswith('//'):
                continue

            # Look for arithmetic operations
            if re.search(r'\w+\s*[\+\-\*]\s*\w+', line):
                # Check if it's using safe methods
                if not re.search(r'\.checked_|\.saturating_|\.wrapping_', line):
                    # Also check if in a checked! macro or error handling
                    if 'checked!' not in line and '.ok_or' not in line:
                        arithmetic_lines.append((i, line))

        # Analyze context for each finding
        for line_num, line in arithmetic_lines:
            # Get surrounding context
            context = self.get_context_lines(line_num, 2)

            # Check if there's overflow protection nearby
            has_protection = any(
                safe in context
                for safe in ['checked_', 'saturating_', 'try_into', 'as u64', 'ok_or']
            )

            if not has_protection:
                # Extract the expression
                expr_match = re.search(r'(\w+)\s*([\+\-\*])\s*(\w+)', line)
                if expr_match:
                    op = {'*': 'multiplication', '+': 'addition', '-': 'subtraction'}
                    op_name = op.get(expr_match.group(2), 'arithmetic')

                    self.add_finding(
                        f"UNCHECKED_MATH_{line_num}",
                        f"Unchecked {op_name.title()}",
                        f"Arithmetic operation without overflow protection on line {line_num}",
                        "high",
                        "arithmetic",
                        line_num,
                        self.find_function_at_line(line_num),
                        context,
                        f"Use checked_{op_name.replace('multiplication', 'mul').replace('addition', 'add').replace('subtraction', 'sub')}() or saturating_*",
                        "CWE-190"
                    )

    def check_division_issues(self):
        """Check for division by zero and precision loss"""
        # Find division operations
        pattern = r'(\w+)\s*/\s*(\w+)'

        for match in re.finditer(pattern, self.content):
            numerator = match.group(1)
            denominator = match.group(2)
            line_num = self.get_line_number(match.start())

            # Get context
            context = self.get_context_lines(line_num)

            # Check for zero check
            if denominator != '0' and f'{denominator} == 0' not in context and f'{denominator} > 0' not in context:
                # Check if it's using checked_div
                if 'checked_div' not in context:
                    self.add_finding(
                        f"DIV_ZERO_{line_num}",
                        "Potential Division by Zero",
                        f"Division by '{denominator}' without zero check",
                        "medium",
                        "arithmetic",
                        line_num,
                        self.find_function_at_line(line_num),
                        context,
                        "Check divisor is non-zero or use checked_div()",
                        "CWE-369"
                    )

            # Check for precision loss (integer division)
            if '.' not in context and 'as f' not in context:
                # Look for patterns like: amount * fee / 10000
                if re.search(r'\*\s*\w+\s*/\s*\d+', context) or re.search(r'/\s*\d+\s*\*', context):
                    self.add_finding(
                        f"PRECISION_LOSS_{line_num}",
                        "Potential Precision Loss",
                        "Integer division may lose precision in fee/ratio calculation",
                        "low",
                        "arithmetic",
                        line_num,
                        self.find_function_at_line(line_num),
                        context,
                        "Consider order of operations to minimize precision loss",
                        "CWE-682"
                    )

    def check_type_casting(self):
        """Check for unsafe type casting"""
        # Find 'as' type casts
        pattern = r'(\w+)\s+as\s+(u\d+|i\d+|usize|isize)'

        for match in re.finditer(pattern, self.content):
            source = match.group(1)
            target_type = match.group(2)
            line_num = self.get_line_number(match.start())

            # Check for potentially unsafe downcasts
            unsafe_casts = [
                ('u128', 'u64'), ('u64', 'u32'), ('u32', 'u16'), ('u16', 'u8'),
                ('i128', 'i64'), ('i64', 'i32'), ('i32', 'i16'), ('i16', 'i8'),
                ('usize', 'u32'), ('usize', 'u16'), ('usize', 'u8'),
            ]

            context = self.get_context_lines(line_num)

            # Check if there's a try_into instead
            if 'try_into' not in context:
                for large, small in unsafe_casts:
                    if target_type == small:
                        # Check if the source might be a larger type
                        if f'{large}' in context or 'amount' in source.lower() or 'value' in source.lower():
                            self.add_finding(
                                f"UNSAFE_CAST_{line_num}",
                                "Potentially Unsafe Type Cast",
                                f"Cast to {target_type} may truncate larger values",
                                "medium",
                                "arithmetic",
                                line_num,
                                self.find_function_at_line(line_num),
                                context,
                                "Use try_into() with error handling instead of 'as'",
                                "CWE-681"
                            )
                            break

    def check_fee_calculations(self):
        """Check for fee calculation issues"""
        # Find fee calculations
        fee_pattern = r'(?:fee|commission|royalty|bps|basis_points)\s*[=:]\s*([^;]+)'

        for match in re.finditer(fee_pattern, self.content, re.IGNORECASE):
            calculation = match.group(1)
            line_num = self.get_line_number(match.start())
            context = self.get_context_lines(line_num)

            # Check for potential issues

            # 1. Fee not using checked math
            if '*' in calculation or '/' in calculation:
                if 'checked_' not in calculation and 'saturating_' not in calculation:
                    self.add_finding(
                        f"FEE_OVERFLOW_{line_num}",
                        "Fee Calculation Without Overflow Protection",
                        "Fee calculation may overflow with large amounts",
                        "high",
                        "arithmetic",
                        line_num,
                        self.find_function_at_line(line_num),
                        context,
                        "Use checked arithmetic for fee calculations",
                        "CWE-190"
                    )

            # 2. Fee percentage validation
            if 'bps' in calculation.lower() or '10000' in calculation or '100' in calculation:
                # Check if there's a max fee check
                if 'require!' not in context and '>' not in context and 'max' not in context.lower():
                    self.add_finding(
                        f"FEE_NO_CAP_{line_num}",
                        "Fee Without Maximum Cap",
                        "Fee percentage may not be capped to prevent abuse",
                        "medium",
                        "arithmetic",
                        line_num,
                        self.find_function_at_line(line_num),
                        context,
                        "Add maximum fee validation (e.g., require!(fee_bps <= 1000))",
                        "CWE-20"
                    )
