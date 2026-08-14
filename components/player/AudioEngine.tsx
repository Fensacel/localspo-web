'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useLibraryStore } from '@/store/useLibraryStore'
import { pickBestMatch } from '@/lib/playSong'
import { createClient } from '@/lib/supabase/client'
import type { Track } from '@/types/track'
import { preloadAudioStream, preloadSingleSong, isYouTubeVideoId } from '@/lib/queuePreloader'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any
    onYouTubeIframeAPIReady?: () => void
  }
}

const isDev = process.env.NODE_ENV === 'development'

function logAudio(...args: unknown[]) {
  if (isDev) console.log('[AUDIO]', ...args)
}

function logBG(...args: unknown[]) {
  if (isDev) console.log('[BG]', ...args)
}

function logMediaSession(...args: unknown[]) {
  if (isDev) console.log('[MEDIA SESSION]', ...args)
}

function getAbsoluteMediaUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
  }
  return url
}

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ytPlayerRef = useRef<any>(null)
  const isYtReadyRef = useRef<boolean>(false)

  // Generation counter: every track switch increments this.
  // Any async callback checks against this to discard stale work.
  const audioRequestIdRef = useRef<number>(0)

  // Holds the pending play() Promise so we can await it before pause.
  const playPromiseRef = useRef<Promise<void> | null>(null)

  // Set to true while we are in the STOP phase of a track switch,
  // so that the onPause event listener does NOT set isPlaying=false
  // in the store (which would prevent the new track from auto-playing).
  const isSwitchingRef = useRef<boolean>(false)

  // Tracks whether we have already written the play-history entry for
  // the current track (reset on each track change).
  const hasLoggedHistoryRef = useRef<boolean>(false)

  // Throttle for setPositionState — only update at most once per second.
  const lastPositionUpdateRef = useRef<number>(0)

  // The resolved videoId that the audio element currently has as its src.
  // Used to guard the play/pause sync effect against calling play()
  // when the src hasn't been set yet or belongs to a previous track.
  const currentVideoIdRef = useRef<string | null>(null)

  // Current active playback engine: 'html5' (standard stream) or 'yt' (YouTube IFrame bridge)
  const [activeEngine, setActiveEngine] = useState<'html5' | 'yt'>('html5')

  const {
    currentTrack,
    isPlaying,
    seekTo,
    volume,
    muted,
    next,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setIsLoading,
    clearSeek,
  } = usePlayerStore()

  // ─────────────────────────────────────────────────────────────────────────
  // 0. Page Lifecycle / Background Playback Monitor
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => {
      logBG('visibility changed')
      if (document.hidden) {
        logBG('page hidden')
      } else {
        logBG('page visible')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // 1. MediaSession — Action Handlers (registered ONCE on mount, never again)
  //    They delegate to the existing store actions — no new queue logic.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
      logAudio('mediaSession not supported')
      return
    }

    logBG('media session supported')
    logMediaSession('registering action handlers (mount)')

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        logBG('media session play')
        logMediaSession('action: play')
        usePlayerStore.getState().resume()
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        logBG('media session pause')
        logMediaSession('action: pause')
        usePlayerStore.getState().pause()
      })
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        logBG('media session previous')
        logMediaSession('action: previoustrack')
        usePlayerStore.getState().previous()
      })
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        logBG('media session next')
        logMediaSession('action: nexttrack')
        usePlayerStore.getState().next()
      })
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          logMediaSession('action: seekto', details.seekTime)
          usePlayerStore.getState().seek(details.seekTime)
        }
      })
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10
        const current = usePlayerStore.getState().currentTime
        usePlayerStore.getState().seek(Math.max(0, current - offset))
      })
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10
        const current = usePlayerStore.getState().currentTime
        usePlayerStore.getState().seek(current + offset)
      })
      navigator.mediaSession.setActionHandler('stop', () => {
        logBG('media session pause')
        logMediaSession('action: stop')
        usePlayerStore.getState().pause()
      })
    } catch (e) {
      logMediaSession('MediaSession action handler error:', e)
    }

    // No cleanup needed — handlers persist for the app lifetime.
  }, []) // ← intentionally empty: mount-only

  // ─────────────────────────────────────────────────────────────────────────
  // 2. MediaSession — Metadata (updated whenever the track changes)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return
    if (!currentTrack) return

    const artistName =
      typeof currentTrack.artist === 'string'
        ? currentTrack.artist
        : currentTrack.artist?.name || 'LocalSpo'
    const albumName =
      typeof currentTrack.album === 'string'
        ? currentTrack.album
        : currentTrack.album?.name || 'LocalSpo Music'
    const rawArtwork = currentTrack.thumbnail || currentTrack.thumbnailUrl || '/logo.png'
    const artworkUrl = getAbsoluteMediaUrl(rawArtwork)

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: artistName,
        album: albumName,
        artwork: [
          { src: artworkUrl, sizes: '96x96' },
          { src: artworkUrl, sizes: '128x128' },
          { src: artworkUrl, sizes: '192x192' },
          { src: artworkUrl, sizes: '256x256' },
          { src: artworkUrl, sizes: '384x384' },
          { src: artworkUrl, sizes: '512x512' },
        ],
      })
      logBG('media session metadata updated')
      logMediaSession('metadata updated:', currentTrack.title)
    } catch (e) {
      logMediaSession('failed to set metadata:', e)
    }
  }, [currentTrack])

  // ─────────────────────────────────────────────────────────────────────────
  // 3. MediaSession — Playback state (synced from actual isPlaying in store)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    } catch {}
  }, [isPlaying])

  // ─────────────────────────────────────────────────────────────────────────
  // 4. YouTube IFrame API bridge (fallback / direct YT video playback)
  //    Kept as-is from the original implementation.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      document.body.appendChild(tag)
    }

    const initYt = () => {
      if (window.YT && window.YT.Player && !ytPlayerRef.current) {
        try {
          ytPlayerRef.current = new window.YT.Player('yt-hidden-bridge', {
            height: '180',
            width: '240',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              playsinline: 1,
              rel: 0,
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                isYtReadyRef.current = true
                logAudio('YouTube IFrame Engine Bridge Ready')
              },
              onStateChange: (event: { data: number }) => {
                // 1=PLAYING 2=PAUSED 0=ENDED 3=BUFFERING 5=CUED
                if (event.data === 1) {
                  setIsLoading(false)
                } else if (event.data === 0) {
                  logAudio('YouTube player ended track')
                  const currentRepeat = usePlayerStore.getState().repeat
                  if (currentRepeat === 'one') {
                    ytPlayerRef.current?.seekTo(0, true)
                    ytPlayerRef.current?.playVideo()
                  } else {
                    next()
                  }
                } else if (event.data === 3) {
                  setIsLoading(true)
                }
              },
              onError: (err: unknown) => {
                logAudio('YouTube IFrame error:', err)
                setIsLoading(false)
              },
            },
          })
        } catch (e) {
          logAudio('Failed to init YT player:', e)
        }
      }
    }

    if (window.YT && window.YT.Player) {
      initYt()
    } else {
      window.onYouTubeIframeAPIReady = initYt
    }
  }, [next, setIsLoading]) // stable store actions only

  // ─────────────────────────────────────────────────────────────────────────
  // 5. HTML5 Audio Element — Event Listeners
  //
  //    KEY FIX: `currentTrack` is NOT in the dependency array.
  //    Listeners use `usePlayerStore.getState()` to read live state
  //    instead of closed-over stale values.
  //    This prevents listener teardown/re-add on every track change,
  //    which was causing onEnded to fire against wrong closures.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const audio: HTMLAudioElement = el

    function onTimeUpdate() {
      setCurrentTime(audio.currentTime)

      // Sync lock-screen position state (throttled to once/second)
      const now = Date.now()
      if (
        now - lastPositionUpdateRef.current > 1000 &&
        'mediaSession' in navigator &&
        typeof navigator.mediaSession.setPositionState === 'function'
      ) {
        lastPositionUpdateRef.current = now
        try {
          if (audio.duration > 0 && !isNaN(audio.duration) && isFinite(audio.duration)) {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: audio.playbackRate || 1,
              position: Math.min(audio.currentTime, audio.duration),
            })
          }
        } catch {}
      }

      if (audio.currentTime >= 5 && !hasLoggedHistoryRef.current) {
        logHistory(audio.currentTime, audio.duration || usePlayerStore.getState().currentTrack?.duration || 0)
      }
    }

    function onLoadedMetadata() {
      logAudio('loadedmetadata: duration =', audio.duration)
      setDuration(audio.duration || 0)
      setIsLoading(false)

      if ('mediaSession' in navigator && typeof navigator.mediaSession.setPositionState === 'function') {
        try {
          if (audio.duration > 0 && !isNaN(audio.duration) && isFinite(audio.duration)) {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: audio.playbackRate || 1,
              position: audio.currentTime,
            })
          }
        } catch {}
      }
    }

    function onCanPlay() {
      logAudio('canplay event: readyState =', audio.readyState)
      setIsLoading(false)
    }

    function onPlay() {
      logBG('audio playing')
      logAudio('playing confirmed')
      setIsPlaying(true)
      setIsLoading(false)
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'playing' } catch {}
      }

      // Update position state on play event for immediate lock-screen display
      if ('mediaSession' in navigator && typeof navigator.mediaSession.setPositionState === 'function') {
        try {
          if (audio.duration > 0 && !isNaN(audio.duration) && isFinite(audio.duration)) {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: audio.playbackRate || 1,
              position: Math.min(audio.currentTime, audio.duration),
            })
          }
        } catch {}
      }
    }

    function onPause() {
      // KEY FIX: If we are in the middle of a track switch (isSwitchingRef=true),
      // or if an audio error occurred and we are falling back to YouTube IFrame player,
      // this pause was triggered by HTML5 audio failure, NOT the user.
      // Do NOT update the store to false!
      if (isSwitchingRef.current || audio.error) {
        logAudio('pause during track switch or audio error — ignoring store update')
        return
      }
      logBG('audio paused')
      logAudio('paused (user/browser initiated)')
      setIsPlaying(false)
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'paused' } catch {}
      }
    }

    function onEnded() {
      logAudio('ended')
      const currentRepeat = usePlayerStore.getState().repeat
      if (currentRepeat === 'one') {
        audio.currentTime = 0
        const p = audio.play()
        if (p !== undefined) {
          playPromiseRef.current = p
          p.catch((err) => {
            if (err?.name !== 'AbortError') console.error('[AUDIO] Repeat play error:', err)
          })
        }
      } else {
        next()
      }
    }

    function onWaiting() {
      logAudio('waiting for audio chunks')
      setIsLoading(true)
    }

    function onPlaying() {
      logAudio('playing event fired')
      setIsLoading(false)
    }

    function onError() {
      // Ignore errors that fire after we intentionally changed the src
      if (isSwitchingRef.current) return
      const err = audio.error
      const track = usePlayerStore.getState().currentTrack
      logAudio('HTML5 audio stream unavailable for:', track?.title, 'code:', err?.code, 'Switching to YouTube player bridge')

      const vid = currentVideoIdRef.current || track?.videoId
      if (vid && isYtReadyRef.current && ytPlayerRef.current) {
        logAudio('Activating YouTube IFrame player fallback for videoId:', vid)
        setActiveEngine('yt')
        try {
          ytPlayerRef.current.loadVideoById(vid)
          ytPlayerRef.current.playVideo()
          setIsLoading(false)
          setIsPlaying(true)
          return
        } catch (ytErr) {
          logAudio('YT fallback error:', ytErr)
        }
      }

      setIsLoading(false)
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('error', onError)
    }
  // KEY FIX: `currentTrack` removed from deps — listeners read live state
  // via usePlayerStore.getState(). Only stable setters & next() here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, setCurrentTime, setDuration, setIsLoading, setIsPlaying])

  function logHistory(progress: number, duration: number) {
    if (hasLoggedHistoryRef.current) return
    hasLoggedHistoryRef.current = true
    const track = usePlayerStore.getState().currentTrack
    if (!track) return

    try {
      const stored = JSON.parse(localStorage.getItem('localspo_history') || '[]')
      const entry = {
        ...track,
        track_id: track.id,
        played_at: new Date().toISOString(),
        duration,
        progress,
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
        body: JSON.stringify({ track, progress, duration }),
      }).catch((err) => logAudio('Failed to log history:', err))
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Atomic Track Switching: STOP → LOAD → PLAY
  //
  //    KEY FIXES:
  //    - isSwitchingRef prevents spurious onPause from updating the store
  //    - audioRequestIdRef (generation counter) discards stale requests
  //    - Removed lastLoadedTrackIdRef guard (used reqId instead)
  //    - Await pending playPromise before pause to avoid AbortError
  //    - currentVideoIdRef updated only after src is set (guards effect #7)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return

    const audio = audioRef.current
    const reqId = ++audioRequestIdRef.current

    logAudio('loading track:', currentTrack.title, '| reqId:', reqId)

    // ── STOP PHASE ──────────────────────────────────────────────────────────
    // Signal to onPause that this pause is intentional (track switch).
    isSwitchingRef.current = true
    currentVideoIdRef.current = null
    hasLoggedHistoryRef.current = false
    setCurrentTime(0)
    setIsLoading(true)

    async function stopPrevious() {
      if (!audio) return

      // Await the pending play() promise before pausing to avoid AbortError.
      if (playPromiseRef.current) {
        try {
          await playPromiseRef.current
        } catch {
          // Ignore — already handled in the play() .catch()
        }
        playPromiseRef.current = null
      }

      try {
        audio.pause()
        audio.currentTime = 0
      } catch {}
    }

    // Safety timer: if loading takes > 5s, clear loading state.
    const safetyTimer = setTimeout(() => {
      if (reqId === audioRequestIdRef.current) {
        setIsLoading(false)
      }
    }, 5000)

    async function loadTrack() {
      if (!currentTrack) return

      await stopPrevious()

      // ── RESOLVE VIDEO ID ────────────────────────────────────────────────
      let targetVideoId = isYouTubeVideoId(currentTrack.videoId) ? currentTrack.videoId : undefined

      if (!targetVideoId) {
        const libEntry = useLibraryStore.getState().allSongs[currentTrack.id]
        if (isYouTubeVideoId(libEntry?.resolvedVideoId)) {
          targetVideoId = libEntry.resolvedVideoId
        }

        if (!targetVideoId) {
          try {
            const artistName =
              typeof currentTrack.artist === 'string'
                ? currentTrack.artist
                : currentTrack.artist?.name || ''
            const query = `${currentTrack.title} ${artistName}`
            const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=songs`)

            // Discard if a newer request came in
            if (reqId !== audioRequestIdRef.current) {
              logAudio('discarding stale resolution | reqId:', reqId)
              return
            }

            const searchJson = await searchRes.json()
            if (reqId !== audioRequestIdRef.current) return

            const songsList: Track[] = searchJson.data?.songs || []
            const topResult: Track | null = searchJson.data?.topResult?.data || null
            const candidates: Track[] = topResult ? [topResult, ...songsList] : songsList

            const matched = pickBestMatch(candidates, {
              id: currentTrack.id,
              title: currentTrack.title,
              artist: artistName,
              durationMs: (currentTrack.duration || 0) * 1000,
            })

            const bestVideoId = matched?.videoId || matched?.id
            if (bestVideoId && isYouTubeVideoId(bestVideoId)) {
              if (reqId !== audioRequestIdRef.current) return
              targetVideoId = bestVideoId
              useLibraryStore.getState().updateResolvedVideoId(currentTrack.id, bestVideoId)
            }
          } catch (err) {
            console.error('[AudioEngine] Resolution error:', err)
          }
        }
      }

      // Final stale-request check before touching the audio element
      if (reqId !== audioRequestIdRef.current) {
        logAudio('discarding stale load | reqId:', reqId)
        return
      }

      if (!targetVideoId) {
        console.warn('[AudioEngine] Failed to resolve videoId for:', currentTrack.title)
        isSwitchingRef.current = false
        setIsLoading(false)
        const { queue, currentIndex } = usePlayerStore.getState()
        if (queue && queue.length > 0 && currentIndex < queue.length - 1) {
          logAudio('auto-skipping unresolvable track to next in queue')
          next()
        } else {
          setIsPlaying(false)
        }
        return
      }

      // ── LOAD PHASE ──────────────────────────────────────────────────────
      if (audio) {
        const streamUrl = `/api/stream/${targetVideoId}`
        logAudio('source assigned:', streamUrl)

        // Set the source — currentVideoIdRef is set HERE so the play/pause
        // sync effect (#7) knows the audio element is ready for this track.
        audio.src = streamUrl
        currentVideoIdRef.current = targetVideoId

        // Clear switching flag AFTER src is set so that any load-induced
        // events (emptied, etc.) don't falsely update store state.
        isSwitchingRef.current = false

        logAudio('play requested:', {
          src: audio.src,
          readyState: audio.readyState,
          paused: audio.paused,
        })

        // Only play if the store still says we should play
        const { isPlaying: shouldPlay } = usePlayerStore.getState()
        if (shouldPlay && reqId === audioRequestIdRef.current) {
          const p = audio.play()
          if (p !== undefined) {
            playPromiseRef.current = p
            p.then(() => {
              logAudio('play resolved successfully')
            }).catch((err) => {
              if (err?.name === 'NotAllowedError') {
                console.warn('[AUDIO] User interaction required before playback.')
                setIsPlaying(false)
              } else if (err?.name === 'NotSupportedError') {
                // If direct stream fails with NotSupportedError, fallback to YT player bridge
                const vid = currentVideoIdRef.current || usePlayerStore.getState().currentTrack?.videoId
                if (vid && isYtReadyRef.current && ytPlayerRef.current) {
                  logAudio('play rejection: activating YouTube IFrame fallback for videoId:', vid)
                  setActiveEngine('yt')
                  try {
                    ytPlayerRef.current.loadVideoById(vid)
                    ytPlayerRef.current.playVideo()
                    setIsPlaying(true)
                  } catch {}
                }
              } else if (err?.name !== 'AbortError') {
                logAudio('play rejected:', err?.name, err?.message)
              }
            })
          }
        }
      } else {
        isSwitchingRef.current = false
      }

      // ── PRELOAD NEXT ─────────────────────────────────────────────────────
      const { queue, currentIndex } = usePlayerStore.getState()
      if (queue && queue.length > 0) {
        const nextTrack = queue[currentIndex + 1]
        if (nextTrack) {
          if (nextTrack.videoId) {
            preloadAudioStream(nextTrack.videoId)
          } else {
            preloadSingleSong(nextTrack).then((vid) => {
              if (vid) preloadAudioStream(vid)
            })
          }
        }
      }
    }

    loadTrack()

    return () => {
      clearTimeout(safetyTimer)
    }
  // Depend only on track ID — not the whole track object.
  // This ensures switching A→B→A correctly re-triggers (reqId handles it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, setCurrentTime, setIsLoading, setIsPlaying])

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Play / Pause Sync
  //
  //    KEY FIXES:
  //    - Guard with isSwitchingRef (don't play mid-switch)
  //    - Guard with currentVideoIdRef (don't play if src not yet set)
  //    - Await pending promise before pause to avoid AbortError
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Don't touch audio during track switch — the loadTrack() function
    // in effect #6 will call play() itself once the src is ready.
    if (isSwitchingRef.current) return

    // Don't play if the audio element doesn't yet have a valid source
    // for the current track. Effect #6 will set it and call play().
    if (!currentVideoIdRef.current) return

    if (isPlaying) {
      if (activeEngine === 'yt') return

      // Only resume if actually paused, has a valid src, and has no active error
      if (
        audio.src &&
        audio.src !== window.location.href &&
        !audio.error &&
        audio.paused
      ) {
        logAudio('resuming audio.play()')
        const p = audio.play()
        if (p !== undefined) {
          playPromiseRef.current = p
          p.then(() => {
            logAudio('resume play resolved')
          }).catch((err) => {
            if (err?.name === 'NotAllowedError') {
              console.warn('[AUDIO] User interaction required before playback.')
              setIsPlaying(false)
            } else if (err?.name === 'NotSupportedError') {
              // Element has no supported sources -> switch to YouTube IFrame player fallback
              const vid = currentVideoIdRef.current || usePlayerStore.getState().currentTrack?.videoId
              if (vid && isYtReadyRef.current && ytPlayerRef.current) {
                logAudio('NotSupportedError: Falling back to YouTube IFrame player for videoId:', vid)
                setActiveEngine('yt')
                try {
                  ytPlayerRef.current.loadVideoById(vid)
                  ytPlayerRef.current.playVideo()
                } catch {}
              }
            } else if (err?.name !== 'AbortError') {
              console.error('[AUDIO] resume play rejected:', err?.name, err?.message)
            }
          })
        }
      }
    } else {
      if (!audio.paused) {
        // Safely pause: await pending promise first to avoid AbortError
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              if (!usePlayerStore.getState().isPlaying && !audio.paused) {
                logAudio('pause after promise resolved')
                audio.pause()
              }
            })
            .catch(() => {})
        } else {
          logAudio('pausing audio')
          audio.pause()
        }
      }
    }
  }, [isPlaying, setIsPlaying])

  // Sync activeEngine 'yt' Play/Pause
  useEffect(() => {
    if (activeEngine !== 'yt' || !ytPlayerRef.current) return
    try {
      if (isPlaying) {
        ytPlayerRef.current.playVideo()
      } else {
        ytPlayerRef.current.pauseVideo()
      }
    } catch {}
  }, [isPlaying, activeEngine])

  // Sync activeEngine 'yt' Progress
  useEffect(() => {
    if (activeEngine !== 'yt') return
    const timer = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const cur = ytPlayerRef.current.getCurrentTime() || 0
          const dur = ytPlayerRef.current.getDuration() || 0
          setCurrentTime(cur)
          if (dur > 0) setDuration(dur)
        } catch {}
      }
    }, 500)
    return () => clearInterval(timer)
  }, [activeEngine, setCurrentTime, setDuration])

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Seek
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (seekTo === null) return

    if (activeEngine === 'yt' && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.seekTo(seekTo, true)
      } catch {}
      clearSeek()
    } else if (audioRef.current) {
      logAudio('seeking to:', seekTo)
      audioRef.current.currentTime = seekTo
      clearSeek()
    }
  }, [seekTo, clearSeek, activeEngine])

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Volume / Mute
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      audioRef.current.muted = muted
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try {
        ytPlayerRef.current.setVolume(muted ? 0 : volume * 100)
      } catch {}
    }
  }, [volume, muted])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/*
        Persistent native HTML5 Audio element.
        - playsInline: required for iOS to not go fullscreen
        - preload="auto": start buffering immediately
        - x-webkit-airplay: enables AirPlay & helps iOS background audio
        - style: visually hidden but NOT display:none (display:none kills some
          browsers' ability to continue audio in background)
      */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        x-webkit-airplay="allow"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0.001,
          pointerEvents: 'none',
        }}
      />

      {/* YouTube IFrame bridge (hidden) */}
      <div
        style={{
          position: 'fixed',
          right: '0px',
          bottom: '0px',
          width: '240px',
          height: '180px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -50,
        }}
        aria-hidden="true"
      >
        <div id="yt-hidden-bridge" />
      </div>
    </>
  )
}
