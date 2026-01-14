"""
Account Validation Detector
Checks for missing signer, owner, and PDA validation issues
"""

import re
from typing import List, Dict, Any
from base_detector import BaseDetector


class AccountValidationDetector(BaseDetector):
    """Detect account validation vulnerabilities"""

    def detect(self) -> List[Dict[str, Any]]:
        self.findings = []

        self.check_missing_signer()
        self.check_missing_owner()
        self.check_unsafe_pda()
        self.check_missing_has_one()
        self.check_account_type_validation()
        self.check_rent_exemption()

        return self.findings

    def check_missing_signer(self):
        """Check for accounts that should be signers but aren't marked"""
        # Find account contexts without signer constraint
        pattern = r'#\[account\(([^)]*)\)\]\s*pub\s+(\w+):\s*(?:Signer|AccountInfo)'
        sensitive_names = ['admin', 'authority', 'owner', 'seller', 'buyer', 'user']

        for match in re.finditer(pattern, self.content):
            constraints = match.group(1)
            account_name = match.group(2)

            # Check if it's a sensitive account without explicit signer
            if any(name in account_name.lower() for name in sensitive_names):
                if 'signer' not in constraints.lower() and 'Signer' not in match.group(0):
                    line_num = self.get_line_number(match.start())
                    self.add_finding(
                        f"MISSING_SIGNER_{line_num}",
                        "Missing Signer Constraint",
                        f"Account '{account_name}' appears to be a privileged account but may not verify signature",
                        "high",
                        "account-validation",
                        line_num,
                        self.find_function_at_line(line_num),
                        self.get_context_lines(line_num),
                        "Add #[account(signer)] or use Signer<'info> type",
                        "CWE-285"
                    )

    def check_missing_owner(self):
        """Check for AccountInfo usage without owner validation"""
        # Find raw AccountInfo without owner constraint
        pattern = r'pub\s+(\w+):\s*AccountInfo<\'info>'

        for match in re.finditer(pattern, self.content):
            account_name = match.group(1)
            line_num = self.get_line_number(match.start())

            # Skip system accounts
            skip_names = ['system_program', 'rent', 'clock', 'token_program', 'associated_token']
            if any(skip in account_name.lower() for skip in skip_names):
                continue

            # Check for owner verification in surrounding context
            context_start = max(0, match.start() - 500)
            context_end = min(len(self.content), match.end() + 500)
            context = self.content[context_start:context_end]

            if f'{account_name}.owner' not in context and 'owner =' not in context:
                self.add_finding(
                    f"MISSING_OWNER_{line_num}",
                    "Missing Account Owner Check",
                    f"AccountInfo '{account_name}' used without owner validation",
                    "critical",
                    "account-validation",
                    line_num,
                    self.find_function_at_line(line_num),
                    self.get_context_lines(line_num),
                    "Use Account<T> wrapper or verify owner manually",
                    "CWE-284"
                )

    def check_unsafe_pda(self):
        """Check for potentially unsafe PDA derivation"""
        # Simple seed patterns that might cause collisions
        pattern = r'seeds\s*=\s*\[\s*b"(\w+)"\s*\]'

        for match in re.finditer(pattern, self.content):
            seed = match.group(1)
            line_num = self.get_line_number(match.start())

            # Flag simple seeds
            if len(seed) < 5:
                self.add_finding(
                    f"SIMPLE_PDA_SEED_{line_num}",
                    "Simple PDA Seed Pattern",
                    f"PDA seed '{seed}' is short and may cause collisions",
                    "medium",
                    "account-validation",
                    line_num,
                    self.find_function_at_line(line_num),
                    self.get_context_lines(line_num),
                    "Use longer, more descriptive seed prefixes with multiple components",
                    "CWE-330"
                )

        # Check for missing bump seed
        pda_pattern = r'seeds\s*=\s*\[[^\]]+\](?![^}]*bump)'

        for match in re.finditer(pda_pattern, self.content, re.DOTALL):
            line_num = self.get_line_number(match.start())
            # Only flag if this looks like a PDA account (has init or similar)
            context = self.content[max(0, match.start()-200):match.start()]
            if 'init' in context or 'seeds' in context:
                self.add_finding(
                    f"MISSING_BUMP_{line_num}",
                    "Missing Bump Seed",
                    "PDA derivation without explicit bump seed",
                    "low",
                    "account-validation",
                    line_num,
                    self.find_function_at_line(line_num),
                    self.get_context_lines(line_num),
                    "Include bump seed in PDA derivation for consistency",
                    "CWE-330"
                )

    def check_missing_has_one(self):
        """Check for missing has_one constraints on related accounts"""
        # Find structs with seller/buyer/admin without has_one
        struct_pattern = r'#\[derive\(Accounts\)\]\s*pub\s+struct\s+(\w+)[^{]*\{([^}]+)\}'

        for match in re.finditer(struct_pattern, self.content, re.DOTALL):
            struct_name = match.group(1)
            struct_body = match.group(2)
            line_num = self.get_line_number(match.start())

            # Check for related accounts
            has_seller = 'seller' in struct_body.lower()
            has_buyer = 'buyer' in struct_body.lower()
            has_admin = 'admin' in struct_body.lower()
            has_listing = 'listing' in struct_body.lower()

            # Check for has_one constraints
            has_has_one = 'has_one' in struct_body

            if (has_seller or has_buyer or has_admin) and has_listing and not has_has_one:
                self.add_finding(
                    f"MISSING_HAS_ONE_{line_num}",
                    "Missing has_one Relationship",
                    f"Struct '{struct_name}' has related accounts without has_one constraint",
                    "high",
                    "account-validation",
                    line_num,
                    struct_name,
                    self.get_context_lines(line_num, 5),
                    "Add has_one = listing or similar constraints to verify relationships",
                    "CWE-285"
                )

    def check_account_type_validation(self):
        """Check for missing account discriminator validation"""
        # Find places where accounts are deserialized manually
        pattern = r'\.try_borrow_data\(\)|\.data\.borrow\(\)'

        for match in re.finditer(pattern, self.content):
            line_num = self.get_line_number(match.start())
            context = self.get_context_lines(line_num)

            # Check if discriminator is verified
            if 'discriminator' not in context.lower() and 'DISCRIMINATOR' not in context:
                self.add_finding(
                    f"MISSING_DISCRIMINATOR_{line_num}",
                    "Missing Account Discriminator Check",
                    "Manual account deserialization without discriminator verification",
                    "high",
                    "account-validation",
                    line_num,
                    self.find_function_at_line(line_num),
                    context,
                    "Verify account discriminator before deserializing",
                    "CWE-20"
                )

    def check_rent_exemption(self):
        """Check for missing rent exemption enforcement"""
        # Find init without rent_exempt
        pattern = r'#\[account\(\s*init\s*,'

        for match in re.finditer(pattern, self.content):
            # Get the full constraint block
            end = self.content.find(')', match.end())
            constraint_block = self.content[match.start():end]

            if 'rent_exempt' not in constraint_block:
                line_num = self.get_line_number(match.start())
                self.add_finding(
                    f"NO_RENT_EXEMPT_{line_num}",
                    "Missing Rent Exemption",
                    "Account initialization without rent_exempt constraint",
                    "medium",
                    "account-validation",
                    line_num,
                    self.find_function_at_line(line_num),
                    self.get_context_lines(line_num),
                    'Add rent_exempt = "enforce" to init constraint',
                    "CWE-400"
                )
