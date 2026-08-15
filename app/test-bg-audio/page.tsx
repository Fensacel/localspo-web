'use client'

export default function TestBgAudioPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-2xl font-bold">Background Audio Test Page</h1>
      <p className="text-neutral-400 max-w-md">
        Use this minimal page to test PWA background audio playback on iOS / Android.
      </p>
      <audio
        controls
        autoPlay
        src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
        className="w-full max-w-md"
      />
    </div>
  )
}
