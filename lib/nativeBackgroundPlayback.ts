import { Capacitor, registerPlugin } from '@capacitor/core'

// Native Android bridge (see android/app/src/main/java/com/localspo/app/BackgroundPlaybackPlugin.java).
// Starts a foreground service so audio keeps playing when the app is in the background.
export interface BackgroundPlaybackPlugin {
  start(options: { title: string; artist: string }): Promise<void>
  stop(): Promise<void>
}

const BackgroundPlayback = registerPlugin<BackgroundPlaybackPlugin>('BackgroundPlayback')

export function startNativeBackgroundPlayback(title: string, artist: string) {
  if (!Capacitor.isNativePlatform()) return
  BackgroundPlayback.start({ title, artist }).catch(() => {})
}

export function stopNativeBackgroundPlayback() {
  if (!Capacitor.isNativePlatform()) return
  BackgroundPlayback.stop().catch(() => {})
}
