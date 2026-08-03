import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['vaforta.localhost', 'admin.vaforta.localhost'],
  output: 'standalone',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    await Promise.resolve();
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
