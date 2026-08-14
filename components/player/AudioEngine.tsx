'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useLibraryStore } from '@/store/useLibraryStore'
import { pickBestMatch } from '@/lib/playSong'
import { createClient } from '@/lib/supabase/client'
import type { Track } from '@/types/track'
import { preloadAudioStream, preloadSingleSong, preloadQueue, isYouTubeVideoId } from '@/lib/queuePreloader'
import { getKnownTrackOverride } from '@/lib/matcher'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any
    onYouTubeIframeAPIReady?: () => void
  }
}

const isDev = process.env.NODE_ENV === 'development'

function log(...args: unknown[]) {
  if (isDev) console.log('[AudioEngine]', ...args)
}

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ytPlayerRef = useRef<any>(null)
  const isYtReadyRef = useRef<boolean>(false)
  const [activeEngine, setActiveEngine] = useState<'html5' | 'yt'>('html5')
  const hasLoggedHistoryRef = useRef<boolean>(false)
  const audioRequestIdRef = useRef<number>(0)
  const playPromiseRef = useRef<Promise<void> | null>(null)
  const lastPositionUpdateRef = useRef<number>(0)
  const currentTargetVideoIdRef = useRef<string | null>(null)
  const lastLoadedTrackIdRef = useRef<string | null>(null)

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    seekTo,
    volume,
    muted,
    next,
    previous,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setIsLoading,
    clearSeek,
  } = usePlayerStore()

  // Global mobile audio unlock on first user gesture
  useEffect(() => {
    if (typeof window === 'undefined') return
    const unlockAudio = () => {
      const audio = audioRef.current
      if (audio && (!audio.src || audio.paused)) {
        try {
          audio.load()
        } catch {}
      }
    }
    window.addEventListener('touchstart', unlockAudio, { passive: true, once: true })
    window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true })
    window.addEventListener('click', unlockAudio, { passive: true, once: true })
    return () => {
      window.removeEventListener('touchstart', unlockAudio)
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('click', unlockAudio)
    }
  }, [])

  // 1. Setup MediaSession API for lock-screen, Android notification bar & background controls
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return

    if (currentTrack) {
      const artistName =
        typeof currentTrack.artist === 'string'
          ? currentTrack.artist
          : currentTrack.artist?.name || 'LocalSpo'
      const albumName =
        typeof currentTrack.album === 'string'
          ? currentTrack.album
          : currentTrack.album?.name || 'LocalSpo Music'
      const artworkUrl = currentTrack.thumbnail || currentTrack.thumbnailUrl || '/logo.png'

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: artistName,
        album: albumName,
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/png' },
          { src: artworkUrl, sizes: '128x128', type: 'image/png' },
          { src: artworkUrl, sizes: '192x192', type: 'image/png' },
          { src: artworkUrl, sizes: '256x256', type: 'image/png' },
          { src: artworkUrl, sizes: '384x384', type: 'image/png' },
          { src: artworkUrl, sizes: '512x512', type: 'image/png' },
        ],
      })
    }

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        usePlayerStore.getState().resume()
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        usePlayerStore.getState().pause()
      })
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        usePlayerStore.getState().previous()
      })
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        usePlayerStore.getState().next()
      })
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
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
        usePlayerStore.getState().pause()
      })
    } catch (e) {
      log('MediaSession action handler error:', e)
    }
  }, [currentTrack])

  // 2. Sync MediaSession Playback State
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return
    try {
      if (!currentTrack) {
        navigator.mediaSession.playbackState = 'none'
      } else {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
      }
    } catch {}
  }, [isPlaying, currentTrack])

  // 3. Initialize YouTube IFrame API script for fallback playback
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
                log('YouTube IFrame Engine Bridge Ready')
                const target = currentTargetVideoIdRef.current || usePlayerStore.getState().currentTrack?.videoId
                if (usePlayerStore.getState().isPlaying && target) {
                  ytPlayerRef.current.loadVideoById(target)
                }
              },
              onStateChange: (event: { data: number }) => {
                // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING, 5 = CUED
                if (event.data === 1) {
                  setIsPlaying(true)
                  setIsLoading(false)
                  if (ytPlayerRef.current?.getDuration) {
                    const dur = ytPlayerRef.current.getDuration()
                    if (dur > 0) setDuration(dur)
                  }
                } else if (event.data === 2) {
                  setIsPlaying(false)
                  setIsLoading(false)
                } else if (event.data === 0) {
                  log('YouTube player ended track')
                  const currentRepeat = usePlayerStore.getState().repeat
                  if (currentRepeat === 'one') {
                    ytPlayerRef.current?.seekTo(0, true)
                    ytPlayerRef.current?.playVideo()
                  } else {
                    next()
                  }
                } else if (event.data === 3) {
                  setIsLoading(true)
                } else if (event.data === 5) {
                  setIsLoading(false)
                }
              },
              onError: (err: unknown) => {
                log('YouTube IFrame error:', err)
                setIsLoading(false)
              },
            },
          })
        } catch (e) {
          log('Failed to init YT player:', e)
        }
      }
    }

    if (window.YT && window.YT.Player) {
      initYt()
    } else {
      window.onYouTubeIframeAPIReady = initYt
    }
  }, [next, setDuration, setIsLoading, setIsPlaying])

  // 4. Setup Native HTML5 Audio Element & Background Lifecycle Handlers
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const audio: HTMLAudioElement = el

    function onTimeUpdate() {
      if (activeEngine !== 'html5') return
      setCurrentTime(audio.currentTime)

      // Sync lock-screen position state every second
      const now = Date.now()
      if (now - lastPositionUpdateRef.current > 1000 && 'mediaSession' in navigator && typeof navigator.mediaSession.setPositionState === 'function') {
        lastPositionUpdateRef.current = now
        try {
          if (audio.duration > 0) {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: 1,
              position: Math.min(audio.currentTime, audio.duration),
            })
          }
        } catch {}
      }

      if (audio.currentTime >= 5 && !hasLoggedHistoryRef.current) {
        logHistory(audio.currentTime, audio.duration || currentTrack?.duration || 0)
      }
    }

    function onLoadedMetadata() {
      if (activeEngine !== 'html5') return
      setDuration(audio.duration || 0)
      setIsLoading(false)
      if ('mediaSession' in navigator && typeof navigator.mediaSession.setPositionState === 'function') {
        try {
          if (audio.duration > 0) {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: 1,
              position: audio.currentTime,
            })
          }
        } catch {}
      }
    }

    function onPlay() {
      if (activeEngine === 'html5') {
        setIsPlaying(true)
        setIsLoading(false)
      }
    }

    function onPause() {
      if (activeEngine === 'html5') {
        // Only sync pause if store was also set to paused, avoiding background tab sleep interruptions
        if (!usePlayerStore.getState().isPlaying) {
          setIsPlaying(false)
        }
      }
    }

    function onEnded() {
      if (activeEngine !== 'html5') return
      const currentRepeat = usePlayerStore.getState().repeat
      if (currentRepeat === 'one') {
        audio.currentTime = 0
        const p = audio.play()
        if (p !== undefined) {
          p.catch((err) => {
            if (err?.name !== 'AbortError') log('Repeat play error:', err)
          })
        }
      } else {
        next()
      }
    }

    function onWaiting() {
      if (activeEngine === 'html5') setIsLoading(true)
    }

    function onPlaying() {
      if (activeEngine === 'html5') setIsLoading(false)
    }

    function onError() {
      if (activeEngine === 'html5') {
        const err = audio.error
        log('HTML5 Audio error (falling back to YouTube Bridge):', err?.code, err?.message)
        const vid = currentTargetVideoIdRef.current || currentTrack?.videoId
        if (vid) {
          setActiveEngine('yt')
          audio.pause()
          audio.src = ''
          if (ytPlayerRef.current) {
            try {
              ytPlayerRef.current.loadVideoById(vid)
              ytPlayerRef.current.playVideo()
            } catch (e) {
              log('YT loadVideoById error:', e)
            }
          }
        } else {
          setIsLoading(false)
          setIsPlaying(false)
        }
      }
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
  }, [activeEngine, currentTrack, next, setCurrentTime, setDuration, setIsLoading, setIsPlaying])

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
        body: JSON.stringify({
          track,
          progress,
          duration,
        }),
      }).catch((err) => log('Failed to log history:', err))
    })
  }

  // 5. YouTube Timer for progress tracking
  useEffect(() => {
    if (activeEngine !== 'yt') return

    const timer = setInterval(() => {
      if (ytPlayerRef.current && isYtReadyRef.current && isPlaying) {
        try {
          if (typeof ytPlayerRef.current.getCurrentTime === 'function') {
            const time = ytPlayerRef.current.getCurrentTime()
            const dur = ytPlayerRef.current.getDuration()
            if (typeof time === 'number') {
              setCurrentTime(time)
              if (time >= 5) {
                logHistory(time, dur || currentTrack?.duration || 0)
              }
            }
            if (typeof dur === 'number' && dur > 0) {
              setDuration(dur)
            }
          }
        } catch {}
      }
    }, 250)

    return () => clearInterval(timer)
  }, [activeEngine, isPlaying, currentTrack, setCurrentTime, setDuration])

  // 6. Load Track on Track ID Change
  useEffect(() => {
    if (!currentTrack) return
    const trackId = currentTrack.id

    // Prevent duplicate loading if same track ID
    if (lastLoadedTrackIdRef.current === trackId) return
    lastLoadedTrackIdRef.current = trackId

    const audio = audioRef.current
    const reqId = ++audioRequestIdRef.current

    // Instantly stop previous playing track
    if (audio) {
      try { audio.pause() } catch {}
    }
    if (ytPlayerRef.current?.pauseVideo) {
      try { ytPlayerRef.current.pauseVideo() } catch {}
    }
    setCurrentTime(0)

    const safetyTimer = setTimeout(() => {
      if (reqId === audioRequestIdRef.current) {
        setIsLoading(false)
      }
    }, 4500)

    async function loadAudioTrack() {
      if (!currentTrack) return
      setIsLoading(true)

      const artistName = typeof currentTrack.artist === 'string' ? currentTrack.artist : currentTrack.artist?.name || ''
      const overrideId = getKnownTrackOverride(currentTrack.title, artistName)

      let targetVideoId =
        (overrideId && isYouTubeVideoId(overrideId) ? overrideId : undefined) ||
        (isYouTubeVideoId(currentTrack.videoId) ? currentTrack.videoId : undefined)

      // Resolve videoId if missing or invalid
      if (!targetVideoId) {
        const libEntry = useLibraryStore.getState().allSongs[currentTrack.id]
        if (isYouTubeVideoId(libEntry?.resolvedVideoId)) {
          targetVideoId = libEntry.resolvedVideoId
        }

        if (!targetVideoId) {
          try {
            const query = `${currentTrack.title} ${artistName}`
            const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=songs`)
            if (reqId !== audioRequestIdRef.current) return

            const searchJson = await searchRes.json()
            if (reqId !== audioRequestIdRef.current) return

            const songsList: Track[] = searchJson.data?.songs || []
            const topResult: Track | null = searchJson.data?.topResult?.data || null
            const candidates: Track[] = topResult ? [topResult, ...songsList] : songsList

            let matched = pickBestMatch(candidates, {
              id: currentTrack.id,
              title: currentTrack.title,
              artist: artistName,
              durationMs: (currentTrack.duration || 0) * 1000,
            })

            if (!matched) {
              try {
                const fallbackRes = await fetch(`/api/search?q=${encodeURIComponent(`${currentTrack.title} ${artistName} audio`)}&type=songs`)
                if (fallbackRes.ok && reqId === audioRequestIdRef.current) {
                  const fbJson = await fallbackRes.json()
                  const fbSongs: Track[] = fbJson.data?.songs || []
                  const fbTop: Track | null = fbJson.data?.topResult?.data || null
                  const fbCandidates: Track[] = fbTop ? [fbTop, ...fbSongs] : fbSongs
                  matched = pickBestMatch(fbCandidates, {
                    id: currentTrack.id,
                    title: currentTrack.title,
                    artist: artistName,
                    durationMs: (currentTrack.duration || 0) * 1000,
                  })
                }
              } catch {}
            }

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

      if (reqId !== audioRequestIdRef.current || !targetVideoId) {
        if (!targetVideoId && reqId === audioRequestIdRef.current) {
          console.warn('[AudioEngine] Failed to resolve videoId for track:', currentTrack.title)
          setIsLoading(false)
        }
        return
      }

      currentTargetVideoIdRef.current = targetVideoId
      hasLoggedHistoryRef.current = false

      if (activeEngine === 'yt') {
        if (audio) {
          try { audio.pause(); audio.src = '' } catch {}
        }
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.loadVideoById(targetVideoId)
            const { isPlaying: shouldPlay } = usePlayerStore.getState()
            if (shouldPlay) ytPlayerRef.current.playVideo()
          } catch (e) {
            log('YT load error:', e)
          }
        }
      } else if (audio) {
        const streamUrl = `/api/stream/${targetVideoId}`
        if (!audio.src.endsWith(streamUrl)) {
          audio.src = streamUrl
          audio.load()
        }

        const { isPlaying: shouldPlay } = usePlayerStore.getState()
        if (shouldPlay && reqId === audioRequestIdRef.current) {
          const p = audio.play()
          if (p !== undefined) {
            playPromiseRef.current = p
            p.catch((err) => {
              if (err?.name !== 'AbortError') {
                log('HTML5 play error (falling back to YouTube bridge):', err)
                setActiveEngine('yt')
                if (ytPlayerRef.current && targetVideoId) {
                  try {
                    ytPlayerRef.current.loadVideoById(targetVideoId)
                    ytPlayerRef.current.playVideo()
                  } catch {}
                }
              }
            })
          }
        }
      }

      // Preload next track
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

    loadAudioTrack()

    return () => clearTimeout(safetyTimer)
  }, [currentTrack?.id, activeEngine, setIsLoading, setIsPlaying])

  // 7. Sync Play / Pause
  useEffect(() => {
    if (activeEngine === 'yt') {
      if (ytPlayerRef.current) {
        try {
          if (isPlaying) {
            ytPlayerRef.current.playVideo()
          } else {
            ytPlayerRef.current.pauseVideo()
          }
        } catch {}
      }
      return
    }

    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      if (audio.src && audio.src !== window.location.href && audio.paused) {
        const p = audio.play()
        if (p !== undefined) {
          playPromiseRef.current = p
          p.catch((err) => {
            if (err?.name !== 'AbortError') {
              log('play error / background throttle:', err)
            }
          })
        }
      }
    } else {
      if (!audio.paused) {
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              if (!usePlayerStore.getState().isPlaying && !audio.paused) {
                audio.pause()
              }
            })
            .catch(() => {})
        } else {
          audio.pause()
        }
      }
    }
  }, [isPlaying, activeEngine, setIsPlaying])

  // 8. Handle Seek
  useEffect(() => {
    if (seekTo === null) return

    if (activeEngine === 'yt' && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.seekTo(seekTo, true)
      } catch {}
      clearSeek()
      return
    }

    if (audioRef.current) {
      audioRef.current.currentTime = seekTo
      clearSeek()
    }
  }, [seekTo, activeEngine, clearSeek])

  // 9. Sync Volume / Mute
  useEffect(() => {
    if (activeEngine === 'yt' && ytPlayerRef.current) {
      try {
        if (muted) {
          ytPlayerRef.current.mute()
        } else {
          ytPlayerRef.current.unMute()
          ytPlayerRef.current.setVolume(Math.round(volume * 100))
        }
      } catch {}
      return
    }

    if (audioRef.current) {
      audioRef.current.volume = volume
      audioRef.current.muted = muted
    }
  }, [volume, muted, activeEngine])

  return (
    <>
      {/* Physical HTML5 Audio with playsInline & preload for mobile lock screen & background playback */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0.01,
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden="true"
      />

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
