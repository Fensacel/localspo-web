import type { CapacitorConfig } from '@capacitor/cli'

// The app loads the live Next.js server (API routes need a server, so it cannot be
// bundled as static files). Set CAPACITOR_SERVER_URL to the deployed HTTPS domain,
// e.g. https://your-domain.com, before running `npx cap sync`.
const serverUrl = process.env.CAPACITOR_SERVER_URL

const config: CapacitorConfig = {
  appId: 'com.localspo.app',
  appName: 'LocalSpo',
  // Required by Capacitor; the real content is served from server.url.
  webDir: 'capacitor-www',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: false,
      }
    : undefined,
}

export default config
