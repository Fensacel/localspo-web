import YTMusic from 'ytmusic-api'

async function run() {
  const client = new YTMusic()
  await client.initialize()

  const queries = [
    'Lemon Tang Hearts2Hearts',
    'Lemon Tang (Japanese Ver.) Hearts2Hearts',
    'Hearts2Hearts Lemon Tang',
  ]

  for (const q of queries) {
    console.log('\n--- SEARCHING:', q)
    const songs = await client.searchSongs(q)
    console.log('Results count:', songs.length)
    songs.slice(0, 5).forEach((s, idx) => {
      console.log(`[${idx}]`, {
        name: s.name,
        artist: s.artist?.name || s.artists?.[0]?.name,
        videoId: s.videoId,
        duration: s.duration,
      })
    })
  }
}

run().catch(console.error)
