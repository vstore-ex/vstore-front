import { useEffect, useRef, useState } from 'react'
export default function Trailer({ src, poster, title, onNextImage }) {
  const video = useRef(null)
  const [muted, setMuted] = useState(true)
  const [failed, setFailed] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const element = video.current
    let disposed = false
    element.src = src
    element.defaultMuted = true
    element.muted = true
    element.play()?.catch((error) => {
      if (!disposed && error.name !== 'AbortError') setBlocked(true)
    })
    const hide = () => {
      if (document.hidden) element.pause()
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      disposed = true
      element.pause()
      element.removeAttribute('src')
      element.load()
      document.removeEventListener('visibilitychange', hide)
    }
  }, [src, attempt])
  function retry() {
    setFailed(false)
    setBlocked(false)
    setWaiting(true)
    setMuted(true)
    setAttempt((value) => value + 1)
  }
  function play() {
    video.current
      .play()
      ?.then(() => setBlocked(false))
      .catch(() => setBlocked(true))
  }
  return (
    <div className="gallery-trailer">
      <video
        key={attempt}
        ref={video}
        src={src}
        poster={poster || undefined}
        controls
        muted={muted}
        autoPlay
        playsInline
        preload="metadata"
        aria-label={title + ' trailer'}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        onPlaying={() => {
          setWaiting(false)
          setBlocked(false)
        }}
        onCanPlay={() => setWaiting(false)}
        onWaiting={() => setWaiting(true)}
        onError={() => {
          setFailed(true)
          setWaiting(false)
          setBlocked(false)
        }}
      />
      {!failed && (
        <button
          className="gallery-sound"
          type="button"
          aria-pressed={!muted}
          onClick={() => {
            video.current.muted = !video.current.muted
            if (video.current.volume === 0) video.current.volume = 1
          }}
        >
          {muted ? 'Enable sound' : 'Mute'}
        </button>
      )}
      {waiting && !failed && !blocked && (
        <span className="gallery-buffering" role="status">
          Loading video...
        </span>
      )}
      {blocked && !failed && (
        <button className="gallery-play" type="button" onClick={play}>
          Play trailer
        </button>
      )}
      {failed && (
        <div className="gallery-video-error" role="alert">
          <p>Video temporarily unavailable.</p>
          <button type="button" onClick={retry}>
            Retry video
          </button>
          {onNextImage && (
            <button type="button" onClick={onNextImage}>
              Next screenshot
            </button>
          )}
        </div>
      )}
    </div>
  )
}
