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
const BASE_IMG = './'
const isMobile = () => 'ontouchstart' in window || window.innerWidth < 768

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('wall-lang') || 'en')
  const [focusData, setFocusData] = useState(null)
  const [contentData, setContentData] = useState([])
  const [bg, setBg] = useState(getTimeBackground())
  const editorRef = useRef(null)
  const shapesCreated = useRef(false)
  const snapIdxRef = useRef(0)
  const shapePositions = useRef([])

  useEffect(() => { localStorage.setItem('wall-lang', lang) }, [lang])
  useEffect(() => {
    const id = setInterval(() => setBg(getTimeBackground()), 60000)
    return () => clearInterval(id)
  }, [])

  // Load content
  useEffect(() => {
    fetch('./content.json')
      .then(r => r.json())
      .then(setContentData)
      .catch(() => fetch('../content.json').then(r => r.json()).then(setContentData).catch(() => {}))
  }, [])

  // Create shapes once
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !contentData.length || shapesCreated.current) return
    shapesCreated.current = true

    const shapes = []
    const cols = Math.ceil(Math.sqrt(contentData.length))
    const positions = []

    contentData.forEach((entry, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const jx = (Math.random() - 0.5) * 80
      const jy = (Math.random() - 0.5) * 80
      const rot = (Math.random() - 0.5) * 0.1
      const x = col * 360 + jx + 100
      const y = row * 420 + jy + 100

      positions.push({ x: x + 130, y: y + 160, id: entry.id }) // center of shape

      if (entry.atom === 'photo' && entry.cover_image) {
        shapes.push({
          id: createShapeId(entry.id),
          type: 'portfolio-photo',
          x, y, rotation: rot,
          props: {
            w: 260, h: 320,
            src: BASE_IMG + entry.cover_image,
            caption: getI18nText(entry.title, 'caption', lang, entry),
            entryId: entry.id,
          },
        })
      } else if (entry.atom === 'sticky') {
        shapes.push({
          id: createShapeId(entry.id),
          type: 'portfolio-sticky',
          x, y, rotation: rot,
          props: {
            w: 280, h: 280,
            title: getI18nText(entry.title, 'title', lang, entry),
            body: getI18nText(entry.title, 'body', lang, entry) || entry.body || '',
            stampSrc: entry.cover_image ? BASE_IMG + entry.cover_image : '',
            colorScheme: ['Alibaba', 'GenUI 设计指南', 'AI产品设计原则'].includes(entry.title) ? 'cool' : 'warm',
            entryId: entry.id,
          },
        })
      } else if (entry.atom === 'tearoff') {
        shapes.push({
          id: createShapeId(entry.id),
          type: 'portfolio-tearoff',
          x, y, rotation: rot,
          props: { w: 200, h: 320, entryId: entry.id },
        })
      }
    })

    shapePositions.current = positions
    editor.createShapes(shapes)
    setTimeout(() => {
      if (isMobile() && positions.length > 0) {
        // On mobile, center on first shape
        editor.centerOnPoint(positions[0], { animation: { duration: 400 } })
      } else {
        editor.zoomToFit({ animation: { duration: 400 } })
      }
    }, 150)
  }, [contentData])

  // Update shape text when language changes
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !contentData.length || !shapesCreated.current) return

    const allShapes = editor.getCurrentPageShapes()
    const updates = []

    for (const shape of allShapes) {
      const entryId = shape.props?.entryId
      if (!entryId) continue
      const entry = contentData.find(e => e.id === entryId)
      if (!entry) continue

      if (shape.type === 'portfolio-photo') {
        const newCaption = getI18nText(entry.title, 'caption', lang, entry)
        if (shape.props.caption !== newCaption) {
          updates.push({ id: shape.id, type: shape.type, props: { caption: newCaption } })
        }
      } else if (shape.type === 'portfolio-sticky') {
        const newTitle = getI18nText(entry.title, 'title', lang, entry)
        const newBody = getI18nText(entry.title, 'body', lang, entry) || entry.body || ''
        if (shape.props.title !== newTitle || shape.props.body !== newBody) {
          updates.push({ id: shape.id, type: shape.type, props: { title: newTitle, body: newBody } })
        }
      }
    }

    if (updates.length) editor.updateShapes(updates)
  }, [lang, contentData])

  // Mobile snap scroll
  useEffect(() => {
    if (!isMobile()) return
    const editor = editorRef.current
    if (!editor) return

    let startY = 0
    let isAnimating = false

    const handleTouchStart = (e) => { startY = e.touches[0].clientY }
    const handleTouchEnd = (e) => {
      if (isAnimating) return
      const dy = startY - e.changedTouches[0].clientY
      if (Math.abs(dy) < 30) return // ignore small swipes

      const positions = shapePositions.current
      if (!positions.length) return

      if (dy > 0) {
        // swipe up → next
        snapIdxRef.current = Math.min(snapIdxRef.current + 1, positions.length - 1)
      } else {
        // swipe down → prev
        snapIdxRef.current = Math.max(snapIdxRef.current - 1, 0)
      }

      isAnimating = true
      const target = positions[snapIdxRef.current]
      editor.centerOnPoint(target, { animation: { duration: 350 } })
      setTimeout(() => { isAnimating = false }, 400)
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [contentData])

  const handleMount = useCallback((editor) => {
    editorRef.current = editor

    // Click shape → open focus panel
    let openTimer = null
    editor.sideEffects.registerAfterChangeHandler('instance_page_state', (prev, next) => {
      const ids = next.selectedShapeIds
      if (ids.length === 1) {
        clearTimeout(openTimer)
        openTimer = setTimeout(() => {
          const shape = editor.getShape(ids[0])
          if (shape?.props?.entryId) {
            const entry = contentData.find(e => e.id === shape.props.entryId)
            if (entry) {
              // Build focus data from entry
              const focusPayload = {
                title: entry.title,
                title_en: entry.title_en,
                article: {
                  sections: entry.article_sections || [],
                  sections_en: entry.article_sections_en || [],
                },
              }
              setFocusData(focusPayload)
            }
          }
        }, 350)
      } else {
        clearTimeout(openTimer)
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
        <FocusPanel data={focusData} lang={lang} onClose={() => setFocusData(null)} />
      )}

      <AiChat lang={lang} contentData={contentData} />
    </div>
  )
}
