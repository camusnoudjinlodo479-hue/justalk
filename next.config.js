/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // face-api.js relies on these node-only fields not being bundled client-side
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, encoding: false };
    return config;
  },
};

module.exports = nextConfig;
