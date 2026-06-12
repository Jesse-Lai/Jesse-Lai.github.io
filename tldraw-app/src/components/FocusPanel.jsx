import { useState, useEffect } from 'react'
import './FocusPanel.css'

export function FocusPanel({ data, lang, onClose }) {
  const article = data.article || data || {}
  const sections = (lang === 'en' && article.sections_en) ? article.sections_en : (article.sections || [])
  const title = (lang === 'en' && (data.title_en || article.title_en)) ? (data.title_en || article.title_en) : (data.title || article.title || '')

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="focus-overlay" onClick={onClose}>
      <div className="focus-panel" onClick={e => e.stopPropagation()}>
        <button className="focus-close" onClick={onClose}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path d="m4.397 4.554.073-.084a.75.75 0 0 1 .976-.073l.084.073L12 10.939l6.47-6.47a.75.75 0 1 1 1.06 1.061L13.061 12l6.47 6.47a.75.75 0 0 1 .072.976l-.073.084a.75.75 0 0 1-.976.073l-.084-.073L12 13.061l-6.47 6.47a.75.75 0 0 1-1.06-1.061L10.939 12l-6.47-6.47a.75.75 0 0 1-.072-.976l.073-.084-.073.084Z" fill="currentColor"/>
          </svg>
        </button>
        <h1 className="focus-title">{title}</h1>
        <div className="focus-content">
          {sections.map((section, i) => {
            if (section.type === 'subtitle') {
              return <h2 key={i} className="focus-subtitle">{section.text}</h2>
            } else if (section.type === 'text') {
              return <p key={i} className="focus-text" dangerouslySetInnerHTML={{ __html: section.text }} />
            } else if (section.type === 'image') {
              const imgSrc = section.src || section.url || ''
              return <img key={i} className="focus-image" src={imgSrc} alt={section.caption || ''} loading="lazy" />
            } else if (section.type === 'video' || section.type === 'iframe') {
              const videoSrc = section.src || section.url || ''
              return (
                <div key={i} className="focus-video">
                  <iframe src={videoSrc} allowFullScreen frameBorder="0" />
                </div>
              )
            } else if (section.type === 'link') {
              return (
                <a key={i} className="focus-link" href={section.url} target="_blank" rel="noopener noreferrer">
                  {section.text || section.url}
                </a>
              )
            }
            return null
          })}
        </div>
      </div>
    </div>
  )
}
