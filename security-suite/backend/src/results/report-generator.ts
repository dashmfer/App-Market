import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SuiteConfig, resolveReportsPath } from '../utils/config.js';
import { AggregatedResults, Vulnerability, Severity } from '../utils/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ReportGenerator {
  private config: SuiteConfig;
  private reportsPath: string;

  constructor(config: SuiteConfig) {
    this.config = config;
    this.reportsPath = resolveReportsPath(config);

    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsPath)) {
      fs.mkdirSync(this.reportsPath, { recursive: true });
    }
  }

  async generatePDF(results: AggregatedResults): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: 'Solana Smart Contract Security Report',
          Author: 'Security Testing Suite',
          Subject: 'Security Analysis Results'
        }
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Generate PDF content
      this.generatePDFContent(doc, results);

      doc.end();
    });
  }

  private generatePDFContent(doc: PDFKit.PDFDocument, results: AggregatedResults) {
    const colors = {
      critical: '#DC2626',
      high: '#EA580C',
      medium: '#D97706',
      low: '#2563EB',
      info: '#6B7280',
      primary: '#1E40AF',
      text: '#1F2937',
      lightGray: '#F3F4F6'
    };

    // Title Page
    doc.fontSize(32)
      .fillColor(colors.primary)
      .text('Security Analysis Report', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(18)
      .fillColor(colors.text)
      .text('Solana Smart Contract Security Testing Suite', { align: 'center' });

    doc.moveDown(2);
    doc.fontSize(12)
      .text(`Generated: ${new Date(results.timestamp).toLocaleString()}`, { align: 'center' });

    doc.moveDown(0.5);
    doc.text(`Scanners: ${results.scanners.join(', ')}`, { align: 'center' });

    // Risk Score Circle
    doc.moveDown(3);
    const riskLevel = this.getRiskLevel(results.riskScore);
    const riskColor = this.getRiskColor(riskLevel, colors);

    doc.fontSize(48)
      .fillColor(riskColor)
      .text(`${results.riskScore}`, { align: 'center' });

    doc.fontSize(14)
      .text(`Risk Score: ${riskLevel}`, { align: 'center' });

    // Executive Summary
    doc.addPage();
    doc.fontSize(24)
      .fillColor(colors.primary)
      .text('Executive Summary');

    doc.moveDown(1);
    doc.fontSize(12)
      .fillColor(colors.text);

    // Severity breakdown
    doc.text(`Total Vulnerabilities Found: ${results.totalVulnerabilities}`);
    doc.moveDown(0.5);

    const severities: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

    for (const severity of severities) {
      const count = results.severityCounts[severity];
      const color = colors[severity];

      doc.fillColor(color)
        .text(`  ${severity.toUpperCase()}: ${count}`, { continued: false });
    }

    doc.fillColor(colors.text);

    // Recommendations
    doc.moveDown(2);
    doc.fontSize(18)
      .fillColor(colors.primary)
      .text('Key Recommendations');

    doc.moveDown(0.5);
    doc.fontSize(11)
      .fillColor(colors.text);

    for (const rec of results.recommendations) {
      doc.text(`• ${rec.replace(/[🔴🟠🟡🔵🟢🔐🔢📋💰📝🛡️🔑📊✅📚]/g, '')}`, {
        width: 500
      });
      doc.moveDown(0.3);
    }

    // Detailed Findings
    doc.addPage();
    doc.fontSize(24)
      .fillColor(colors.primary)
      .text('Detailed Findings');

    doc.moveDown(1);

    // Group vulnerabilities by severity
    for (const severity of severities) {
      const vulns = results.allVulnerabilities.filter(v => v.severity === severity);

      if (vulns.length === 0) continue;

      doc.fontSize(16)
        .fillColor(colors[severity])
        .text(`${severity.toUpperCase()} (${vulns.length})`, { underline: true });

      doc.moveDown(0.5);

      for (let i = 0; i < vulns.length; i++) {
        const vuln = vulns[i];

        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        doc.fontSize(12)
          .fillColor(colors.text)
          .text(`${i + 1}. ${vuln.title}`, { continued: false });

        doc.moveDown(0.2);
        doc.fontSize(10)
          .fillColor('#4B5563')
          .text(`Category: ${vuln.category}`);

        doc.text(`Location: ${vuln.location.file}${vuln.location.line ? `:${vuln.location.line}` : ''}`);

        if (vuln.location.function) {
          doc.text(`Function: ${vuln.location.function}`);
        }

        doc.moveDown(0.2);
        doc.fontSize(10)
          .fillColor(colors.text)
          .text(vuln.description, { width: 500 });

        if (vuln.recommendation) {
          doc.moveDown(0.2);
          doc.fontSize(10)
            .fillColor(colors.primary)
            .text(`Recommendation: ${vuln.recommendation}`, { width: 500 });
        }

        if (vuln.codeSnippet) {
          doc.moveDown(0.3);
          doc.fontSize(8)
            .fillColor('#6B7280')
            .font('Courier')
            .text(vuln.codeSnippet.substring(0, 300) + (vuln.codeSnippet.length > 300 ? '...' : ''), {
              width: 500
            })
            .font('Helvetica');
        }

        doc.moveDown(0.8);
      }

      doc.moveDown(0.5);
    }

    // Category Analysis
    doc.addPage();
    doc.fontSize(24)
      .fillColor(colors.primary)
      .text('Category Analysis');

    doc.moveDown(1);

    const categoryDescriptions: Record<string, string> = {
      'account-validation': 'Issues with account ownership, PDA verification, and signer checks',
      'arithmetic': 'Integer overflow/underflow and precision issues',
      'access-control': 'Missing or improper access controls on sensitive functions',
      'economic-attacks': 'Potential for financial manipulation or fund extraction',
      'reentrancy': 'Unsafe external calls that could allow reentrancy',
      'state-manipulation': 'Improper state management and transitions',
      'input-validation': 'Missing or insufficient input validation',
      'dos-attacks': 'Denial of service vulnerabilities',
      'api-security': 'API endpoint security issues',
      'authentication': 'Authentication bypass or weaknesses',
      'authorization': 'Authorization bypass or weaknesses'
    };

    doc.fontSize(11)
      .fillColor(colors.text);

    for (const [category, count] of Object.entries(results.categoryCounts)) {
      if (count > 0) {
        doc.fontSize(12)
          .fillColor(colors.primary)
          .text(`${category}: ${count} issues`);

        doc.fontSize(10)
          .fillColor('#4B5563')
          .text(categoryDescriptions[category] || 'No description available');

        doc.moveDown(0.5);
      }
    }

    // Scanner Results Summary
    doc.addPage();
    doc.fontSize(24)
      .fillColor(colors.primary)
      .text('Scanner Results');

    doc.moveDown(1);

    for (const [scanner, result] of Object.entries(results.scannerResults)) {
      if (!result) continue;

      doc.fontSize(14)
        .fillColor(colors.text)
        .text(scanner, { underline: true });

      doc.moveDown(0.3);
      doc.fontSize(10)
        .text(`Status: ${result.status}`);
      doc.text(`Duration: ${result.duration}ms`);
      doc.text(`Findings: ${result.vulnerabilities?.length || 0}`);

      if (result.metadata) {
        doc.fontSize(9)
          .fillColor('#6B7280');

        for (const [key, value] of Object.entries(result.metadata)) {
          if (typeof value === 'string' || typeof value === 'number') {
            doc.text(`${key}: ${value}`);
          }
        }
      }

      doc.moveDown(1);
    }

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Footer
      doc.fontSize(8)
        .fillColor('#9CA3AF')
        .text(
          `Solana Security Testing Suite | Page ${i + 1} of ${pages.count}`,
          50,
          doc.page.height - 30,
          { align: 'center', width: doc.page.width - 100 }
        );
    }
  }

  private getRiskLevel(score: number): string {
    if (score >= 80) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    if (score >= 10) return 'LOW';
    return 'MINIMAL';
  }

  private getRiskColor(level: string, colors: Record<string, string>): string {
    switch (level) {
      case 'CRITICAL': return colors.critical;
      case 'HIGH': return colors.high;
      case 'MEDIUM': return colors.medium;
      case 'LOW': return colors.low;
      default: return colors.info;
    }
  }

  // Save report to file
  async saveReport(results: AggregatedResults, format: 'pdf' | 'json' | 'html' = 'pdf'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `security-report-${timestamp}.${format}`;
    const filepath = path.join(this.reportsPath, filename);

    switch (format) {
      case 'pdf':
        const pdfBuffer = await this.generatePDF(results);
        fs.writeFileSync(filepath, pdfBuffer);
        break;

      case 'json':
        fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
        break;

      case 'html':
        const html = this.generateHTML(results);
        fs.writeFileSync(filepath, html);
        break;
    }

    return filepath;
  }

  private generateHTML(results: AggregatedResults): string {
    const severityColors: Record<Severity, string> = {
      critical: '#DC2626',
      high: '#EA580C',
      medium: '#D97706',
      low: '#2563EB',
      info: '#6B7280'
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Analysis Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; background: #F9FAFB; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #1E40AF; font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { color: #1E40AF; font-size: 1.5rem; margin: 2rem 0 1rem; border-bottom: 2px solid #E5E7EB; padding-bottom: 0.5rem; }
    .risk-score { display: flex; align-items: center; gap: 2rem; margin: 2rem 0; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .score-circle { width: 120px; height: 120px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: bold; color: white; }
    .severity-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin: 1rem 0; }
    .severity-card { padding: 1rem; border-radius: 0.5rem; text-align: center; color: white; }
    .severity-count { font-size: 2rem; font-weight: bold; }
    .vuln-card { background: white; border-radius: 0.5rem; padding: 1.5rem; margin: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 4px solid; }
    .vuln-card.critical { border-color: ${severityColors.critical}; }
    .vuln-card.high { border-color: ${severityColors.high}; }
    .vuln-card.medium { border-color: ${severityColors.medium}; }
    .vuln-card.low { border-color: ${severityColors.low}; }
    .vuln-card.info { border-color: ${severityColors.info}; }
    .vuln-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
    .vuln-meta { font-size: 0.875rem; color: #6B7280; margin-bottom: 0.5rem; }
    .vuln-desc { margin-bottom: 0.5rem; }
    .vuln-rec { color: #1E40AF; font-style: italic; }
    code { background: #F3F4F6; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
    .rec-list { background: white; padding: 1.5rem; border-radius: 0.5rem; margin: 1rem 0; }
    .rec-item { padding: 0.5rem 0; border-bottom: 1px solid #E5E7EB; }
    .rec-item:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Security Analysis Report</h1>
    <p>Generated: ${new Date(results.timestamp).toLocaleString()}</p>
    <p>Scanners: ${results.scanners.join(', ')}</p>

    <div class="risk-score">
      <div class="score-circle" style="background: ${this.getRiskColor(this.getRiskLevel(results.riskScore), severityColors as any)}">
        ${results.riskScore}
      </div>
      <div>
        <h3>Risk Score: ${this.getRiskLevel(results.riskScore)}</h3>
        <p>Total Vulnerabilities: ${results.totalVulnerabilities}</p>
      </div>
    </div>

    <h2>Severity Breakdown</h2>
    <div class="severity-grid">
      ${(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map(s => `
        <div class="severity-card" style="background: ${severityColors[s]}">
          <div class="severity-count">${results.severityCounts[s]}</div>
          <div>${s.toUpperCase()}</div>
        </div>
      `).join('')}
    </div>

    <h2>Key Recommendations</h2>
    <div class="rec-list">
      ${results.recommendations.map(r => `<div class="rec-item">${r}</div>`).join('')}
    </div>

    <h2>Detailed Findings</h2>
    ${results.allVulnerabilities.map(v => `
      <div class="vuln-card ${v.severity}">
        <div class="vuln-title">${v.title}</div>
        <div class="vuln-meta">
          <strong>Severity:</strong> ${v.severity.toUpperCase()} |
          <strong>Category:</strong> ${v.category} |
          <strong>Location:</strong> <code>${v.location.file}${v.location.line ? ':' + v.location.line : ''}</code>
          ${v.location.function ? '| <strong>Function:</strong> <code>' + v.location.function + '</code>' : ''}
        </div>
        <div class="vuln-desc">${v.description}</div>
        ${v.recommendation ? `<div class="vuln-rec">💡 ${v.recommendation}</div>` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>
`;
  }
}
