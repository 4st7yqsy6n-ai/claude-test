import { useState, useRef, useEffect } from 'react'
import { Mic, Brain, Globe, TrendingUp, BarChart2, AlertTriangle, Send } from 'lucide-react'
import { useJarvis, type JarvisState } from './useJarvis'
import { motion, AnimatePresence } from 'framer-motion'

const STATE_COLORS: Record<JarvisState, string> = {
  idle:      '#ff6600',
  listening: '#00d37f',
  thinking:  '#3b82f6',
  speaking:  '#a855f7',
}

const STATE_LABELS: Record<JarvisState, string> = {
  idle:      'STANDBY',
  listening: 'LISTENING...',
  thinking:  'ANALYZING...',
  speaking:  'SPEAKING',
}

const QUICK_ACTIONS = [
  { icon: Globe,         label: 'World Markets',  prompt: 'Give me a summary of global market performance across Americas, Europe, and Asia-Pacific right now.' },
  { icon: TrendingUp,    label: 'Yield Curve',    prompt: 'Analyze the current yield curve shape and what it signals about the economic outlook.' },
  { icon: BarChart2,     label: 'Macro Briefing', prompt: 'Give me a full macro briefing covering inflation, employment, Fed policy, and key global risks.' },
  { icon: AlertTriangle, label: 'Risk Check',     prompt: 'What are the top macro and geopolitical risk factors to watch right now? Rank them by severity.' },
]

function ThinkingDots({ color }: { color: string }) {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: color }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

export default function JarvisPanel() {
  const {
    state,
    messages,
    transcript,
    volume,
    isSupported,
    alwaysListening,
    startListening,
    toggleAlwaysListening,
    handleQuery,
  } = useJarvis()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const color = STATE_COLORS[state]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || state === 'thinking') return
    handleQuery(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]" style={{ boxShadow: `inset 0 0 30px ${color}08` }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f1f1f] shrink-0" style={{ background: `${color}0d` }}>
        <div className="flex items-center gap-2">
          <Brain size={16} style={{ color }} />
          <span className="font-mono text-sm font-bold tracking-widest" style={{ color }}>JARVIS</span>
          <span className="text-[#555] font-mono text-[10px]">AI ANALYST</span>
          <div className="ml-auto flex items-center gap-2">
            <AnimatePresence>
              {state !== 'idle' && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[10px] font-bold"
                  style={{ color }}
                >
                  {STATE_LABELS[state]}
                </motion.span>
              )}
            </AnimatePresence>
            {isSupported && (
              <button
                onClick={toggleAlwaysListening}
                title={alwaysListening ? 'Disable always-on' : 'Enable always-on listening'}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  alwaysListening
                    ? 'border-[#00d37f] text-[#00d37f] bg-[#00d37f15]'
                    : 'border-[#333] text-[#555] hover:border-[#555]'
                }`}
              >
                {alwaysListening ? '● LIVE' : '○ LIVE'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2 border-b border-[#1a1a1a] flex gap-2 shrink-0 overflow-x-auto scrollbar-thin">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              onClick={() => handleQuery(action.prompt)}
              disabled={state === 'thinking'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded font-mono text-[9px] text-[#888] hover:text-[#ff6600] hover:border-[#ff6600]/40 hover:bg-[#ff6600]/5 transition-all whitespace-nowrap disabled:opacity-40"
            >
              <Icon size={10} />
              {action.label}
            </button>
          )
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-xs font-mono leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#1a1a1a] text-[#ccc] border border-[#2a2a2a]'
                  : 'text-[#e0e0e0] border border-[#1f1f1f]'
              }`}
              style={msg.role === 'jarvis' ? { background: `${color}0f`, borderColor: `${color}2a` } : {}}
            >
              {msg.role === 'jarvis' && (
                <div className="text-[10px] font-bold tracking-widest mb-1 opacity-60" style={{ color }}>
                  JARVIS
                </div>
              )}
              {msg.text}
            </div>
          </div>
        ))}

        {state === 'listening' && transcript && (
          <div className="flex justify-end">
            <div className="max-w-[90%] rounded-lg px-3 py-2 text-xs font-mono bg-[#1a1a1a] border border-[#333] text-[#888] italic">
              {transcript}...
            </div>
          </div>
        )}

        {state === 'thinking' && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 text-xs font-mono border"
              style={{ background: `${color}0f`, borderColor: `${color}2a` }}>
              <ThinkingDots color={color} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-[#1f1f1f] shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          {isSupported && (
            <button
              type="button"
              onClick={startListening}
              disabled={state === 'thinking' || state === 'listening'}
              className="w-8 h-8 rounded flex items-center justify-center border transition-all disabled:opacity-40"
              style={{
                borderColor: state === 'listening' ? color : '#2a2a2a',
                background: state === 'listening' ? `${color}1a` : '#1a1a1a',
                color: state === 'listening' ? color : '#666',
              }}
              title="Start voice input"
            >
              <motion.div
                animate={state === 'listening' ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                transition={{ duration: 0.5, repeat: state === 'listening' ? Infinity : 0 }}
              >
                <Mic size={13} />
              </motion.div>
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Ask JARVIS... or say "Hey Jarvis"'
            disabled={state === 'thinking'}
            className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-[#e8e8e8] font-mono text-xs px-3 py-2 rounded focus:outline-none focus:border-[#ff6600]/60 placeholder-[#444] transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={state === 'thinking' || !input.trim()}
            className="w-8 h-8 rounded flex items-center justify-center bg-[#ff6600] text-black font-bold transition-all disabled:opacity-40 hover:bg-[#ff7a1a]"
          >
            <Send size={13} />
          </button>
        </form>
        <div className="mt-1.5 text-[#333] font-mono text-[9px] text-center">
          {!isSupported ? 'Voice unavailable in this browser' : 'Voice + text • Not financial advice'}
        </div>
      </div>
    </div>
  )
}
