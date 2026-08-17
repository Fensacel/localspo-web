import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },

  // These packages use native binaries / dynamic requires incompatible with Turbopack bundling.
  // Mark them as external so Next.js loads them via Node's require() at runtime.
  serverExternalPackages: [
    '@distube/ytdl-core',
    'ytsr',
    'ytmusic-api',
  ],

  images: {
    remotePatterns: [
      // YouTube / YouTube Music thumbnails
      { protocol: 'https', hostname: '**.ytimg.com' },
      { protocol: 'https', hostname: '**.ggpht.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'yt3.googleusercontent.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      // Spotify CDNs
      { protocol: 'https', hostname: '**.scdn.co' },
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'mosaic.scdn.co' },
      { protocol: 'https', hostname: 'thisis-images.scdn.co' },
      { protocol: 'https', hostname: '**.spotifycdn.com' },
      // Supabase Storage
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
    ],
  },
};

export default nextConfig;
