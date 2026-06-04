import { useState, useEffect, useMemo, useCallback } from 'react'
import { Tldraw, createShapeId } from 'tldraw'
import 'tldraw/tldraw.css'
import { PhotoShapeUtil } from './shapes/PhotoShape'
import { StickyShapeUtil } from './shapes/StickyShape'
import { TearoffShapeUtil } from './shapes/TearoffShape'
import { FocusPanel } from './components/FocusPanel'
import { LightOverlay } from './components/LightOverlay'
import { AiChat } from './components/AiChat'
import { LangToggle } from './components/LangToggle'
import { getTimeBackground } from './utils/time-theme'
import './App.css'

const customShapeUtils = [PhotoShapeUtil, StickyShapeUtil, TearoffShapeUtil]

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('wall-lang') || 'en')
  const [focusData, setFocusData] = useState(null)
  const [contentData, setContentData] = useState([])
  const [bg, setBg] = useState(getTimeBackground())

  useEffect(() => {
    localStorage.setItem('wall-lang', lang)
  }, [lang])

  // Update background every minute
  useEffect(() => {
    const id = setInterval(() => setBg(getTimeBackground()), 60000)
    return () => clearInterval(id)
  }, [])

  // Load content
  useEffect(() => {
    fetch('../content.json')
      .then(r => r.json())
      .then(setContentData)
      .catch(() => fetch('./content.json').then(r => r.json()).then(setContentData))
  }, [])

  const handleMount = useCallback((editor) => {
    if (!contentData.length) return

    // Disable default tools UI
    editor.updateInstanceState({ isReadonly: false })

    // Create shapes from content
    const shapes = []
    let x = 100, y = 100
    const cols = Math.ceil(Math.sqrt(contentData.length))

    contentData.forEach((entry, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const jitterX = (Math.random() - 0.5) * 60
      const jitterY = (Math.random() - 0.5) * 60
      const rotation = (Math.random() - 0.5) * 0.12

      if (entry.atom === 'photo' && entry.cover_image) {
        shapes.push({
          id: createShapeId(entry.id),
          type: 'portfolio-photo',
          x: col * 350 + jitterX + 100,
          y: row * 400 + jitterY + 100,
          rotation,
          props: {
            w: 260,
            h: 320,
            src: entry.cover_image,
            caption: entry.title,
            entry: JSON.stringify(entry),
          },
        })
      } else if (entry.atom === 'sticky') {
        shapes.push({
          id: createShapeId(entry.id),
          type: 'portfolio-sticky',
          x: col * 350 + jitterX + 100,
          y: row * 400 + jitterY + 100,
          rotation,
          props: {
            w: 280,
            h: 280,
            title: entry.title,
            body: entry.body || '',
            stampSrc: entry.cover_image || '',
            colorScheme: ['Alibaba', 'GenUI 设计指南', 'AI产品设计原则'].includes(entry.title) ? 'cool' : 'warm',
            entry: JSON.stringify(entry),
          },
        })
      } else if (entry.atom === 'tearoff') {
        shapes.push({
          id: createShapeId(entry.id),
          type: 'portfolio-tearoff',
          x: col * 350 + jitterX + 100,
          y: row * 400 + jitterY + 100,
          rotation,
          props: {
            w: 200,
            h: 300,
            entry: JSON.stringify(entry),
          },
        })
      }
    })

    editor.createShapes(shapes)

    // Zoom to fit
    setTimeout(() => {
      editor.zoomToFit({ animation: { duration: 300 } })
    }, 100)

    // Handle shape clicks for focus
    const handleClick = (info) => {
      if (info.type === 'pointer' && info.name === 'pointer_up') {
        const shape = editor.getSelectedShapes()[0]
        if (shape && shape.props?.entry) {
          try {
            const entry = JSON.parse(shape.props.entry)
            if (entry.focus) {
              setFocusData({ ...entry.focus, lang })
            }
          } catch(e) {}
        }
      }
    }
    editor.on('event', handleClick)
  }, [contentData, lang])

  const isNight = bg === '#241F44'

  return (
    <div className="app" style={{ background: bg, width: '100%', height: '100%' }}>
      <div className="tldraw-container">
        {contentData.length > 0 && (
          <Tldraw
            shapeUtils={customShapeUtils}
            onMount={handleMount}
            hideUi
            inferDarkMode={false}
            options={{ maxPages: 1 }}
          />
        )}
      </div>

      <LightOverlay isNight={isNight} />

      <div className="top-controls">
        <LangToggle lang={lang} onToggle={() => setLang(l => l === 'en' ? 'zh' : 'en')} />
      </div>

      {focusData && (
        <FocusPanel
          data={focusData}
          lang={lang}
          onClose={() => setFocusData(null)}
        />
      )}

      <AiChat lang={lang} />
    </div>
  )
}
