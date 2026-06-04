import { useState, useRef, useEffect } from 'react'
import './AiChat.css'

const WORKER_URL = 'https://crimson-waterfall-c16b.laijianxun123.workers.dev'

export function AiChat({ lang }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)

    // Track via Umami
    if (typeof umami !== 'undefined') {
      try { umami.track('user-question', { question: userMsg.content.slice(0, 400), source: 'website' }) } catch(e) {}
    }

    try {
      const resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs, stream: false, max_completion_tokens: 2000, temperature: 0.7 }),
      })
      const data = await resp.json()
      const assistantContent = data.choices?.[0]?.message?.content || 'Sorry, something went wrong.'
      setMessages([...newMsgs, { role: 'assistant', content: assistantContent }])
    } catch (e) {
      setMessages([...newMsgs, { role: 'assistant', content: 'Network error — please try again.' }])
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button className="ai-chat-fab" onClick={() => setOpen(true)}>
        💬
      </button>
    )
  }

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <span>Ask me anything</span>
        <button onClick={() => setOpen(false)}>✕</button>
      </div>
      <div className="ai-chat-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-msg-${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="ai-msg ai-msg-assistant">Thinking...</div>}
      </div>
      <div className="ai-chat-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={lang === 'zh' ? '问我任何问题...' : 'Ask me anything...'}
        />
        <button onClick={send} disabled={loading}>→</button>
      </div>
    </div>
  )
}
