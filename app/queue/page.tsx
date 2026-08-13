'use client'

import { usePlayerStore } from '@/store/playerStore'
import { TrackRow } from '@/components/music/TrackRow'
import { Trash2, ListMusic } from 'lucide-react'

export default function QueuePage() {
  const { currentTrack, queue, currentIndex, removeFromQueue, clearQueue, play } = usePlayerStore()

  const upcomingTracks = queue.slice(currentIndex + 1)
  const previousTracks = queue.slice(0, currentIndex)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#282828] pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <ListMusic size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Play Queue</h1>
            <p className="text-sm text-gray-400">
              {queue.length} track{queue.length === 1 ? '' : 's'} in queue
            </p>
          </div>
        </div>

        {queue.length > 0 && (
          <button
            onClick={clearQueue}
            className="px-4 py-2 bg-[#282828] hover:bg-[#333] text-red-400 hover:text-red-300 rounded-full text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} /> Clear Queue
          </button>
        )}
      </div>

      {/* Now Playing */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
          Now Playing
        </h2>
        {currentTrack ? (
          <div className="bg-[#181818] p-3 rounded-lg border border-[#282828]">
            <TrackRow track={currentTrack} />
          </div>
        ) : (
          <p className="text-gray-500 text-sm italic">No track currently playing</p>
        )}
      </section>

      {/* Next Up */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
          Next Up ({upcomingTracks.length})
        </h2>
        {upcomingTracks.length > 0 ? (
          <div className="bg-[#181818] rounded-lg border border-[#282828] divide-y divide-[#282828]">
            {upcomingTracks.map((track, i) => {
              const actualIndex = currentIndex + 1 + i
              return (
                <div key={`queue-${track.id}-${i}`} className="flex items-center pr-3 group">
                  <div className="flex-1">
                    <TrackRow
                      track={track}
                      index={i + 1}
                      onPlay={() => play(track, queue)}
                    />
                  </div>
                  <button
                    onClick={() => removeFromQueue(actualIndex)}
                    className="opacity-0 group-hover:opacity-100 px-3 py-1 text-xs text-gray-400 hover:text-red-400 transition-opacity"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-[#181818] p-6 rounded-lg border border-[#282828] text-center text-gray-500 text-sm">
            Queue is empty. Add songs to your queue from any song options menu.
          </div>
        )}
      </section>

      {/* Previously Played */}
      {previousTracks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
            Previously Played ({previousTracks.length})
          </h2>
          <div className="bg-[#181818] rounded-lg border border-[#282828] divide-y divide-[#282828] opacity-75">
            {previousTracks.map((track, i) => (
              <TrackRow
                key={`prev-${track.id}-${i}`}
                track={track}
                index={i + 1}
                onPlay={() => play(track, queue)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
