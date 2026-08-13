/**
 * Spotify Client Credentials Token Manager (Server-only)
 * Obtains an app access token without requiring user login.
 * Caches token in memory and auto-refreshes before expiry.
 */

let cachedToken: string | null = null
let tokenExpiresAt = 0

export async function getAppAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables are required for Spotify playlist import. Please configure them in .env.local'
    )
  }

  // Return cached token if valid (with 5-min safety margin)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Failed to obtain Spotify app token: ${response.status} ${errText}`)
  }

  const data = await response.json()
  cachedToken = data.access_token
  // data.expires_in is in seconds (usually 3600)
  tokenExpiresAt = Date.now() + data.expires_in * 1000

  return cachedToken!
}
