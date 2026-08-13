export interface LyricLine {
  time: number
  text: string
}

export interface Lyrics {
  trackId?: string
  synced: boolean
  lines: LyricLine[]
  plain?: string
}
