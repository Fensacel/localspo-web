/**
 * DEPRECATED: Spotify Client Credentials Token Manager
 * Spotify playlist import now uses HTML embed scraping in lib/spotifyExtractor.ts (No Client ID / Secret required).
 */

export async function getAppAccessToken(): Promise<string> {
  throw new Error('Spotify OAuth/Client Credentials is deprecated. Use lib/spotifyExtractor.ts instead.')
}
