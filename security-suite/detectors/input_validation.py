"""
Input Validation Detector
Checks for missing or insufficient input validation
"""

import re
from typing import List, Dict, Any
from base_detector import BaseDetector


class InputValidationDetector(BaseDetector):
    """Detect input validation vulnerabilities"""

    def detect(self) -> List[Dict[str, Any]]:
        self.findings = []

        self.check_zero_amount()
        self.check_string_length()
        self.check_array_bounds()
        self.check_timestamp_validation()
        self.check_address_validation()

        return self.findings

    def check_zero_amount(self):
        """Check for missing zero amount validation"""
        # Find functions with amount parameters
        amount_pattern = r'fn\s+(\w+)\s*\([^)]*(?:amount|price|value|bid):\s*u64[^)]*\)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'

        for match in re.finditer(amount_pattern, self.content, re.DOTALL | re.IGNORECASE):
            fn_name = match.group(1)
            fn_body = match.group(2)
            line_num = self.get_line_number(match.start())

            # Check for zero validation
            zero_checks = [
                'amount > 0', 'amount >= 1', 'amount != 0',
                'price > 0', 'price >= 1', 'price != 0',
                'value > 0', 'bid > 0',
                'require!.*> 0', 'require!.*!= 0',
            ]
            has_zero_check = any(
                re.search(check, fn_body, re.IGNORECASE)
                for check in zero_checks
            )

            if not has_zero_check:
                self.add_finding(
                    f"NO_ZERO_CHECK_{line_num}",
                    "Missing Zero Amount Check",
                    f"Function '{fn_name}' accepts amount without zero validation",
                    "medium",
                    "input-validation",
                    line_num,
                    fn_name,
                    self.get_context_lines(line_num),
                    "Add require!(amount > 0) at function start",
                    "CWE-20"
                )

    def check_string_length(self):
        """Check for string length validation"""
        # Find functions with string parameters
        string_pattern = r'fn\s+(\w+)\s*\([^)]*(?:title|name|description|category):\s*String[^)]*\)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'

        for match in re.finditer(string_pattern, self.content, re.DOTALL | re.IGNORECASE):
            fn_name = match.group(1)
            fn_body = match.group(2)
            line_num = self.get_line_number(match.start())

            # Check for length validation
            length_checks = [
                '.len()', '.is_empty()', 'MAX_', 'MIN_', '< 64', '<= 64',
                'require!.*len', 'trim()',
            ]
            has_length_check = any(check in fn_body for check in length_checks)

            if not has_length_check:
                self.add_finding(
                    f"NO_STRING_LENGTH_{line_num}",
                    "Missing String Length Validation",
                    f"Function '{fn_name}' accepts strings without length check",
                    "low",
                    "input-validation",
                    line_num,
                    fn_name,
                    self.get_context_lines(line_num),
                    "Validate string length: require!(!s.is_empty() && s.len() <= MAX_LEN)",
                    "CWE-20"
                )

    def check_array_bounds(self):
        """Check for array bounds validation"""
        # Find array/vec indexing
        index_pattern = r'\[(\w+)\]'

        for match in re.finditer(index_pattern, self.content):
            index_var = match.group(1)
            line_num = self.get_line_number(match.start())

            # Skip literal indices
            if index_var.isdigit():
                continue

            # Get context
            context = self.get_context_lines(line_num, 3)

            # Check for bounds validation
            bounds_checks = [
                f'{index_var} <', f'{index_var} <=', '.len()',
                '.get(', 'get_mut(', 'first()', 'last()',
            ]
            has_bounds_check = any(check in context for check in bounds_checks)

            if not has_bounds_check:
                self.add_finding(
                    f"NO_BOUNDS_CHECK_{line_num}",
                    "Potential Out of Bounds Access",
                    f"Array access with index '{index_var}' without bounds check",
                    "medium",
                    "input-validation",
                    line_num,
                    self.find_function_at_line(line_num),
                    context,
                    "Use .get() instead of [] or verify index < len",
                    "CWE-129"
                )

    def check_timestamp_validation(self):
        """Check for timestamp validation"""
        # Find timestamp usage
        time_pattern = r'(deadline|end_time|expiry|start_time|timestamp):\s*(u64|i64)'

        for match in re.finditer(time_pattern, self.content, re.IGNORECASE):
            field_name = match.group(1)
            line_num = self.get_line_number(match.start())

            # Find where this field is set
            set_pattern = rf'{field_name}\s*=\s*([^;]+);'

            for set_match in re.finditer(set_pattern, self.content, re.IGNORECASE):
                set_line = self.get_line_number(set_match.start())
                context = self.get_context_lines(set_line, 3)

                # Check for time validation
                time_checks = [
                    'Clock::get', 'current_time', '> now', '>= now',
                    'require!', 'MIN_', 'MAX_',
                ]
                has_time_check = any(check in context for check in time_checks)

                if not has_time_check and 'init' not in context.lower():
                    self.add_finding(
                        f"NO_TIME_VALIDATION_{set_line}",
                        "Missing Timestamp Validation",
                        f"Timestamp '{field_name}' set without validation",
                        "medium",
                        "input-validation",
                        set_line,
                        self.find_function_at_line(set_line),
                        context,
                        "Validate timestamp is in the future and within reasonable bounds",
                        "CWE-20"
                    )

    def check_address_validation(self):
        """Check for address/pubkey validation"""
        # Find pubkey parameters that might need validation
        pubkey_pattern = r'fn\s+(\w+)\s*\([^)]*(\w+):\s*Pubkey[^)]*\)'

        for match in re.finditer(pubkey_pattern, self.content):
            fn_name = match.group(1)
            param_name = match.group(2)
            line_num = self.get_line_number(match.start())

            # Skip if it's an account validation context
            context = self.get_context_lines(line_num, 10)

            # Check if the pubkey is validated
            validation_checks = [
                f'{param_name} != Pubkey::default',
                f'{param_name} != system_program',
                f'key()',
                'has_one',
            ]
            has_validation = any(check in context for check in validation_checks)

            # Special check for sensitive contexts
            sensitive_contexts = ['treasury', 'admin', 'authority', 'recipient']
            is_sensitive = any(s in param_name.lower() for s in sensitive_contexts)

            if is_sensitive and not has_validation:
                self.add_finding(
                    f"NO_PUBKEY_VALIDATION_{line_num}",
                    "Missing Pubkey Validation",
                    f"Sensitive pubkey parameter '{param_name}' may not be validated",
                    "high",
                    "input-validation",
                    line_num,
                    fn_name,
                    context,
                    "Validate pubkey is not default and matches expected constraints",
                    "CWE-20"
                )
