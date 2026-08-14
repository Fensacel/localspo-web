'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Camera, Image as ImageIcon, Loader2 } from 'lucide-react'

interface EditPlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  initialName: string
  initialCoverUrl?: string
  onSave: (name: string, coverUrl: string) => Promise<void> | void
}

export function EditPlaylistModal({
  isOpen,
  onClose,
  initialName,
  initialCoverUrl = '',
  onSave,
}: EditPlaylistModalProps) {
  const [mounted, setMounted] = useState(false)
  const [name, setName] = useState(initialName)
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl)
  const [loading, setLoading] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setName(initialName)
      setCoverUrl(initialCoverUrl)
      setShowUrlInput(false)
    }
  }, [isOpen, initialName, initialCoverUrl])

  if (!mounted || !isOpen) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Read image as base64 data URL
    const reader = new FileReader()
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setCoverUrl(event.target.result)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      await onSave(name.trim(), coverUrl)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md bg-[#181818] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-tight">Edit Detail Playlist</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Cover Art Upload Area */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group relative w-40 h-40 rounded-2xl overflow-hidden bg-[#282828] border border-white/10 cursor-pointer shadow-lg hover:border-white/30 transition-all flex items-center justify-center"
            >
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt="Playlist Cover"
                  className="w-full h-full object-cover group-hover:opacity-50 transition-opacity"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-gray-300 transition-colors">
                  <ImageIcon size={40} />
                  <span className="text-xs font-semibold">Pilih Foto</span>
                </div>
              )}

              {/* Hover Camera Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity text-white">
                <Camera size={26} />
                <span className="text-[11px] font-bold">Ganti Foto</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[#38bdf8] hover:underline font-semibold"
              >
                Unggah dari HP / PC
              </button>
              <span className="text-gray-500">•</span>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {showUrlInput ? 'Tutup URL' : 'Gunakan Link URL'}
              </button>
            </div>

            {showUrlInput && (
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://example.com/cover.jpg"
                className="w-full bg-[#121212] border border-white/10 focus:border-[#38bdf8] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition-colors"
              />
            )}
          </div>

          {/* Playlist Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300">Nama Playlist</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Beri nama playlist..."
              required
              className="w-full bg-[#121212] border border-white/10 focus:border-[#38bdf8] text-white text-sm font-semibold rounded-xl px-4 py-3 outline-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-[#38bdf8] text-black hover:bg-[#38bdf8]/90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>Simpan</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
