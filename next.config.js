/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  httpAgentOptions: {
    keepAlive: true,
  },
  experimental: {
    /**
     * Packages that must be `require`d at runtime instead of bundled by webpack.
     *
     * - @react-pdf/renderer: relies on Node built-ins and font loading that do
     *   not survive bundling.
     * - @node-rs/argon2: ships a prebuilt native .node addon. Webpack has no
     *   loader for a compiled binary, so bundling it fails outright.
     * - mongoose: pulls in optional native drivers (kerberos, snappy, aws4) that
     *   webpack tries to resolve even when they are unused.
     *
     * Note: in Next 15 this option moves to the top level and is renamed
     * `serverExternalPackages`. It is correct as-is for Next 14.
     */
    serverComponentsExternalPackages: [
      '@react-pdf/renderer',
      '@node-rs/argon2',
      'mongoose',
    ],
  },
  headers: async () => [
    {
      source: '/:path((?!_next/static|favicon.ico).*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};

module.exports = nextConfig;
