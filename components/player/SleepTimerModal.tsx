'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Moon } from 'lucide-react'
import { useSleepTimerStore } from '@/store/useSleepTimerStore'
import { useToastStore } from '@/store/toastStore'

interface SleepTimerModalProps {
  isOpen: boolean
  onClose: () => void
}

const OPTIONS = [
  { label: '5 minutes', minutes: 5 },
  { label: '10 minutes', minutes: 10 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '45 minutes', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: 'End of track', minutes: null },
]

export function SleepTimerModal({ isOpen, onClose }: SleepTimerModalProps) {
  const [mounted, setMounted] = useState(false)
  const { isActive, mode, remainingSeconds, remainingSongs, startMinutesTimer, startEndOfTrackTimer, stopTimer } = useSleepTimerStore()
  const { showToast } = useToastStore()

  useEffect(() => { setMounted(true) }, [])

  if (!mounted || !isOpen) return null

  function handleSelect(minutes: number | null) {
    if (minutes === null) {
      startEndOfTrackTimer()
      showToast('Sleep timer: berhenti di akhir lagu', 'info')
    } else {
      startMinutesTimer(minutes)
      showToast(`Sleep timer: berhenti dalam ${minutes} menit`, 'info')
    }
    onClose()
  }

  function handleStop() {
    stopTimer()
    showToast('Sleep timer dimatikan', 'info')
    onClose()
  }

  const activeLabel = isActive
    ? mode === 'minutes' && remainingSeconds !== null
      ? `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s tersisa`
      : mode === 'songs'
      ? `${remainingSongs} lagu tersisa`
      : 'Di akhir lagu saat ini'
    : null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal: Bottom Sheet on Mobile, Centered Popup on Desktop */}
      <div className="fixed z-[9999] bg-[#18181b] shadow-2xl text-white
        /* Mobile: Bottom Sheet */
        bottom-0 left-0 right-0 rounded-t-3xl pb-safe animate-in slide-in-from-bottom duration-300
        /* Desktop: Centered Floating Popup */
        sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
        sm:w-[380px] sm:rounded-2xl sm:border sm:border-white/10 sm:slide-in-from-bottom-0 sm:zoom-in-95 sm:duration-200 sm:pb-0
      ">
        {/* Mobile handle bar */}
        <div className="flex sm:hidden justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Moon size={18} className="text-[#38bdf8]" />
            <h2 className="text-base font-bold text-white">Sleep Timer</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Active Timer Info */}
        {isActive && activeLabel && (
          <div className="px-5 py-3 flex items-center justify-between border-b border-white/10 bg-[#38bdf8]/10">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse" />
              <span className="text-xs text-[#38bdf8] font-semibold">{activeLabel}</span>
            </div>
            <button
              onClick={handleStop}
              className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              Matikan
            </button>
          </div>
        )}

        {/* Options list */}
        <div className="p-2 divide-y divide-white/5 sm:divide-none space-y-0.5">
          {OPTIONS.map(({ label, minutes }) => (
            <button
              key={label}
              onClick={() => handleSelect(minutes)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 rounded-xl transition-all text-left group"
            >
              <span>{label}</span>
              <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
                {minutes ? `${minutes} min` : 'Next stop'}
              </span>
            </button>
          ))}
        </div>

        {/* Mobile bottom padding */}
        <div className="h-4 sm:hidden" />
      </div>
    </>,
    document.body
  )
}
