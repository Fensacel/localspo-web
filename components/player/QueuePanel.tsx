'use client'

import { usePlayerStore } from '@/store/playerStore'
import { TrackRow } from '@/components/music/TrackRow'
import { Trash2, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

export function QueuePanel() {
  const { currentTrack, queue, currentIndex, removeFromQueue, clearQueue, play } = usePlayerStore()
  const { setQueueOpen } = useUIStore()

  const upcomingTracks = queue.slice(currentIndex + 1)
  const previousTracks = queue.slice(0, currentIndex)

  return (
    <div className="h-full flex flex-col bg-[#121212] border-l border-[#282828] w-80 shrink-0 z-20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#282828] flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Play Queue</h2>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              onClick={clearQueue}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
              title="Clear queue"
            >
              <Trash2 size={14} /> Clear
            </button>
          )}
          <button
            onClick={() => setQueueOpen(false)}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#282828]"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Now Playing */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Now Playing
          </h3>
          {currentTrack ? (
            <TrackRow track={currentTrack} hideDuration />
          ) : (
            <p className="text-sm text-gray-500 italic">No track playing</p>
          )}
        </div>

        {/* Next Up */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Next Up ({upcomingTracks.length})
          </h3>
          {upcomingTracks.length > 0 ? (
            <div className="space-y-1">
              {upcomingTracks.map((track, i) => {
                const actualIndex = currentIndex + 1 + i
                return (
                  <div key={`${track.id}-${i}`} className="group relative flex items-center">
                    <div className="flex-1 min-w-0">
                      <TrackRow
                        track={track}
                        index={i + 1}
                        onPlay={() => play(track, queue)}
                        hideDuration
                      />
                    </div>
                    <button
                      onClick={() => removeFromQueue(actualIndex)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-opacity ml-1"
                      title="Remove from queue"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Queue is empty</p>
          )}
        </div>

        {/* Previously Played */}
        {previousTracks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Previously Played ({previousTracks.length})
            </h3>
            <div className="space-y-1 opacity-60 hover:opacity-100 transition-opacity">
              {previousTracks.map((track, i) => (
                <TrackRow
                  key={`prev-${track.id}-${i}`}
                  track={track}
                  index={i + 1}
                  onPlay={() => play(track, queue)}
                  hideDuration
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
