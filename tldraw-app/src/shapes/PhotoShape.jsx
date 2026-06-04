import { BaseBoxShapeUtil, HTMLContainer } from 'tldraw'

export class PhotoShapeUtil extends BaseBoxShapeUtil {
  static type = 'portfolio-photo'

  getDefaultProps() {
    return { w: 260, h: 320, src: '', caption: '', entryId: '' }
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
          boxShadow: '3px 5px 20px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
          padding: '12px 12px 48px',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s',
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
            position: 'absolute',
            bottom: '14px',
            left: '16px',
            right: '16px',
            fontSize: '15px',
            color: '#333',
            textAlign: 'center',
            fontFamily: "'Schoolbell', cursive",
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
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
