'use client'

import { useState, useEffect } from 'react'
import { Download, X, Sparkles, Smartphone } from 'lucide-react'

// Store the deferred beforeinstallprompt event globally so any component can trigger it
let globalDeferredPrompt: any = null

export function triggerPWAInstall() {
  if (globalDeferredPrompt) {
    globalDeferredPrompt.prompt()
    globalDeferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt')
      }
      globalDeferredPrompt = null
    })
  } else {
    // If browser didn't fire prompt yet, guide user
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    if (isIOS) {
      alert('Untuk memasang di iPhone/iPad:\n1. Tekan tombol Bagikan (Share)\n2. Pilih "Add to Home Screen" (Tambahkan ke Layar Utama)')
    } else {
      alert('Untuk memasang di Android:\n1. Tekan menu titik tiga (⋮) di Chrome\n2. Pilih "Tambahkan ke Layar Utama" / "Install Aplikasi"')
    }
  }
}

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already running in standalone PWA mode
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    if (standaloneMode) {
      setIsStandalone(true)
      return
    }

    // Check if user dismissed recently (e.g. within 2 days)
    const dismissedAt = localStorage.getItem('localspo_pwa_dismissed')
    if (dismissedAt) {
      const daysDiff = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24)
      if (daysDiff < 2) return
    }

    // Capture beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      globalDeferredPrompt = e
      // Delay showing prompt slightly for smooth entry
      setTimeout(() => setShowPrompt(true), 1500)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Fallback: On mobile browsers where beforeinstallprompt already fired or is supported
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile && !standaloneMode) {
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 2000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleInstallClick = async () => {
    if (globalDeferredPrompt) {
      globalDeferredPrompt.prompt()
      const { outcome } = await globalDeferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
      }
      globalDeferredPrompt = null
    } else {
      triggerPWAInstall()
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('localspo_pwa_dismissed', Date.now().toString())
  }

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:top-4 sm:w-96 z-[9990] animate-in slide-in-from-top duration-300">
      <div className="bg-[#18181b]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex items-center justify-between gap-3 text-white">
        {/* App Logo */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#242424] border border-white/10 shrink-0 shadow-md flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="LocalSpo" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white truncate">Install LocalSpo</h3>
              <Sparkles size={13} className="text-[#38bdf8] shrink-0" />
            </div>
            <p className="text-[11px] text-gray-300 truncate">
              Fullscreen & bebas header browser
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0070f3] to-[#38bdf8] hover:brightness-110 active:scale-95 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <Download size={13} strokeWidth={2.5} />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title="Tutup"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
