"""
Access Control Detector
Checks for missing or improper access controls
"""

import re
from typing import List, Dict, Any
from base_detector import BaseDetector


class AccessControlDetector(BaseDetector):
    """Detect access control vulnerabilities"""

    def detect(self) -> List[Dict[str, Any]]:
        self.findings = []

        self.check_admin_functions()
        self.check_privilege_escalation()
        self.check_timelock_bypass()
        self.check_pause_mechanism()

        return self.findings

    def check_admin_functions(self):
        """Check for admin functions without proper access control"""
        # Sensitive function patterns
        admin_patterns = [
            r'fn\s+(set_(?:admin|treasury|fee|paused?))',
            r'fn\s+(update_(?:admin|config|settings?))',
            r'fn\s+(change_(?:admin|owner|authority))',
            r'fn\s+(propose_(?:admin|treasury)_change)',
            r'fn\s+(execute_(?:admin|treasury)_change)',
            r'fn\s+(resolve_dispute)',
            r'fn\s+(emergency_\w+)',
            r'fn\s+(withdraw_(?:all|treasury|platform))',
        ]

        for pattern in admin_patterns:
            for match in re.finditer(pattern, self.content, re.IGNORECASE):
                fn_name = match.group(1)
                line_num = self.get_line_number(match.start())

                # Get function body (rough approximation)
                fn_start = match.start()
                fn_body_end = self.content.find('\n    }\n', fn_start)
                if fn_body_end == -1:
                    fn_body_end = self.content.find('\n}\n', fn_start)
                if fn_body_end == -1:
                    continue

                fn_content = self.content[fn_start:fn_body_end]

                # Check for admin verification
                has_admin_check = any([
                    'has_one = admin' in fn_content,
                    '.admin ==' in fn_content,
                    'constraint = market_config.admin' in fn_content,
                    'require!.*admin' in fn_content.lower(),
                    'admin: Signer' in fn_content,
                ])

                if not has_admin_check:
                    self.add_finding(
                        f"NO_ADMIN_CHECK_{line_num}",
                        "Admin Function Without Authority Check",
                        f"Function '{fn_name}' may be missing admin verification",
                        "critical",
                        "access-control",
                        line_num,
                        fn_name,
                        self.get_context_lines(line_num, 5),
                        "Add has_one = admin constraint or verify ctx.accounts.admin == config.admin",
                        "CWE-862"
                    )

    def check_privilege_escalation(self):
        """Check for potential privilege escalation"""
        # Check for role/admin assignment
        patterns = [
            r'\.admin\s*=\s*([^;]+)',
            r'\.authority\s*=\s*([^;]+)',
            r'\.owner\s*=\s*([^;]+)',
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, self.content):
                assignment = match.group(1)
                line_num = self.get_line_number(match.start())

                # Get context
                context = self.get_context_lines(line_num, 5)

                # Check if this is in a properly protected function
                fn_name = self.find_function_at_line(line_num)

                # Check for protection
                has_protection = any([
                    'timelock' in context.lower(),
                    'has_one = admin' in context,
                    'pending_' in context,
                    'propose' in fn_name.lower() if fn_name else False,
                ])

                if not has_protection and 'init' not in context.lower():
                    self.add_finding(
                        f"PRIV_ESCALATION_{line_num}",
                        "Potential Privilege Escalation",
                        f"Admin/authority assignment without timelock or verification",
                        "high",
                        "access-control",
                        line_num,
                        fn_name,
                        context,
                        "Implement timelock for sensitive admin changes",
                        "CWE-269"
                    )

    def check_timelock_bypass(self):
        """Check for timelock bypass possibilities"""
        # Find timelock-related code
        timelock_pattern = r'timelock|time_lock|pending_.*_change|execute_.*_change'

        if not re.search(timelock_pattern, self.content, re.IGNORECASE):
            # No timelock found - could be a finding if admin changes exist
            admin_change_pattern = r'\.admin\s*=|\.treasury\s*='
            if re.search(admin_change_pattern, self.content):
                self.add_finding(
                    "NO_TIMELOCK",
                    "Missing Timelock for Admin Changes",
                    "Sensitive configuration changes have no timelock protection",
                    "high",
                    "access-control",
                    1,
                    None,
                    None,
                    "Implement a timelock mechanism (e.g., 48 hours) for admin changes",
                    "CWE-269"
                )
            return

        # Check for timelock execution
        execute_pattern = r'fn\s+(execute_\w+_change|execute_timelock)\s*\([^)]*\)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'

        for match in re.finditer(execute_pattern, self.content, re.DOTALL):
            fn_name = match.group(1)
            fn_body = match.group(2)
            line_num = self.get_line_number(match.start())

            # Check for time verification
            time_check_patterns = [
                r'Clock::get',
                r'current_time',
                r'unix_timestamp',
                r'timelock.*<|>.*timelock',
            ]

            has_time_check = any(
                re.search(p, fn_body, re.IGNORECASE)
                for p in time_check_patterns
            )

            if not has_time_check:
                self.add_finding(
                    f"TIMELOCK_BYPASS_{line_num}",
                    "Potential Timelock Bypass",
                    f"Function '{fn_name}' may not verify timelock duration",
                    "critical",
                    "access-control",
                    line_num,
                    fn_name,
                    self.get_context_lines(line_num, 8),
                    "Verify current_time >= timelock_start + TIMELOCK_DURATION",
                    "CWE-269"
                )

    def check_pause_mechanism(self):
        """Check pause mechanism implementation"""
        # Find if there's a pause mechanism
        pause_pattern = r'paused|is_paused|set_paused'

        if not re.search(pause_pattern, self.content, re.IGNORECASE):
            # No pause mechanism - might be needed
            # Check if there are funds-related operations
            if re.search(r'transfer|lamports|escrow', self.content, re.IGNORECASE):
                self.add_finding(
                    "NO_PAUSE_MECHANISM",
                    "Missing Emergency Pause",
                    "No pause mechanism found for emergency situations",
                    "medium",
                    "access-control",
                    1,
                    None,
                    None,
                    "Implement a pause mechanism to halt operations in emergencies",
                    "CWE-693"
                )
            return

        # Check if pause is checked in sensitive functions
        sensitive_fns = ['place_bid', 'buy_now', 'create_listing', 'make_offer', 'accept_offer']

        for fn in sensitive_fns:
            fn_pattern = rf'fn\s+{fn}\s*\([^)]*\)[^{{]*\{{([^}}]+(?:\{{[^}}]*\}}[^}}]*)*)\}}'

            for match in re.finditer(fn_pattern, self.content, re.DOTALL):
                fn_body = match.group(1)
                line_num = self.get_line_number(match.start())

                if 'paused' not in fn_body.lower():
                    self.add_finding(
                        f"NO_PAUSE_CHECK_{line_num}",
                        f"Missing Pause Check in {fn}",
                        f"Function '{fn}' does not check if contract is paused",
                        "low",
                        "access-control",
                        line_num,
                        fn,
                        self.get_context_lines(line_num),
                        "Add require!(!config.paused) at the start of the function",
                        "CWE-693"
                    )
