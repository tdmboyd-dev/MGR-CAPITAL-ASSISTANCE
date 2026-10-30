/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'capitalmgr.com' },
      { protocol: 'https', hostname: 'api.capitalmgr.com' },
    ],
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      // API proxy to backend
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // Short URL aliases for auth pages
      {
        source: '/login',
        destination: '/auth/login',
      },
      {
        source: '/register',
        destination: '/auth/register',
      },
      {
        source: '/forgot-password',
        destination: '/auth/forgot-password',
      },
    ];
  },
};

module.exports = nextConfig;
