/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'opengraph.githubassets.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/profile-pictures/**',  // Restrict to profile images only
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            // Prevent clickjacking - only allow framing from same origin
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            // Prevent MIME type sniffing
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Enable XSS filter in older browsers
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            // Control referrer information
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Enforce HTTPS
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            // Prevent loading in Adobe products
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            // Content Security Policy
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Allow scripts from self and inline (needed for Next.js)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Allow styles from self and inline
              "style-src 'self' 'unsafe-inline'",
              // Allow images from approved sources
              "img-src 'self' data: blob: https://avatars.githubusercontent.com https://github.com https://raw.githubusercontent.com https://opengraph.githubassets.com https://*.public.blob.vercel-storage.com",
              // Allow fonts from self
              "font-src 'self' data:",
              // Allow connections to self and required APIs
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mainnet-beta.solana.com https://api.devnet.solana.com wss://api.mainnet-beta.solana.com wss://api.devnet.solana.com https://*.helius-rpc.com https://*.vercel-storage.com",
              // Allow frames for wallet connections
              "frame-src 'self' https://phantom.app https://solflare.com",
              // No plugins/objects
              "object-src 'none'",
              // Form submissions only to self
              "form-action 'self'",
              // Only upgrade insecure requests in production
              "upgrade-insecure-requests",
            ].join('; '),
          },
          {
            // Permissions Policy - disable unnecessary browser features
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
