import { scoreTrackMatch, normalizeString, stringSimilarity } from '../lib/matcher.ts'

const target = {
  title: 'Lemon Tang (Japanese Ver.)',
  artist: 'Hearts2Hearts',
  durationMs: 163000,
}

const candidate1 = {
  title: 'Lemon Tang (Japanese Ver.)',
  artist: { name: 'Hearts2Hearts' },
  videoId: 'GyvbBYLzGJk',
  duration: 163,
}

const candidate2 = {
  title: 'Lemon Tang',
  artist: { name: 'Hearts2Hearts' },
  videoId: 'BEPSc8q6Bd8',
  duration: 163,
}

console.log('Norm target:', normalizeString(target.title))
console.log('Norm cand1:', normalizeString(candidate1.title))
console.log('Norm cand2:', normalizeString(candidate2.title))

console.log('Score Cand1 (Japanese Ver):', scoreTrackMatch(target, candidate1))
console.log('Score Cand2 (Korean Ver):', scoreTrackMatch(target, candidate2))
