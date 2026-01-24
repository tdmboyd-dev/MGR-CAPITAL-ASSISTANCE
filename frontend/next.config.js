/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      // API proxy to backend
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
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
