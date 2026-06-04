import { BaseBoxShapeUtil, HTMLContainer } from 'tldraw'

export class TearoffShapeUtil extends BaseBoxShapeUtil {
  static type = 'portfolio-tearoff'

  getDefaultProps() {
    return { w: 200, h: 300, entry: '{}' }
  }

  component(shape) {
    const { w, h } = shape.props
    const strips = Array.from({ length: 8 }, (_, i) => i)

    return (
      <HTMLContainer id={shape.id} style={{ pointerEvents: 'all' }}>
        <div style={{
          width: w,
          height: h,
          background: '#fff',
          borderRadius: '2px',
          boxShadow: '1px 2px 8px rgba(0,0,0,0.08)',
          padding: '16px 12px 8px',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          fontFamily: 'var(--body-font)',
        }}>
          <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', marginBottom: '8px' }}>
            ✂ Grab a strip for your agent
          </div>
          <div style={{ flex: 1, display: 'flex', gap: '2px' }}>
            {strips.map(i => (
              <div key={i} style={{
                flex: 1,
                background: '#f8f6f2',
                borderBottom: '1px dashed #ccc',
                borderRadius: '1px',
                writingMode: 'vertical-lr',
                fontSize: '9px',
                color: '#888',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 0',
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
