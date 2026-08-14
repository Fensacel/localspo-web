'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToastStore } from '@/store/toastStore'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export function ToastContainer() {
  const [mounted, setMounted] = useState(false)
  const { toasts, removeToast } = useToastStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || toasts.length === 0) return null

  return createPortal(
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none">
      {toasts.map((toast) => {
        const isError = toast.type === 'error'
        const isInfo = toast.type === 'info'

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-2xl transition-all animate-in fade-in slide-in-from-top-4 duration-200 ${
              isError
                ? 'bg-red-950/90 border-red-500/30 text-red-100'
                : isInfo
                ? 'bg-[#181818]/95 border-white/15 text-white'
                : 'bg-[#141414]/95 border-[#38bdf8]/40 text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {isError ? (
                <AlertCircle size={18} className="text-red-400 shrink-0" />
              ) : isInfo ? (
                <Info size={18} className="text-gray-300 shrink-0" />
              ) : (
                <CheckCircle2 size={18} className="text-[#38bdf8] shrink-0" />
              )}
              <p className="text-xs font-semibold leading-snug">{toast.message}</p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-white p-1 shrink-0 transition-colors"
              aria-label="Tutup"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>,
    document.body
  )
}
