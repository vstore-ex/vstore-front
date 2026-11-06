const STORAGE_KEY = 'vstore:message-sound'

let context = null

export function messageSoundEnabled() {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setMessageSoundEnabled(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, 'on')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage may be unavailable (private mode); the toggle just does not persist
  }
}

function ensureContext() {
  if (context) return context
  const Context = window.AudioContext || window.webkitAudioContext
  if (!Context) return null
  context = new Context()
  return context
}

function resumeContext() {
  if (context?.state === 'suspended') void context.resume().catch(() => {})
}

// Audio policy stays suspended without a user gesture, so keep retrying on interactions.
function unlockOnGesture() {
  if (context) resumeContext()
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlockOnGesture)
  document.addEventListener('keydown', unlockOnGesture)
}

function tone(audio, start, frequency, duration, peak) {
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(audio.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

export function playMessageSound() {
  if (!messageSoundEnabled() || typeof window === 'undefined') return
  const audio = ensureContext()
  if (!audio) return
  resumeContext()
  try {
    const start = audio.currentTime
    tone(audio, start, 880, 0.18, 0.08)
    tone(audio, start + 0.09, 1320, 0.22, 0.06)
  } catch {
    // audio may be blocked until the first user gesture; stay silent
  }
}
