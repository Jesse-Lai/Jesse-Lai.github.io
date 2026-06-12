import { useState, useRef, useEffect } from 'react'
import './AiChat.css'

const WORKER_URL = 'https://crimson-waterfall-c16b.laijianxun123.workers.dev'

function buildSystemPrompt(contentData, lang) {
  if (!contentData?.length) return 'You are Jesse Lai\'s portfolio assistant. Answer questions about his work and background.'
  const summary = contentData.map(e => `- ${e.title}: ${(e.body || '').slice(0, 100)}`).join('\n')
  return `You are Jesse Lai's portfolio AI assistant. Help visitors learn about Jesse's work.

Here's a summary of Jesse's portfolio:
${summary}

Answer in ${lang === 'zh' ? 'Chinese' : 'English'}. Be concise and helpful.`
}

export function AiChat({ lang, contentData }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)
    setStreaming('')

    const systemPrompt = buildSystemPrompt(contentData, lang)

    try {
      const resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: systemPrompt }, ...newMsgs],
          stream: true,
          max_completion_tokens: 2000,
          temperature: 0.7,
        }),
      })

      if (!resp.ok) throw new Error('Request failed')

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const json = JSON.parse(data)
            const token = json.choices?.[0]?.delta?.content
            if (token) {
              fullContent += token
              setStreaming(fullContent)
            }
          } catch {}
        }
      }

      setMessages([...newMsgs, { role: 'assistant', content: fullContent || 'Sorry, something went wrong.' }])
      setStreaming('')
    } catch (e) {
      // Fallback to non-streaming
      try {
        const resp = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'system', content: buildSystemPrompt(contentData, lang) }, ...newMsgs],
            stream: false,
            max_completion_tokens: 2000,
            temperature: 0.7,
          }),
        })
        const data = await resp.json()
        const content = data.choices?.[0]?.message?.content || 'Sorry, something went wrong.'
        setMessages([...newMsgs, { role: 'assistant', content }])
      } catch {
        setMessages([...newMsgs, { role: 'assistant', content: 'Network error — please try again.' }])
      }
    }
    setStreaming('')
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
        <span>{lang === 'zh' ? '问我任何问题' : 'Ask me anything'}</span>
        <button onClick={() => setOpen(false)}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="m4.397 4.554.073-.084a.75.75 0 0 1 .976-.073l.084.073L12 10.939l6.47-6.47a.75.75 0 1 1 1.06 1.061L13.061 12l6.47 6.47a.75.75 0 0 1 .072.976l-.073.084a.75.75 0 0 1-.976.073l-.084-.073L12 13.061l-6.47 6.47a.75.75 0 0 1-1.06-1.061L10.939 12l-6.47-6.47a.75.75 0 0 1-.072-.976l.073-.084-.073.084Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div className="ai-chat-messages" ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div className="ai-msg ai-msg-assistant">
            {lang === 'zh' ? '👋 你好！我是 Jesse 的 AI 助手，有什么想了解的？' : "👋 Hi! I'm Jesse's AI assistant. What would you like to know?"}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-msg-${m.role}`}>
            {m.content}
          </div>
        ))}
        {streaming && <div className="ai-msg ai-msg-assistant">{streaming}</div>}
        {loading && !streaming && <div className="ai-msg ai-msg-assistant ai-typing">●●●</div>}
      </div>
      <div className="ai-chat-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={lang === 'zh' ? '输入你的问题...' : 'Type your question...'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
        <button onClick={send} disabled={loading || !input.trim()}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M4.284 10.296A1 1 0 0 0 5.709 11.7L11 6.33V20a1 1 0 1 0 2 0V6.336l5.285 5.364a1 1 0 0 0 1.425-1.404l-6.823-6.924a1.25 1.25 0 0 0-1.78 0l-6.823 6.924Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
