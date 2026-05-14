const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Disable the client-side router cache so admin/dashboard list views
    // re-fetch on navigation. Without this, navigating back to a list
    // shows a stale prefetched RSC payload until the user hard-reloads.
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
};

const enableSentry =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

module.exports = enableSentry
  ? withSentryConfig(nextConfig, {
      silent: true,
      hideSourceMaps: true,
      disableLogger: true,
      tunnelRoute: "/monitoring",
    })
  : nextConfig;
