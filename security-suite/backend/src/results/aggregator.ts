import { ScannerResult, AggregatedResults, Vulnerability, VulnerabilityCategory, Severity } from '../utils/types.js';

export class ResultsAggregator {

  aggregate(scannerResults: Record<string, ScannerResult>): AggregatedResults {
    const allVulnerabilities: Vulnerability[] = [];
    const scanners: string[] = [];

    // Collect all vulnerabilities from all scanners
    for (const [scannerName, result] of Object.entries(scannerResults)) {
      if (result && result.vulnerabilities) {
        scanners.push(scannerName);
        allVulnerabilities.push(...result.vulnerabilities);
      }
    }

    // Deduplicate vulnerabilities by similarity
    const deduplicatedVulns = this.deduplicateVulnerabilities(allVulnerabilities);

    // Sort by severity
    const severityOrder: Record<Severity, number> = {
      'critical': 0,
      'high': 1,
      'medium': 2,
      'low': 3,
      'info': 4
    };

    deduplicatedVulns.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Calculate severity counts
    const severityCounts = {
      critical: deduplicatedVulns.filter(v => v.severity === 'critical').length,
      high: deduplicatedVulns.filter(v => v.severity === 'high').length,
      medium: deduplicatedVulns.filter(v => v.severity === 'medium').length,
      low: deduplicatedVulns.filter(v => v.severity === 'low').length,
      info: deduplicatedVulns.filter(v => v.severity === 'info').length
    };

    // Calculate category counts
    const categoryCounts = this.calculateCategoryCounts(deduplicatedVulns);

    // Calculate risk score (0-100)
    const riskScore = this.calculateRiskScore(severityCounts);

    // Generate recommendations
    const recommendations = this.generateRecommendations(deduplicatedVulns, categoryCounts);

    return {
      timestamp: Date.now(),
      scanners,
      totalVulnerabilities: deduplicatedVulns.length,
      severityCounts,
      categoryCounts,
      allVulnerabilities: deduplicatedVulns,
      scannerResults,
      riskScore,
      recommendations
    };
  }

  private deduplicateVulnerabilities(vulnerabilities: Vulnerability[]): Vulnerability[] {
    const seen = new Map<string, Vulnerability>();

    for (const vuln of vulnerabilities) {
      // Create a key based on location and type
      const key = `${vuln.title}:${vuln.location.file}:${vuln.location.line || 0}`;

      if (!seen.has(key)) {
        seen.set(key, vuln);
      } else {
        // Keep the higher severity one
        const existing = seen.get(key)!;
        const severityOrder: Record<Severity, number> = {
          'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4
        };

        if (severityOrder[vuln.severity] < severityOrder[existing.severity]) {
          seen.set(key, vuln);
        }
      }
    }

    return Array.from(seen.values());
  }

  private calculateCategoryCounts(vulnerabilities: Vulnerability[]): Record<VulnerabilityCategory, number> {
    const counts: Record<VulnerabilityCategory, number> = {
      'account-validation': 0,
      'arithmetic': 0,
      'access-control': 0,
      'economic-attacks': 0,
      'reentrancy': 0,
      'state-manipulation': 0,
      'input-validation': 0,
      'dos-attacks': 0,
      'api-security': 0,
      'authentication': 0,
      'authorization': 0
    };

    for (const vuln of vulnerabilities) {
      if (counts[vuln.category] !== undefined) {
        counts[vuln.category]++;
      }
    }

    return counts;
  }

  private calculateRiskScore(severityCounts: Record<Severity, number>): number {
    // Weight: Critical=40, High=25, Medium=10, Low=3, Info=1
    const weights = {
      critical: 40,
      high: 25,
      medium: 10,
      low: 3,
      info: 1
    };

    let totalScore = 0;
    totalScore += severityCounts.critical * weights.critical;
    totalScore += severityCounts.high * weights.high;
    totalScore += severityCounts.medium * weights.medium;
    totalScore += severityCounts.low * weights.low;
    totalScore += severityCounts.info * weights.info;

    // Cap at 100
    return Math.min(100, totalScore);
  }

  private generateRecommendations(
    vulnerabilities: Vulnerability[],
    categoryCounts: Record<VulnerabilityCategory, number>
  ): string[] {
    const recommendations: string[] = [];

    // Priority recommendations based on severity
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      recommendations.push(
        `🔴 CRITICAL: Address ${criticalVulns.length} critical vulnerabilities immediately before deployment`
      );
    }

    const highVulns = vulnerabilities.filter(v => v.severity === 'high');
    if (highVulns.length > 0) {
      recommendations.push(
        `🟠 HIGH: Review and fix ${highVulns.length} high-severity issues in the next sprint`
      );
    }

    // Category-specific recommendations
    if (categoryCounts['access-control'] > 0) {
      recommendations.push(
        '🔐 Access Control: Review all admin functions and add has_one constraints'
      );
    }

    if (categoryCounts['arithmetic'] > 0) {
      recommendations.push(
        '🔢 Arithmetic: Replace all basic arithmetic with checked_* or saturating_* methods'
      );
    }

    if (categoryCounts['account-validation'] > 0) {
      recommendations.push(
        '📋 Account Validation: Add Account<T> wrappers and verify PDA derivations'
      );
    }

    if (categoryCounts['economic-attacks'] > 0) {
      recommendations.push(
        '💰 Economic Security: Implement withdrawal patterns and lock fees at creation'
      );
    }

    if (categoryCounts['input-validation'] > 0) {
      recommendations.push(
        '📝 Input Validation: Add require! checks for all user inputs'
      );
    }

    if (categoryCounts['dos-attacks'] > 0) {
      recommendations.push(
        '🛡️ DoS Prevention: Add limits to loops and collections'
      );
    }

    if (categoryCounts['authentication'] > 0 || categoryCounts['authorization'] > 0) {
      recommendations.push(
        '🔑 API Security: Implement proper authentication and authorization checks'
      );
    }

    // General recommendations
    if (vulnerabilities.length > 10) {
      recommendations.push(
        '📊 Consider a professional security audit given the number of findings'
      );
    }

    recommendations.push(
      '✅ Write comprehensive unit tests for all identified vulnerability patterns'
    );

    recommendations.push(
      '📚 Document all security assumptions and invariants in the code'
    );

    return recommendations;
  }

  // Generate summary for quick overview
  getSummary(results: AggregatedResults): string {
    const riskLevel = this.getRiskLevel(results.riskScore);

    return `
Security Scan Summary
====================
Risk Score: ${results.riskScore}/100 (${riskLevel})
Total Vulnerabilities: ${results.totalVulnerabilities}

By Severity:
- Critical: ${results.severityCounts.critical}
- High: ${results.severityCounts.high}
- Medium: ${results.severityCounts.medium}
- Low: ${results.severityCounts.low}
- Info: ${results.severityCounts.info}

Scanners Run: ${results.scanners.join(', ')}

Top Recommendations:
${results.recommendations.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
  }

  private getRiskLevel(score: number): string {
    if (score >= 80) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    if (score >= 10) return 'LOW';
    return 'MINIMAL';
  }
}
