"""
State Manipulation Detector
Checks for state transition and manipulation vulnerabilities
"""

import re
from typing import List, Dict, Any
from base_detector import BaseDetector


class StateManipulationDetector(BaseDetector):
    """Detect state manipulation vulnerabilities"""

    def detect(self) -> List[Dict[str, Any]]:
        self.findings = []

        self.check_state_transitions()
        self.check_race_conditions()
        self.check_expired_state()
        self.check_account_closure()
        self.check_dos_vectors()

        return self.findings

    def check_state_transitions(self):
        """Check for invalid state transitions"""
        # Find enum status definitions
        status_pattern = r'enum\s+(\w*Status\w*)\s*\{([^}]+)\}'

        for match in re.finditer(status_pattern, self.content, re.DOTALL):
            enum_name = match.group(1)
            enum_body = match.group(2)

            # Extract variants
            variants = re.findall(r'(\w+)', enum_body)

            # Find where status is changed
            status_change_pattern = rf'\.status\s*=\s*{enum_name}::(\w+)'

            for change_match in re.finditer(status_change_pattern, self.content):
                new_status = change_match.group(1)
                line_num = self.get_line_number(change_match.start())
                context = self.get_context_lines(line_num, 5)
                fn_name = self.find_function_at_line(line_num)

                # Check if there's a status validation before change
                validation_patterns = [
                    rf'{enum_name}::\w+\s*=>\s*{enum_name}::{new_status}',  # Match arm
                    rf'\.status\s*==\s*{enum_name}::\w+',  # Equality check
                    r'match\s+.*\.status',  # Match expression
                    'require!.*status',  # Require on status
                ]
                has_validation = any(
                    re.search(p, context, re.IGNORECASE)
                    for p in validation_patterns
                )

                if not has_validation:
                    self.add_finding(
                        f"INVALID_STATE_TRANSITION_{line_num}",
                        "Unchecked State Transition",
                        f"Status changed to {new_status} without validating current state",
                        "high",
                        "state-manipulation",
                        line_num,
                        fn_name,
                        context,
                        f"Verify current status before changing to {new_status}",
                        "CWE-372"
                    )

    def check_race_conditions(self):
        """Check for potential race conditions"""
        # Find operations that should be atomic
        check_then_use_pattern = r'if\s+.*(\w+)\.(\w+)[^{]*\{[^}]*\1\.\2'

        for match in re.finditer(check_then_use_pattern, self.content, re.DOTALL):
            line_num = self.get_line_number(match.start())
            context = self.get_context_lines(line_num, 5)

            # This pattern can indicate TOCTOU
            self.add_finding(
                f"POTENTIAL_TOCTOU_{line_num}",
                "Potential Time-of-Check to Time-of-Use",
                "Value checked then used separately - may be vulnerable to race condition",
                "low",
                "state-manipulation",
                line_num,
                self.find_function_at_line(line_num),
                context,
                "Consider using atomic operations or mutex patterns",
                "CWE-367"
            )

    def check_expired_state(self):
        """Check for operations on expired entities"""
        # Find functions that might operate on time-sensitive state
        time_sensitive_fns = ['bid', 'offer', 'settle', 'claim', 'finalize']

        for fn in time_sensitive_fns:
            fn_pattern = rf'fn\s+\w*{fn}\w*\s*\([^)]*\)[^{{]*\{{([^}}]+(?:\{{[^}}]*\}}[^}}]*)*)\}}'

            for match in re.finditer(fn_pattern, self.content, re.DOTALL | re.IGNORECASE):
                fn_body = match.group(1)
                line_num = self.get_line_number(match.start())
                fn_name = self.find_function_at_line(line_num)

                # Check for time/expiry validation
                time_checks = [
                    'Clock::get', 'current_time', 'unix_timestamp',
                    'expired', 'deadline', 'end_time',
                    '< now', '> now', '<= now', '>= now',
                ]
                has_time_check = any(check in fn_body for check in time_checks)

                if not has_time_check:
                    self.add_finding(
                        f"NO_EXPIRY_CHECK_{line_num}",
                        f"Missing Expiry Check in {fn_name or fn}",
                        "Time-sensitive operation without expiry validation",
                        "high",
                        "state-manipulation",
                        line_num,
                        fn_name,
                        self.get_context_lines(line_num, 5),
                        "Add time check: require!(current_time < deadline)",
                        "CWE-367"
                    )

    def check_account_closure(self):
        """Check for account closure vulnerabilities"""
        # Find close constraints
        close_pattern = r'close\s*=\s*(\w+)'

        for match in re.finditer(close_pattern, self.content):
            recipient = match.group(1)
            line_num = self.get_line_number(match.start())
            context = self.get_context_lines(line_num, 5)

            # Check for relationship validation
            if 'has_one' not in context and 'constraint' not in context:
                self.add_finding(
                    f"UNVERIFIED_CLOSE_{line_num}",
                    "Account Close Without Relationship Check",
                    f"Account closed to '{recipient}' without verifying relationship",
                    "medium",
                    "state-manipulation",
                    line_num,
                    self.find_function_at_line(line_num),
                    context,
                    "Add has_one constraint to verify recipient",
                    "CWE-672"
                )

            # Check for data zeroing before close
            fn_name = self.find_function_at_line(line_num)
            if fn_name:
                # Look for data zeroing in the function
                fn_pattern = rf'fn\s+{fn_name}\s*\([^)]*\)[^{{]*\{{([^}}]+(?:\{{[^}}]*\}}[^}}]*)*)\}}'
                fn_match = re.search(fn_pattern, self.content, re.DOTALL)

                if fn_match:
                    fn_body = fn_match.group(1)
                    if '.data.borrow_mut().fill(0)' not in fn_body and 'zero' not in fn_body.lower():
                        # Check if account might contain sensitive data
                        if 'escrow' in context.lower() or 'secret' in context.lower():
                            self.add_finding(
                                f"DATA_NOT_ZEROED_{line_num}",
                                "Account Data Not Zeroed Before Close",
                                "Account closed without zeroing potentially sensitive data",
                                "low",
                                "state-manipulation",
                                line_num,
                                fn_name,
                                context,
                                "Zero sensitive data before closing account",
                                "CWE-212"
                            )

    def check_dos_vectors(self):
        """Check for denial of service vulnerabilities"""
        # Check for unbounded loops
        loop_pattern = r'for\s+\w+\s+in\s+(\w+)(?:\.iter\(\))?'

        for match in re.finditer(loop_pattern, self.content):
            iterable = match.group(1)
            line_num = self.get_line_number(match.start())
            context = self.get_context_lines(line_num, 3)

            # Check for bounds
            if '.take(' not in context and 'MAX_' not in context:
                # Check if iterating over potentially unbounded collection
                if 'Vec' in self.content or iterable.endswith('s'):
                    self.add_finding(
                        f"UNBOUNDED_LOOP_{line_num}",
                        "Potentially Unbounded Loop",
                        f"Loop over '{iterable}' without explicit bounds",
                        "medium",
                        "state-manipulation",
                        line_num,
                        self.find_function_at_line(line_num),
                        context,
                        "Add .take(MAX_ITERATIONS) or validate collection size",
                        "CWE-400"
                    )

        # Check for Vec without max size
        vec_pattern = r'pub\s+(\w+):\s*Vec<([^>]+)>'

        for match in re.finditer(vec_pattern, self.content):
            field_name = match.group(1)
            line_num = self.get_line_number(match.start())

            # Look for size constraints
            context_before = self.content[max(0, match.start()-200):match.start()]

            if 'max_len' not in context_before and 'MAX_' not in context_before:
                self.add_finding(
                    f"UNBOUNDED_VEC_{line_num}",
                    "Unbounded Vector Field",
                    f"Vector field '{field_name}' has no maximum length constraint",
                    "medium",
                    "state-manipulation",
                    line_num,
                    None,
                    self.get_context_lines(line_num, 2),
                    "Add #[max_len(N)] or enforce size limits on push operations",
                    "CWE-400"
                )
