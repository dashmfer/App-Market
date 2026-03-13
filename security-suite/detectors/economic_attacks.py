"""
Economic Attack Detector
Checks for fund extraction, manipulation, and economic vulnerabilities
"""

import re
from typing import List, Dict, Any
from base_detector import BaseDetector


class EconomicAttackDetector(BaseDetector):
    """Detect economic attack vulnerabilities"""

    def detect(self) -> List[Dict[str, Any]]:
        self.findings = []

        self.check_double_withdrawal()
        self.check_front_running()
        self.check_fee_manipulation()
        self.check_fund_extraction()
        self.check_escrow_security()

        return self.findings

    def check_double_withdrawal(self):
        """Check for double withdrawal vulnerabilities"""
        # Find withdrawal functions
        withdraw_pattern = r'fn\s+(withdraw|claim|redeem)\w*\s*\([^)]*\)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'

        for match in re.finditer(withdraw_pattern, self.content, re.DOTALL):
            fn_name = match.group(1)
            fn_body = match.group(2)
            line_num = self.get_line_number(match.start())

            # Check for claim status verification
            status_checks = [
                'claimed', 'processed', 'withdrawn', 'completed',
                'status ==', 'is_some()', '.is_none()',
            ]
            has_status_check = any(check in fn_body.lower() for check in status_checks)

            # Check for status update
            status_updates = [
                'claimed = true', 'processed = true', 'withdrawn = true',
                'status =', 'close =',
            ]
            has_status_update = any(update in fn_body.lower() for update in status_updates)

            if not has_status_check or not has_status_update:
                self.add_finding(
                    f"DOUBLE_WITHDRAW_{line_num}",
                    "Potential Double Withdrawal",
                    f"Function '{fn_name}' may allow multiple claims",
                    "critical",
                    "economic-attacks",
                    line_num,
                    fn_name,
                    self.get_context_lines(line_num, 8),
                    "Mark withdrawal as claimed before transfer and verify status on entry",
                    "CWE-367"
                )

    def check_front_running(self):
        """Check for front-running vulnerabilities"""
        # Check auction/bid functions for anti-sniping
        auction_pattern = r'fn\s+(place_bid|submit_bid|bid)\s*\([^)]*\)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'

        for match in re.finditer(auction_pattern, self.content, re.DOTALL):
            fn_name = match.group(1)
            fn_body = match.group(2)
            line_num = self.get_line_number(match.start())

            # Check for anti-sniping measures
            anti_sniping = [
                'auction_end', 'extend', 'time_extension',
                'ANTI_SNIPE', 'EXTENSION', '+ 900', '+ 15',  # 15 minute extension
            ]
            has_anti_sniping = any(measure in fn_body for measure in anti_sniping)

            if not has_anti_sniping:
                self.add_finding(
                    f"NO_ANTI_SNIPE_{line_num}",
                    "Missing Anti-Sniping Protection",
                    "Auction bid function lacks anti-sniping time extension",
                    "medium",
                    "economic-attacks",
                    line_num,
                    fn_name,
                    self.get_context_lines(line_num),
                    "Extend auction by 15 minutes when bid placed near end",
                    "CWE-362"
                )

        # Check for commit-reveal patterns in price-sensitive operations
        price_pattern = r'fn\s+\w*(price|amount|value)\w*\s*\('

        for match in re.finditer(price_pattern, self.content, re.IGNORECASE):
            line_num = self.get_line_number(match.start())
            context = self.get_context_lines(line_num, 10)

            # Check for price validation timing
            if 'oracle' not in context.lower() and 'pyth' not in context.lower():
                if 'slot' not in context.lower() and 'timestamp' not in context.lower():
                    # Price operations without timing controls
                    pass  # Not flagging as it's common pattern

    def check_fee_manipulation(self):
        """Check for fee manipulation vulnerabilities"""
        # Check if fees are locked at creation
        fee_pattern = r'(platform_fee|dispute_fee|fee_bps|commission)'

        fee_references = list(re.finditer(fee_pattern, self.content, re.IGNORECASE))

        if fee_references:
            # Check for fee locking mechanism
            locked_pattern = r'locked_.*fee|fee.*locked|\.locked_'
            has_fee_locking = bool(re.search(locked_pattern, self.content, re.IGNORECASE))

            if not has_fee_locking:
                self.add_finding(
                    "FEE_NOT_LOCKED",
                    "Fees Not Locked at Creation",
                    "Fees may be changed between listing creation and settlement",
                    "high",
                    "economic-attacks",
                    fee_references[0].start(),
                    None,
                    self.get_context_lines(self.get_line_number(fee_references[0].start())),
                    "Lock fee rates at listing creation time to prevent manipulation",
                    "CWE-682"
                )

        # Check for fee cap enforcement
        fee_set_pattern = r'fn\s+set_.*fee|fn\s+update_.*fee|\.fee.*=\s*\d+'

        for match in re.finditer(fee_set_pattern, self.content, re.IGNORECASE):
            line_num = self.get_line_number(match.start())
            context = self.get_context_lines(line_num, 5)

            if 'MAX_' not in context and '<=' not in context and 'require!' not in context:
                self.add_finding(
                    f"NO_FEE_CAP_{line_num}",
                    "Fee Change Without Cap",
                    "Fee can be set without maximum limit",
                    "medium",
                    "economic-attacks",
                    line_num,
                    self.find_function_at_line(line_num),
                    context,
                    "Add require!(new_fee <= MAX_FEE) to prevent excessive fees",
                    "CWE-20"
                )

    def check_fund_extraction(self):
        """Check for unauthorized fund extraction vulnerabilities"""
        # Find transfer operations
        transfer_pattern = r'\*\*.*lamports\(\).*\?\s*[\+\-]=|transfer\s*\(|\.sub\(.*lamports'

        for match in re.finditer(transfer_pattern, self.content):
            line_num = self.get_line_number(match.start())
            context = self.get_context_lines(line_num, 8)
            fn_name = self.find_function_at_line(line_num)

            # Check for balance verification
            balance_checks = ['lamports() >=', 'lamports() >', 'balance >=', 'sufficient']
            has_balance_check = any(check in context for check in balance_checks)

            if not has_balance_check:
                self.add_finding(
                    f"NO_BALANCE_CHECK_{line_num}",
                    "Transfer Without Balance Check",
                    "Fund transfer without verifying sufficient balance",
                    "critical",
                    "economic-attacks",
                    line_num,
                    fn_name,
                    context,
                    "Verify account has sufficient balance before transfer",
                    "CWE-20"
                )

            # Check for reentrancy (state update after transfer)
            transfer_pos = match.start()
            following_content = self.content[transfer_pos:transfer_pos + 500]

            if re.search(r'\?;\s*\n.*\.\w+\s*=', following_content, re.DOTALL):
                self.add_finding(
                    f"REENTRANCY_{line_num}",
                    "Potential Reentrancy",
                    "State modified after external transfer call",
                    "high",
                    "economic-attacks",
                    line_num,
                    fn_name,
                    context,
                    "Update state before making transfers (Checks-Effects-Interactions)",
                    "CWE-841"
                )

    def check_escrow_security(self):
        """Check escrow implementation security"""
        # Find escrow-related code
        escrow_pattern = r'struct\s+Escrow|escrow.*locked|locked.*amount'

        if not re.search(escrow_pattern, self.content, re.IGNORECASE):
            return

        # Check for proper escrow release conditions
        release_pattern = r'fn\s+(release|finalize|complete).*\{'

        for match in re.finditer(release_pattern, self.content, re.IGNORECASE):
            line_num = self.get_line_number(match.start())
            fn_name = self.find_function_at_line(line_num)

            # Get function body
            fn_start = match.start()
            fn_end = self.content.find('\n}\n', fn_start)
            if fn_end == -1:
                continue

            fn_body = self.content[fn_start:fn_end]

            # Check for proper conditions
            conditions = [
                'status', 'verified', 'confirmed', 'grace_period', 'deadline',
            ]
            condition_count = sum(1 for c in conditions if c in fn_body.lower())

            if condition_count < 2:
                self.add_finding(
                    f"WEAK_ESCROW_RELEASE_{line_num}",
                    "Weak Escrow Release Conditions",
                    "Escrow may be released without sufficient verification",
                    "high",
                    "economic-attacks",
                    line_num,
                    fn_name,
                    self.get_context_lines(line_num, 5),
                    "Add multiple conditions: verification, grace period, status checks",
                    "CWE-284"
                )
