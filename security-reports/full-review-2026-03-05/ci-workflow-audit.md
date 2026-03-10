# CI/CD Workflow Security Audit

**Repository:** App-Market
**Date:** 2026-03-05
**Scope:** All GitHub Actions workflows in `.github/workflows/`
**Files audited:**
- `.github/workflows/codeql.yml`
- `.github/workflows/snyk.yml`
- `.github/workflows/trivy.yml`

---

## Executive Summary

Three security-scanning workflows were audited. No expression injection or secrets-leaking vulnerabilities were found. The primary concern is **unpinned third-party actions** -- two actions reference the mutable `@master` tag instead of a commit SHA, which exposes the pipeline to supply-chain attacks. Permissions are scoped reasonably but could be tightened further. No AI agent integrations are present.

**Risk rating: MEDIUM** -- driven by unpinned third-party actions.

---

## 1. Expression Injection (`${{ github.event.* }}` in `run:` steps)

**Status: No issues found.**

None of the three workflows use `${{ github.event.* }}` expressions (such as `github.event.pull_request.title`, `github.event.issue.body`, etc.) inside `run:` steps. The only expression interpolations that appear in `run:`-adjacent contexts are:

- `${{ matrix.language }}` -- repository-controlled, not attacker-controlled.
- `${{ secrets.SNYK_TOKEN }}` -- used in `env:` blocks (not inline in shell), which is the correct pattern.

**Verdict: PASS**

---

## 2. Untrusted Input Reaching Shell Commands

**Status: No issues found.**

The only `run:` step across all workflows is:

```yaml
# snyk.yml, line 30
- name: Install dependencies
  run: npm ci
```

This command takes no external input. All other steps use `uses:` action invocations with `with:` parameters, which do not invoke a shell and are therefore not susceptible to shell injection.

**Verdict: PASS**

---

## 3. Over-Permissive Permissions

**Status: Acceptable, with minor observation.**

All three workflows declare job-level permissions:

```yaml
permissions:
  actions: read
  contents: read
  security-events: write
```

- `security-events: write` is required for SARIF upload to GitHub Security and is appropriate.
- `contents: read` is the minimum needed for checkout.
- No workflow requests `contents: write`, `pull-requests: write`, `issues: write`, or other elevated permissions.

**Minor observation:** Permissions are set at the job level, which is correct. However, none of the workflows set a top-level `permissions: {}` block to establish a restrictive default. If new jobs are added without explicit permissions, they would inherit the repository/organization default (often overly broad).

**Recommendation:** Add a top-level `permissions: {}` (empty) at the workflow level in each file, then grant permissions per-job as already done. This is defense-in-depth.

**Verdict: PASS (with recommendation)**

---

## 4. Secrets Exposure in Logs

**Status: No issues found.**

- `SNYK_TOKEN` is passed via `env:` block to the Snyk action, not interpolated in a `run:` shell command. GitHub automatically masks secrets passed through `env:`, and the action consumes the value without echoing it.
- No `run:` steps reference `${{ secrets.* }}` directly.
- No use of `set-output` or `::set-output` that could leak values.
- No `echo` commands that could print secret values.

**Verdict: PASS**

---

## 5. Third-Party Action Pinning

**Status: FAIL -- two actions pinned to mutable `@master` tag.**

| Action | Ref Used | Pinned to SHA? | Risk |
|--------|----------|----------------|------|
| `actions/checkout` | `@v4` | No (tag) | LOW -- first-party GitHub action |
| `actions/setup-node` | `@v4` | No (tag) | LOW -- first-party GitHub action |
| `github/codeql-action/init` | `@v3` | No (tag) | LOW -- first-party GitHub action |
| `github/codeql-action/autobuild` | `@v3` | No (tag) | LOW -- first-party GitHub action |
| `github/codeql-action/analyze` | `@v3` | No (tag) | LOW -- first-party GitHub action |
| `github/codeql-action/upload-sarif` | `@v3` | No (tag) | LOW -- first-party GitHub action |
| **`snyk/actions/node`** | **`@master`** | **No (branch)** | **HIGH** |
| **`aquasecurity/trivy-action`** | **`@master`** | **No (branch)** | **HIGH** |

### Detail

**`snyk/actions/node@master`** (snyk.yml, lines 33 and 60): Pinning to `@master` means any commit pushed to the `master` branch of `snyk/actions` will automatically execute in this repository's CI. If the Snyk Actions repository is compromised, or a maintainer pushes a malicious commit, arbitrary code runs with the workflow's permissions (including `security-events: write` and access to `SNYK_TOKEN`).

**`aquasecurity/trivy-action@master`** (trivy.yml, lines 25 and 41): Same risk as above. A compromised or malicious push to `aquasecurity/trivy-action` master branch would execute in this pipeline.

**Recommendation:** Pin all third-party actions to a full commit SHA. For first-party GitHub actions (`actions/*`, `github/*`), tag pinning (`@v4`, `@v3`) is acceptable but SHA pinning is still preferred. Example:

```yaml
# Instead of:
uses: snyk/actions/node@master
# Use:
uses: snyk/actions/node@<full-commit-sha>  # v1.x.x

# Instead of:
uses: aquasecurity/trivy-action@master
# Use:
uses: aquasecurity/trivy-action@<full-commit-sha>  # v0.x.x
```

Use Dependabot or Renovate to keep SHA pins updated automatically.

**Verdict: FAIL**

---

## 6. Pull Request Target Trigger

**Status: No issues found.**

None of the workflows use the `pull_request_target` trigger. All three use `pull_request`, which checks out the PR's merge commit in a read-only context. This is the safe default -- code from forks cannot access secrets or write permissions beyond what the workflow explicitly grants.

The `pull_request` trigger on `branches: [main, master]` is standard and safe.

**Verdict: PASS**

---

## 7. AI Agent Integrations

**Status: None detected.**

No AI agent actions (e.g., `github/copilot-*`, `openai/*`, `anthropic/*`, `cursor/*`, or similar) are present in any workflow. No LLM API calls, AI-powered code review bots, or automated fix agents are configured.

**Verdict: N/A -- no AI integrations to assess.**

---

## Additional Observations

### 7a. `continue-on-error: true` on Security Scans

Both Snyk steps (snyk.yml, lines 34 and 62) set `continue-on-error: true`. This means the workflow will report success even when vulnerabilities are found. While this is common to avoid blocking PRs on scan results (especially when using SARIF upload for visibility), it means:

- PRs with known vulnerabilities can be merged without any CI failure signal.
- An attacker could introduce vulnerable dependencies and the status check would still pass.

**Recommendation:** Consider using `continue-on-error: false` and instead controlling failure thresholds via the `--severity-threshold` argument, or use branch protection rules that require the SARIF upload to show no critical/high findings.

### 7b. `if: always()` on SARIF Upload Steps

The SARIF upload steps in snyk.yml (lines 42, 69) and trivy.yml (line 35) use `if: always()`. This ensures results are uploaded even if a previous step fails, which is correct behavior for security scanning. However, `if: always()` also means these steps run on cancelled workflows. A more precise condition would be `if: success() || failure()` to skip on cancellation.

### 7c. No Workflow-Level Concurrency Controls

None of the workflows define `concurrency` groups. This means multiple instances of the same workflow can run simultaneously (e.g., rapid pushes to main). This is not a security vulnerability but could lead to race conditions in SARIF uploads or wasted compute.

---

## Summary of Findings

| # | Check | Result | Severity |
|---|-------|--------|----------|
| 1 | Expression injection | PASS | -- |
| 2 | Untrusted input in shell | PASS | -- |
| 3 | Over-permissive permissions | PASS (with recommendation) | INFO |
| 4 | Secrets exposure in logs | PASS | -- |
| 5 | Third-party action pinning | **FAIL** | **HIGH** |
| 6 | Pull request target trigger | PASS | -- |
| 7 | AI agent integrations | N/A | -- |
| -- | `continue-on-error` masking failures | Observation | MEDIUM |
| -- | `if: always()` vs cancellation | Observation | LOW |

---

## Recommended Remediations (Priority Order)

1. **[HIGH] Pin `snyk/actions/node` and `aquasecurity/trivy-action` to commit SHAs.** This is the most impactful change. Reference the SHA of a known-good release and add a comment with the version tag for readability.

2. **[MEDIUM] Re-evaluate `continue-on-error: true`** on Snyk steps. Either remove it and rely on severity thresholds to control exit codes, or ensure branch protection rules independently gate on security findings.

3. **[LOW] Add top-level `permissions: {}`** to each workflow file to enforce least-privilege by default.

4. **[LOW] Replace `if: always()` with `if: success() || failure()`** on SARIF upload steps to avoid running on cancelled workflows.

5. **[LOW] Pin first-party GitHub actions to SHAs** for maximum supply-chain protection, and configure Dependabot/Renovate for automated updates.
