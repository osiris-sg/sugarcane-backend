const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // Manual registration for better iOS support
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerDir: 'worker',
  runtimeCaching: [
    // Google Fonts - cache for 1 year
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
    // Font assets - cache for 1 week
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
        },
      },
    },
    // Images - cache for 1 day
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
    // Next.js images - cache for 1 day
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
    // JavaScript assets - cache for 1 day
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
    // CSS/LESS assets - cache for 1 day
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
    // Next.js data - cache for 1 day
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
    // API calls - NetworkFirst with timeout
    {
      urlPattern: /\/api\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
    // Everything else - NetworkFirst
    {
      urlPattern: /.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['img.clerk.com'],
  },
};

module.exports = withPWA(nextConfig);
