import './LangToggle.css'

export function LangToggle({ lang, onToggle }) {
  return (
    <button className="lang-toggle" onClick={onToggle}>
      {lang === 'zh' ? 'EN' : '中'}
    </button>
  )
}
