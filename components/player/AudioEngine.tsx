'use client'

import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { createClient } from '@/lib/supabase/client'

const isDev = process.env.NODE_ENV === 'development'

function log(...args: unknown[]) {
  if (isDev) console.log('[AudioEngine]', ...args)
}

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasLoggedHistoryRef = useRef<boolean>(false)
  const {
    currentTrack,
    isPlaying,
    seekTo,
    volume,
    muted,
    repeat,
    next,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setIsLoading,
    clearSeek,
  } = usePlayerStore()

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'metadata'
    }
    const audio = audioRef.current

    function onTimeUpdate() {
      setCurrentTime(audio.currentTime)

      // Record history once per track when playback reaches 5s
      if (audio.currentTime >= 5 && !hasLoggedHistoryRef.current) {
        hasLoggedHistoryRef.current = true
        const track = usePlayerStore.getState().currentTrack
        if (track) {
          try {
            const stored = JSON.parse(localStorage.getItem('localspo_history') || '[]')
            const entry = {
              ...track,
              track_id: track.id,
              played_at: new Date().toISOString(),
              duration: audio.duration || track.duration || 0,
              progress: audio.currentTime,
            }
            const updated = [entry, ...stored.filter((e: { id?: string }) => e.id !== track.id)].slice(0, 100)
            localStorage.setItem('localspo_history', JSON.stringify(updated))
          } catch {}

          const supabase = createClient()
          supabase.auth.getSession().then(({ data: { session } }) => {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`
            }
            fetch('/api/history', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                track,
                progress: audio.currentTime,
                duration: audio.duration || track.duration || 0,
              }),
            })
              .then((res) => res.json())
              .then((res) => log('History logged response:', res))
              .catch((err) => log('Failed to log play history:', err))
          })
        }
      }
    }
    function onLoadedMetadata() {
      setDuration(audio.duration || 0)
      setIsLoading(false)
      log('loadedmetadata, duration:', audio.duration)
    }
    function onPlay() { setIsPlaying(true) }
    function onPause() { setIsPlaying(false) }
    function onEnded() {
      log('ended')
      if (repeat === 'one') {
        audio.currentTime = 0
        audio.play().catch(log)
      } else {
        next()
      }
    }
    function onWaiting() { setIsLoading(true) }
    function onPlaying() { setIsLoading(false) }
    function onError() {
      const err = audio.error
      log('audio error:', err?.code, err?.message)
      setIsLoading(false)
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('error', onError)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat])

  // Load new track when currentTrack changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack?.videoId) return
    const audio = audioRef.current

    hasLoggedHistoryRef.current = false
    const streamUrl = `/api/stream/${currentTrack.videoId}`
    log('Loading track:', currentTrack.title, 'url:', streamUrl)

    setIsLoading(true)
    audio.src = streamUrl
    audio.load()

    // isPlaying is true when play() is called — attempt autoplay
    const { isPlaying: shouldPlay } = usePlayerStore.getState()
    if (shouldPlay) {
      audio.play().catch((err) => {
        log('autoplay blocked:', err)
        setIsPlaying(false)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.videoId])

  // Sync play/pause from store
  useEffect(() => {
    if (!audioRef.current) return
    const audio = audioRef.current

    if (isPlaying) {
      if (audio.src && audio.src !== window.location.href) {
        audio.play().catch((err) => {
          log('play failed:', err)
          setIsPlaying(false)
        })
      }
    } else {
      audio.pause()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // Handle explicit seek via seekTo field
  useEffect(() => {
    if (!audioRef.current || seekTo === null) return
    const audio = audioRef.current
    log('seeking to:', seekTo)
    audio.currentTime = seekTo
    clearSeek()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo])

  // Sync volume/mute
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
    audioRef.current.muted = muted
  }, [volume, muted])

  return null // No DOM output
}
