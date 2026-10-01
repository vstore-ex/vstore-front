import { useEffect, useRef, useState } from 'react'
export default function HoverVideo({ src }) {
  const video = useRef(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const element = video.current
    let disposed = false
    element.src = src
    element.defaultMuted = true
    element.muted = true
    element.play()?.catch(() => { if (!disposed) setFailed(true) })
    return () => { disposed = true; element.pause(); element.removeAttribute('src'); element.load() }
  }, [src])
  return <video ref={video} className={'product-card__preview' + (ready && !failed ? ' product-card__preview--ready' : '')}
    src={src} muted autoPlay loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}
    onPlaying={() => setReady(true)} onError={() => setFailed(true)}
    onTimeUpdate={event => { if (event.currentTarget.currentTime >= 8) event.currentTarget.currentTime = 0 }} />
}
