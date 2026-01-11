/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'avatars.githubusercontent.com',
      'github.com',
      'raw.githubusercontent.com',
      'opengraph.githubassets.com',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
