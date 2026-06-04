import { useState, useEffect } from 'react'
import './FocusPanel.css'

export function FocusPanel({ data, lang, onClose }) {
  const article = data.article || {}
  const sections = (lang === 'en' && article.sections_en) ? article.sections_en : article.sections || []
  const title = (lang === 'en' && data.title_en) ? data.title_en : data.title || ''

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="focus-overlay" onClick={onClose}>
      <div className="focus-panel" onClick={e => e.stopPropagation()}>
        <button className="focus-close" onClick={onClose}>✕</button>
        <h1 className="focus-title">{title}</h1>
        <div className="focus-content">
          {sections.map((section, i) => {
            if (section.type === 'subtitle') {
              return <h2 key={i} className="focus-subtitle">{section.text}</h2>
            } else if (section.type === 'text') {
              return <p key={i} className="focus-text" dangerouslySetInnerHTML={{ __html: section.text }} />
            } else if (section.type === 'image') {
              return <img key={i} className="focus-image" src={section.src} alt={section.caption || ''} />
            } else if (section.type === 'video') {
              return (
                <div key={i} className="focus-video">
                  <iframe src={section.src} allowFullScreen />
                </div>
              )
            }
            return null
          })}
        </div>
      </div>
    </div>
  )
}
