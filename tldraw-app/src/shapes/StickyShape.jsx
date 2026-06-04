import { BaseBoxShapeUtil, HTMLContainer } from 'tldraw'

const WARM_COLORS = ['#FFF8DC', '#FFFACD', '#FFF5E1', '#FFEFD5']
const COOL_COLORS = ['#E8F4FD', '#E0F0FF', '#F0F4FF', '#EAF2FF']

export class StickyShapeUtil extends BaseBoxShapeUtil {
  static type = 'portfolio-sticky'

  getDefaultProps() {
    return { w: 280, h: 280, title: '', body: '', stampSrc: '', colorScheme: 'warm', entry: '{}' }
  }

  component(shape) {
    const { w, h, title, body, stampSrc, colorScheme } = shape.props
    const colors = colorScheme === 'cool' ? COOL_COLORS : WARM_COLORS
    const bg = colors[Math.floor(Math.random() * colors.length)]

    return (
      <HTMLContainer id={shape.id} style={{ pointerEvents: 'all' }}>
        <div style={{
          width: w,
          height: h,
          background: colorScheme === 'cool' ? '#E8F4FD' : '#FFF8DC',
          borderRadius: '2px',
          boxShadow: '2px 3px 12px rgba(0,0,0,0.1)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          position: 'relative',
          fontFamily: 'var(--title-font, Special Elite, cursive)',
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#222',
            marginBottom: '12px',
            lineHeight: 1.3,
          }}>
            {title}
          </div>
          <div style={{
            fontSize: '13px',
            color: '#555',
            lineHeight: 1.6,
            flex: 1,
            overflow: 'hidden',
            fontFamily: 'var(--body-font, Red Hat Mono, monospace)',
          }}>
            {body && body.length > 120 ? body.slice(0, 120) + '...' : body}
          </div>
          {stampSrc && (
            <div style={{
              position: 'absolute',
              bottom: '15px',
              right: '15px',
              width: '80px',
              height: '80px',
              opacity: 0.7,
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
