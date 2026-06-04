import { BaseBoxShapeUtil, HTMLContainer } from 'tldraw'

export class TearoffShapeUtil extends BaseBoxShapeUtil {
  static type = 'portfolio-tearoff'

  getDefaultProps() {
    return { w: 200, h: 320, entryId: '' }
  }

  component(shape) {
    const { w, h } = shape.props
    const strips = Array.from({ length: 9 }, (_, i) => i)

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
            jesselai.com/api
          </div>
          <div style={{ flex: 1, display: 'flex', gap: '1px', borderTop: '1px dashed #ddd', paddingTop: '6px' }}>
            {strips.map(i => (
              <div key={i} style={{
                flex: 1,
                background: i % 2 === 0 ? '#fafaf8' : '#f5f5f2',
                borderRight: i < strips.length - 1 ? '1px dashed #e0ddd8' : 'none',
                writingMode: 'vertical-lr',
                fontSize: '8px',
                color: '#aaa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 0',
                fontFamily: "'Red Hat Mono', monospace",
              }}>
                jesselai.com
              </div>
            ))}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={2} />
  }
}
