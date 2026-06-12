import { BaseBoxShapeUtil, HTMLContainer } from 'tldraw'
import { useState, useRef, useEffect } from 'react'

function PhotoComponent({ shape }) {
  const { w, h, src, caption } = shape.props
  const [isHovering, setIsHovering] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef(null)

  // Derive video src from image src
  const videoSrc = src ? src.replace(/\.(png|jpg|jpeg|webp)$/i, '.mp4') : null

  useEffect(() => {
    if (!videoSrc) return
    const video = document.createElement('video')
    video.src = videoSrc
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.addEventListener('canplay', () => setVideoReady(true), { once: true })
    video.addEventListener('error', () => setVideoReady(false), { once: true })
    videoRef.current = video
    return () => { video.pause(); video.src = '' }
  }, [videoSrc])

  const handleEnter = () => {
    setIsHovering(true)
    if (videoReady && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }

  const handleLeave = () => {
    setIsHovering(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  return (
    <HTMLContainer id={shape.id} style={{ pointerEvents: 'all' }}>
      <div
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
        style={{
          width: w,
          height: h,
          background: '#fff',
          borderRadius: '2px',
          boxShadow: isHovering
            ? '4px 7px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)'
            : '3px 5px 20px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
          padding: '12px 12px 48px',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, transform 0.2s',
          transform: isHovering ? 'scale(1.03)' : 'scale(1)',
        }}
      >
        <div style={{
          flex: 1,
          borderRadius: '1px',
          overflow: 'hidden',
          background: '#f0ebe3',
          position: 'relative',
        }}>
          {src && <img src={src} alt={caption} style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: isHovering && videoReady ? 0 : 1,
            transition: 'opacity 0.3s',
          }} />}
          {videoReady && (
            <video
              ref={el => { if (el && videoRef.current && el !== videoRef.current) { /* noop */ } }}
              src={videoSrc}
              muted
              playsInline
              loop
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: isHovering ? 1 : 0,
                transition: 'opacity 0.3s',
              }}
              onMouseEnter={e => { if (isHovering) e.target.play().catch(() => {}) }}
            />
          )}
        </div>
        <div style={{
          position: 'absolute',
          bottom: '14px',
          left: '16px',
          right: '16px',
          fontSize: '15px',
          color: '#333',
          textAlign: 'center',
          fontFamily: "'Schoolbell', cursive",
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {caption}
        </div>
      </div>
    </HTMLContainer>
  )
}

export class PhotoShapeUtil extends BaseBoxShapeUtil {
  static type = 'portfolio-photo'

  getDefaultProps() {
    return { w: 260, h: 320, src: '', caption: '', entryId: '' }
  }

  component(shape) {
    return <PhotoComponent shape={shape} />
  }

  indicator(shape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={2} />
  }
}
