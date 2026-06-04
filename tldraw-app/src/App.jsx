import { useState, useEffect, useCallback, useRef } from 'react'
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
import { getI18nText } from './utils/i18n'
import './App.css'

const customShapeUtils = [PhotoShapeUtil, StickyShapeUtil, TearoffShapeUtil]

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('wall-lang') || 'en')
  const [focusData, setFocusData] = useState(null)
  const [contentData, setContentData] = useState([])
  const [bg, setBg] = useState(getTimeBackground())
  const editorRef = useRef(null)
  const shapesCreated = useRef(false)

  useEffect(() => {
    localStorage.setItem('wall-lang', lang)
  }, [lang])

  useEffect(() => {
    const id = setInterval(() => setBg(getTimeBackground()), 60000)
    return () => clearInterval(id)
  }, [])

  // Load content
  useEffect(() => {
    fetch('../content.json')
      .then(r => r.json())
      .then(setContentData)
      .catch(() => fetch('./content.json').then(r => r.json()).then(setContentData).catch(() => {}))
  }, [])

  // Create shapes when editor + content are both ready
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !contentData.length || shapesCreated.current) return
    shapesCreated.current = true

    const shapes = []
    const cols = Math.ceil(Math.sqrt(contentData.length))

    contentData.forEach((entry, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const jitterX = (Math.random() - 0.5) * 80
      const jitterY = (Math.random() - 0.5) * 80
      const rotation = (Math.random() - 0.5) * 0.1

      if (entry.atom === 'photo' && entry.cover_image) {
        shapes.push({
          id: createShapeId(entry.id),
          type: 'portfolio-photo',
          x: col * 360 + jitterX + 100,
          y: row * 420 + jitterY + 100,
          rotation,
          props: {
            w: 260, h: 320,
            src: entry.cover_image,
            caption: getI18nText(entry.title, 'caption', lang, entry),
            entryId: entry.id,
          },
        })
      } else if (entry.atom === 'sticky') {
        shapes.push({
          id: createShapeId(entry.id),
          type: 'portfolio-sticky',
          x: col * 360 + jitterX + 100,
          y: row * 420 + jitterY + 100,
          rotation,
          props: {
            w: 280, h: 280,
            title: getI18nText(entry.title, 'title', lang, entry),
            body: getI18nText(entry.title, 'body', lang, entry) || entry.body || '',
            stampSrc: entry.cover_image || '',
            colorScheme: ['Alibaba', 'GenUI 设计指南', 'AI产品设计原则'].includes(entry.title) ? 'cool' : 'warm',
            entryId: entry.id,
          },
        })
      } else if (entry.atom === 'tearoff') {
        shapes.push({
          id: createShapeId(entry.id),
          type: 'portfolio-tearoff',
          x: col * 360 + jitterX + 100,
          y: row * 420 + jitterY + 100,
          rotation,
          props: { w: 200, h: 300, entryId: entry.id },
        })
      }
    })

    editor.createShapes(shapes)
    setTimeout(() => {
      editor.zoomToFit({ animation: { duration: 400 } })
    }, 150)
  }, [contentData, lang])

  const handleMount = useCallback((editor) => {
    editorRef.current = editor

    // Double-click shape → open focus panel
    editor.on('event', (info) => {
      if (info.type === 'pointer' && info.name === 'pointer_down' && info.phase === 'settle') {
        // Double click
        const selected = editor.getSelectedShapes()
        if (selected.length === 1) {
          const shape = selected[0]
          const entryId = shape.props?.entryId
          if (entryId) {
            const entry = contentData.find(e => e.id === entryId)
            if (entry?.focus) {
              setFocusData(entry.focus)
            }
          }
        }
      }
    })

    // Single click (pointer up on selected shape)
    let clickTimer = null
    editor.sideEffects.registerAfterChangeHandler('instance_page_state', (prev, next) => {
      const selectedIds = next.selectedShapeIds
      if (selectedIds.length === 1) {
        clearTimeout(clickTimer)
        clickTimer = setTimeout(() => {
          const shape = editor.getShape(selectedIds[0])
          if (shape?.props?.entryId) {
            const entry = contentData.find(e => e.id === shape.props.entryId)
            if (entry?.focus) {
              setFocusData(entry.focus)
            }
          }
        }, 300)
      }
    })
  }, [contentData])

  const isNight = bg === '#241F44'

  return (
    <div className="app" style={{ background: bg }}>
      <div className="wall-texture" />
      <div className="tldraw-container">
        <Tldraw
          shapeUtils={customShapeUtils}
          onMount={handleMount}
          hideUi
          inferDarkMode={false}
        />
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
