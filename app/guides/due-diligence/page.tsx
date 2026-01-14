import { AlertTriangle, CheckCircle, FileCode, Shield, TrendingUp } from "lucide-react";

export default function DueDiligencePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Due Diligence Guide
            </h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              A comprehensive checklist for evaluating projects before purchase
            </p>
          </div>

          {/* Code Review */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <FileCode className="w-8 h-8 text-blue-500 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Code Quality Review</h2>
                <p className="text-zinc-600 dark:text-zinc-400">Essential checks for evaluating the codebase</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                {
                  title: "Architecture & Structure",
                  checks: [
                    "Code is well-organized with clear folder structure",
                    "Follows best practices for the framework/language used",
                    "Separation of concerns (frontend, backend, database)",
                    "Modular and maintainable code structure",
                  ],
                },
                {
                  title: "Code Quality",
                  checks: [
                    "Clean, readable code with consistent style",
                    "Meaningful variable and function names",
                    "No obvious code smells or anti-patterns",
                    "Type safety (TypeScript, etc.) if applicable",
                  ],
                },
                {
                  title: "Documentation",
                  checks: [
                    "README with setup instructions",
                    "Code comments for complex logic",
                    "API documentation if applicable",
                    "Environment variables documented",
                  ],
                },
                {
                  title: "Dependencies",
                  checks: [
                    "Dependencies are up-to-date and secure",
                    "No critical security vulnerabilities",
                    "Reasonable number of dependencies",
                    "License compatibility checked",
                  ],
                },
              ].map((section, idx) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">{section.title}</h3>
                  <div className="space-y-2">
                    {section.checks.map((check, checkIdx) => (
                      <div key={checkIdx} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{check}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Business Metrics */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <TrendingUp className="w-8 h-8 text-green-500 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Business Metrics Verification</h2>
                <p className="text-zinc-600 dark:text-zinc-400">How to validate claimed metrics and performance</p>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Traffic & Users</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-zinc-500 mt-1">•</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Request Google Analytics screenshots (last 90 days)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-zinc-500 mt-1">•</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Verify traffic quality (not bot traffic)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-zinc-500 mt-1">•</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Check user engagement metrics (bounce rate, session duration)
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Revenue (if monetized)</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-zinc-500 mt-1">•</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Request Stripe/payment processor screenshots
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-zinc-500 mt-1">•</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Understand revenue model and sustainability
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-zinc-500 mt-1">•</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Check for revenue consistency over time
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Social Proof</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-zinc-500 mt-1">•</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Check GitHub stars, forks, and recent activity
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-zinc-500 mt-1">•</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Review social media following and engagement
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-zinc-500 mt-1">•</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Look for reviews, testimonials, or press mentions
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <Shield className="w-8 h-8 text-purple-500 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Security Assessment</h2>
                <p className="text-zinc-600 dark:text-zinc-400">Critical security checks before purchasing</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                "Run npm audit or equivalent for dependency vulnerabilities",
                "Check for exposed API keys or secrets in code history",
                "Verify authentication and authorization implementation",
                "Review database security (SQL injection prevention, etc.)",
                "Check for proper input validation and sanitization",
                "Verify HTTPS and secure communication",
                "Review permission models and access control",
                "Check for outdated or vulnerable dependencies",
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Shield className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Red Flags */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Critical Red Flags</h2>
                <p className="text-zinc-600 dark:text-zinc-400">Warning signs that should make you reconsider</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                "Seller refuses to provide verifiable metrics or evidence",
                "Code repository has very few commits or suspicious history",
                "No working demo or the demo doesn't match description",
                "Seller is evasive or slow to answer questions",
                "Critical dependencies are deprecated or abandoned",
                "No documentation or extremely poor code quality",
                "Metrics seem too good to be true without proof",
                "Legal issues, copyright violations, or licensing problems",
                "Seller has negative reviews or dispute history",
                "Incomplete asset list or unclear what's included",
              ].map((flag, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-900 dark:text-red-100">{flag}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Final Checklist */}
          <section className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Final Pre-Purchase Checklist</h2>
            <div className="space-y-3">
              {[
                "All code reviewed and quality is acceptable",
                "Metrics verified with screenshots or access",
                "Security audit completed with no major issues",
                "All included assets clearly documented",
                "Seller responsive and transparent",
                "Price is fair based on metrics and quality",
                "Transfer process is clear and agreed upon",
                "You understand what you're getting",
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 w-5 h-5 rounded border-green-300 text-green-600 focus:ring-green-500"
                    id={`check-${idx}`}
                  />
                  <label htmlFor={`check-${idx}`} className="text-zinc-900 dark:text-zinc-100 cursor-pointer">
                    {item}
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 rounded-lg">
              <p className="text-sm text-green-900 dark:text-green-100">
                <strong>Remember:</strong> Take your time with due diligence. A thorough review now prevents problems later.
                If anything seems off, don't hesitate to walk away or negotiate.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
