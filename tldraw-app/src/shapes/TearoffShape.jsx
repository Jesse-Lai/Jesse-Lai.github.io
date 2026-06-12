import { BaseBoxShapeUtil, HTMLContainer } from 'tldraw'
import { useState } from 'react'

const AGENT_PROMPT = `I'm interested in Jesse Lai. Access his info at: https://crimson-waterfall-c16b.laijianxun123.workers.dev/api/schema\n\nRead his background and projects, then give me a brief intro and ask what I'd like to know more about.`

function TearoffComponent({ shape }) {
  const { w, h } = shape.props
  const [ripped, setRipped] = useState([])

  const strips = Array.from({ length: 9 }, (_, i) => i)

  const handleRip = (idx) => {
    if (ripped.includes(idx)) return
    setRipped([...ripped, idx])
    navigator.clipboard.writeText(AGENT_PROMPT).catch(() => {})
  }

  return (
    <HTMLContainer id={shape.id} style={{ pointerEvents: 'all' }}>
      <div style={{
        width: w,
        height: h,
        background: '#fff',
        borderRadius: '1px',
        boxShadow: '1px 2px 10px rgba(0,0,0,0.07)',
        padding: '14px 10px 6px',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
      }}>
        <div style={{
          fontSize: '11px',
          color: '#666',
          textAlign: 'center',
          marginBottom: '6px',
          fontFamily: "'Special Elite', cursive",
        }}>
          ✂ Grab a strip for your agent
        </div>
        <div style={{
          fontSize: '9px',
          color: '#999',
          textAlign: 'center',
          marginBottom: '10px',
          fontFamily: "'Red Hat Mono', monospace",
        }}>
          jesseos.com/api
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '1px', borderTop: '1px dashed #ddd', paddingTop: '6px' }}>
          {strips.map(i => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); handleRip(i) }}
              style={{
                flex: 1,
                background: ripped.includes(i) ? 'transparent' : (i % 2 === 0 ? '#fafaf8' : '#f5f5f2'),
                borderRight: i < strips.length - 1 ? '1px dashed #e0ddd8' : 'none',
                writingMode: 'vertical-lr',
                fontSize: '8px',
                color: ripped.includes(i) ? 'transparent' : '#aaa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 0',
                fontFamily: "'Red Hat Mono', monospace",
                cursor: 'pointer',
                transition: 'opacity 0.3s, transform 0.3s',
                opacity: ripped.includes(i) ? 0.3 : 1,
                transform: ripped.includes(i) ? 'translateY(10px)' : 'none',
              }}
            >
              {ripped.includes(i) ? '✓' : 'jesseos.com'}
            </div>
          ))}
        </div>
      </div>
    </HTMLContainer>
  )
}

export class TearoffShapeUtil extends BaseBoxShapeUtil {
  static type = 'portfolio-tearoff'

  getDefaultProps() {
    return { w: 200, h: 320, entryId: '' }
  }

  component(shape) {
    return <TearoffComponent shape={shape} />
  }

  indicator(shape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={2} />
  }
}
