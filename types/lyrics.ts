export interface LyricLine {
  time: number
  text: string
  romanizedText?: string
}

export interface Lyrics {
  trackId?: string
  synced: boolean
  lines: LyricLine[]
  plain?: string
}
