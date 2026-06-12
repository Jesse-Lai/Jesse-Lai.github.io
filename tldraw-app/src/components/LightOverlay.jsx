import './LightOverlay.css'

export function LightOverlay({ isNight }) {
  if (isNight) return null
  return <div className="light-overlay" />
}
