import { BaseBoxShapeUtil, HTMLContainer } from 'tldraw'

export class PhotoShapeUtil extends BaseBoxShapeUtil {
  static type = 'portfolio-photo'

  getDefaultProps() {
    return { w: 260, h: 320, src: '', caption: '', entry: '{}' }
  }

  component(shape) {
    const { w, h, src, caption } = shape.props
    return (
      <HTMLContainer id={shape.id} style={{ pointerEvents: 'all' }}>
        <div style={{
          width: w,
          height: h,
          background: '#fff',
          borderRadius: '2px',
          boxShadow: '2px 4px 16px rgba(0,0,0,0.13)',
          padding: '12px 12px 44px',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          fontFamily: 'var(--caption-font, Schoolbell, cursive)',
        }}>
          <div style={{
            flex: 1,
            borderRadius: '1px',
            overflow: 'hidden',
            background: '#f0ebe3',
          }}>
            {src && <img src={src} alt={caption} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{
            marginTop: '8px',
            fontSize: '15px',
            color: '#333',
            textAlign: 'center',
            fontFamily: 'var(--caption-font)',
          }}>
            {caption}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={2} />
  }
}
