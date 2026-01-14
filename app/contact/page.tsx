import { Mail, MessageSquare, Twitter } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Get in Touch</h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              We're here to help with any questions or concerns
            </p>
          </div>

          {/* Contact Methods */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <a
              href="mailto:support@appmarket.xyz"
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 hover:border-green-500 dark:hover:border-green-500 transition-colors"
            >
              <Mail className="w-8 h-8 text-green-500 mb-3" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Email Support</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                For general inquiries and support questions
              </p>
              <p className="text-green-600 dark:text-green-400 font-medium">support@appmarket.xyz</p>
            </a>

            <a
              href="https://twitter.com/appmarketxyz"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 hover:border-green-500 dark:hover:border-green-500 transition-colors"
            >
              <Twitter className="w-8 h-8 text-blue-500 mb-3" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Twitter</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Follow us for updates and announcements
              </p>
              <p className="text-green-600 dark:text-green-400 font-medium">@appmarketxyz</p>
            </a>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <MessageSquare className="w-8 h-8 text-purple-500 mb-3" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Discord Community</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Join our community for real-time help
              </p>
              <p className="text-zinc-500 text-sm">Coming Soon</p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Send Us a Message</h2>
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Subject
                </label>
                <select className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-green-500 focus:border-transparent">
                  <option>General Inquiry</option>
                  <option>Technical Support</option>
                  <option>Billing Question</option>
                  <option>Report a Problem</option>
                  <option>Feature Request</option>
                  <option>Partnership Opportunity</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Message
                </label>
                <textarea
                  rows={6}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Tell us how we can help..."
                />
              </div>

              <button type="submit" className="btn-primary w-full md:w-auto">
                Send Message
              </button>
            </form>
            <p className="text-sm text-zinc-500 mt-6">
              We typically respond within 24 hours during business days.
            </p>
          </div>

          {/* FAQ Section */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Common Questions</h2>
            <div className="space-y-6">
              {[
                {
                  q: "How long does it take to get a response?",
                  a: "We aim to respond to all inquiries within 24 hours during business days. For urgent issues, please mention 'URGENT' in the subject line.",
                },
                {
                  q: "What information should I include in a support request?",
                  a: "Please include your account email, a detailed description of the issue, any error messages, and screenshots if applicable. The more details you provide, the faster we can help.",
                },
                {
                  q: "Do you offer phone support?",
                  a: "Currently, we only offer email and chat support. This allows us to provide better documentation and faster response times for most issues.",
                },
                {
                  q: "Can I request a feature?",
                  a: "Absolutely! We love hearing from our community. Send us your feature ideas and we'll consider them for future updates.",
                },
                {
                  q: "How do I report a security issue?",
                  a: "For security vulnerabilities, please email security@appmarket.xyz with details. We take security seriously and will respond promptly.",
                },
              ].map((faq, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{faq.q}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Office Info */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Company Information</h2>
            <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">App Market, Inc.</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Remote-first company</p>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Email</h3>
                <p className="text-sm">
                  General: <a href="mailto:hello@appmarket.xyz" className="text-green-600 dark:text-green-400 hover:underline">hello@appmarket.xyz</a>
                </p>
                <p className="text-sm">
                  Support: <a href="mailto:support@appmarket.xyz" className="text-green-600 dark:text-green-400 hover:underline">support@appmarket.xyz</a>
                </p>
                <p className="text-sm">
                  Security: <a href="mailto:security@appmarket.xyz" className="text-green-600 dark:text-green-400 hover:underline">security@appmarket.xyz</a>
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Business Hours</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Monday - Friday, 9:00 AM - 6:00 PM EST</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
