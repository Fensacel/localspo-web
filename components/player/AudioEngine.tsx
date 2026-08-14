'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useLibraryStore } from '@/store/useLibraryStore'
import { pickBestMatch } from '@/lib/playSong'
import { createClient } from '@/lib/supabase/client'
import type { Track } from '@/types/track'
import { preloadAudioStream, preloadSingleSong, preloadQueue, isYouTubeVideoId } from '@/lib/queuePreloader'

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

  // 1. Mobile Audio Context & Autoplay Unlocker
  useEffect(() => {
    if (typeof window === 'undefined') return

    function unlockAudio() {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          if (!usePlayerStore.getState().isPlaying) {
            audioRef.current?.pause()
          }
        }).catch(() => {})
      }
      if (ytPlayerRef.current?.playVideo) {
        try {
          if (!usePlayerStore.getState().isPlaying) {
            ytPlayerRef.current.pauseVideo()
          }
        } catch {}
      }
    }

    window.addEventListener('touchstart', unlockAudio, { once: true, passive: true })
    window.addEventListener('click', unlockAudio, { once: true, passive: true })

    return () => {
      window.removeEventListener('touchstart', unlockAudio)
      window.removeEventListener('click', unlockAudio)
    }
  }, [])

  // 2. MediaSession API for Mobile Background & Lock Screen Playback Controls
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
    } catch (e) {
      log('MediaSession action handler error:', e)
    }
  }, [currentTrack, next, previous])

  // 3. Sync MediaSession Playback State & Position State
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
      if (duration > 0 && typeof navigator.mediaSession.setPositionState === 'function') {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: 1,
          position: Math.min(Math.max(0, currentTime), duration),
        })
      }
    } catch {}
  }, [isPlaying, currentTime, duration])

  // 4. Initialize YouTube IFrame API script for universal Mobile & Cloudflare playback
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
                if (usePlayerStore.getState().isPlaying && usePlayerStore.getState().currentTrack?.videoId) {
                  ytPlayerRef.current.loadVideoById(usePlayerStore.getState().currentTrack!.videoId)
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

  // 5. Setup Native HTML5 Audio Element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'metadata'
    }
    const audio = audioRef.current

    function onTimeUpdate() {
      if (activeEngine !== 'html5') return
      setCurrentTime(audio.currentTime)

      if (audio.currentTime >= 5 && !hasLoggedHistoryRef.current) {
        logHistory(audio.currentTime, audio.duration || currentTrack?.duration || 0)
      }
    }

    function onLoadedMetadata() {
      if (activeEngine !== 'html5') return
      setDuration(audio.duration || 0)
      setIsLoading(false)
    }

    function onPlay() {
      if (activeEngine === 'html5') {
        setIsPlaying(true)
        setIsLoading(false)
      }
    }

    function onPause() {
      if (activeEngine === 'html5') setIsPlaying(false)
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
        log('HTML5 Audio error (will switch to YouTube Bridge):', err?.code, err?.message)
        if (currentTrack?.videoId) {
          setActiveEngine('yt')
          audio.pause()
          audio.src = ''
          if (ytPlayerRef.current) {
            try {
              ytPlayerRef.current.loadVideoById(currentTrack.videoId)
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

  // 6. YouTube Timer for progress tracking
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

  // 7. Load Track on Track Change
  useEffect(() => {
    if (!currentTrack) return
    const audio = audioRef.current
    const reqId = ++audioRequestIdRef.current

    // Instantly stop previous playing track across both engines so skipped track stops immediately
    if (audio) {
      try {
        audio.pause()
      } catch {}
    }
    if (ytPlayerRef.current?.pauseVideo) {
      try {
        ytPlayerRef.current.pauseVideo()
      } catch {}
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

      let targetVideoId = isYouTubeVideoId(currentTrack.videoId) ? currentTrack.videoId : undefined

      // Resolve videoId if missing or invalid
      if (!targetVideoId) {
        const libEntry = useLibraryStore.getState().allSongs[currentTrack.id]
        if (isYouTubeVideoId(libEntry?.resolvedVideoId)) {
          targetVideoId = libEntry.resolvedVideoId
        }

        if (!targetVideoId) {
          try {
            const artistName = typeof currentTrack.artist === 'string' ? currentTrack.artist : currentTrack.artist?.name || ''
            const query = `${currentTrack.title} ${artistName}`
            const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=songs`)
            if (reqId !== audioRequestIdRef.current) return

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
              usePlayerStore.getState().updateQueueSongVideoId(currentTrack.id, bestVideoId)
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

      hasLoggedHistoryRef.current = false

      if (activeEngine === 'yt') {
        if (audio) {
          try { audio.pause() } catch {}
        }
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.loadVideoById(targetVideoId)
            ytPlayerRef.current.playVideo()
          } catch (e) {
            log('YT load error:', e)
          }
        }
      } else if (audio) {
        if (ytPlayerRef.current?.pauseVideo) {
          try { ytPlayerRef.current.pauseVideo() } catch {}
        }
        const streamUrl = `/api/stream/${targetVideoId}`
        audio.src = streamUrl
        audio.load()

        const { isPlaying: shouldPlay } = usePlayerStore.getState()
        if (shouldPlay && reqId === audioRequestIdRef.current) {
          const p = audio.play()
          if (p !== undefined) {
            playPromiseRef.current = p
            p.catch((err) => {
              if (err?.name !== 'AbortError') {
                log('HTML5 play blocked, switching to YouTube Bridge:', err)
                setActiveEngine('yt')
                if (ytPlayerRef.current && targetVideoId) {
                  ytPlayerRef.current.loadVideoById(targetVideoId)
                  ytPlayerRef.current.playVideo()
                }
              }
            })
          }
        }
      }

      // Preload upcoming track and queue
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
        preloadQueue(queue, currentIndex + 1)
      }
    }

    loadAudioTrack()

    return () => clearTimeout(safetyTimer)
  }, [currentTrack?.id, currentTrack?.videoId, activeEngine, setIsLoading, setIsPlaying])

  // 8. Sync Play / Pause
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
              log('play failed:', err)
              setIsPlaying(false)
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

  // 9. Handle Seek
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

  // 10. Sync Volume / Mute
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
  )
}
