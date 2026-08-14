import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'LocalSpo — Free Music Player',
    short_name: 'LocalSpo',
    description: 'Listen to your favorite music, playlists, and synchronized lyrics anywhere without ads.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#050505',
    theme_color: '#050505',
    categories: ['music', 'entertainment'],
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
