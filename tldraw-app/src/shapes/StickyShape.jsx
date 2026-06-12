import { BaseBoxShapeUtil, HTMLContainer } from 'tldraw'

export class StickyShapeUtil extends BaseBoxShapeUtil {
  static type = 'portfolio-sticky'

  getDefaultProps() {
    return { w: 280, h: 280, title: '', body: '', stampSrc: '', colorScheme: 'warm', entryId: '' }
  }

  component(shape) {
    const { w, h, title, body, stampSrc, colorScheme } = shape.props
    const bgColor = colorScheme === 'cool' ? '#EAF2FF' : '#FFF8DC'

    return (
      <HTMLContainer id={shape.id} style={{ pointerEvents: 'all' }}>
        <div style={{
          width: w,
          height: h,
          background: bgColor,
          borderRadius: '1px',
          boxShadow: '2px 3px 14px rgba(0,0,0,0.1)',
          padding: '22px 20px',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Tape effect */}
          <div style={{
            position: 'absolute',
            top: '-4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60px',
            height: '20px',
            background: 'rgba(255,255,255,0.5)',
            borderRadius: '0 0 2px 2px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }} />

          <div style={{
            fontSize: '17px',
            fontWeight: 'bold',
            color: '#222',
            marginBottom: '10px',
            marginTop: '8px',
            lineHeight: 1.3,
            fontFamily: "'Special Elite', cursive",
          }}>
            {title}
          </div>
          <div style={{
            fontSize: '12.5px',
            color: '#555',
            lineHeight: 1.65,
            flex: 1,
            overflow: 'hidden',
            fontFamily: "'Red Hat Mono', monospace",
          }}>
            {body && body.length > 100 ? body.slice(0, 100) + '...' : body}
          </div>
          {stampSrc && (
            <div style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              width: '72px',
              height: '72px',
              opacity: 0.65,
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <img src={stampSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={2} />
  }
}
