# Agentic Actions Security Audit Report

**Repository:** App-Market
**Audit Date:** 2026-03-06
**Auditor:** Automated Supply Chain Risk Auditor

---

## 1. Workflow Files Discovered

| # | Workflow File | Trigger Events |
|---|---------------|----------------|
| 1 | `.github/workflows/codeql.yml` | push (main, master), pull_request (main, master), schedule (weekly) |
| 2 | `.github/workflows/snyk.yml` | push (main, master), pull_request (main, master), schedule (weekly) |
| 3 | `.github/workflows/trivy.yml` | push (main, master), pull_request (main, master), schedule (weekly) |

## 2. AI Action Steps Identified

**No AI action steps were found in any workflow file.**

The following known AI actions were checked against every `uses:` field in all workflows:

- `anthropics/claude-code-action`
- `google-github-actions/run-gemini-cli`
- `google-gemini/gemini-cli-action`
- `openai/codex-action`
- `actions/ai-inference`

### Actions present in workflows

All actions found are standard security scanning and CI tooling:

| Action | Workflow |
|--------|----------|
| `actions/checkout@v4` | codeql.yml, snyk.yml, trivy.yml |
| `github/codeql-action/init@v3` | codeql.yml |
| `github/codeql-action/autobuild@v3` | codeql.yml |
| `github/codeql-action/analyze@v3` | codeql.yml |
| `actions/setup-node@v4` | snyk.yml |
| `snyk/actions/node@cdb760004b...` (pinned) | snyk.yml |
| `github/codeql-action/upload-sarif@v3` | snyk.yml, trivy.yml |
| `aquasecurity/trivy-action@6e7b7d1f...` (pinned) | trivy.yml |

## 3. Attack Vector Analysis

Since no AI/agentic actions are present, none of the following attack vectors apply:

| Vector | ID | Status |
|--------|----|--------|
| Env Var Intermediary | A | N/A - No AI actions |
| Direct Expression Injection | B | N/A - No AI actions |
| CLI Data Fetch | C | N/A - No AI actions |
| PR Target + Checkout | D | N/A - No AI actions |
| Error Log Injection | E | N/A - No AI actions |
| Subshell Expansion | F | N/A - No AI actions |
| Eval of AI Output | G | N/A - No AI actions |
| Dangerous Sandbox Configs | H | N/A - No AI actions |
| Wildcard Allowlists | I | N/A - No AI actions |

## 4. Summary

**Risk Level: None (for agentic actions)**

This repository does not use any AI/agentic GitHub Actions. All three workflow files are standard security scanning pipelines (CodeQL, Snyk, Trivy) with appropriately scoped permissions (`contents: read`, `security-events: write`, `actions: read`). No agentic action attack surface exists.

### Positive observations

- All third-party actions (Snyk, Trivy) are pinned to specific commit SHAs, reducing supply chain risk.
- Permissions follow the principle of least privilege with read-only content access.
- No use of dangerous triggers (`pull_request_target`, `issue_comment`) that could enable privilege escalation.
