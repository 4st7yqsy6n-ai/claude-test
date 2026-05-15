import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Volume2, Brain, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useJarvis, JarvisState } from './useJarvis'

const STATE_COLORS: Record<JarvisState, string> = {
  idle: '#ff6600',
  listening: '#00d37f',
  thinking: '#3b82f6',
  speaking: '#a855f7',
}

const STATE_LABELS: Record<JarvisState, string> = {
  idle: 'JARVIS',
  listening: 'LISTENING...',
  thinking: 'ANALYZING...',
  speaking: 'SPEAKING',
}

export function JarvisOrb() {
  const {
    state,
    messages,
    transcript,
    volume,
    isSupported,
    alwaysListening,
    startListening,
    toggleAlwaysListening,
  } = useJarvis()

  const [expanded, setExpanded] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const color = STATE_COLORS[state]

  useEffect(() => {
    if (showPanel) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showPanel])

  if (!isSupported) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-80 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-2xl"
            style={{ boxShadow: `0 0 40px ${color}22` }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]"
              style={{ background: `${color}15` }}
            >
              <div className="flex items-center gap-2">
                <Brain size={16} style={{ color }} />
                <span className="font-mono text-sm font-bold tracking-widest" style={{ color }}>
                  JARVIS
                </span>
                <span className="text-[10px] text-[#555] font-mono">AI ANALYST</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAlwaysListening}
                  title={alwaysListening ? 'Disable always-on' : 'Enable always-on listening'}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    alwaysListening
                      ? 'border-[#00d37f] text-[#00d37f] bg-[#00d37f15]'
                      : 'border-[#333] text-[#555] hover:border-[#555]'
                  }`}
                >
                  {alwaysListening ? '● LIVE' : '○ LIVE'}
                </button>
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-[#444] hover:text-[#888] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-72 overflow-y-auto p-3 space-y-3 scrollbar-thin">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-xs font-mono leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#1a1a1a] text-[#ccc] border border-[#2a2a2a]'
                        : 'text-[#e0e0e0] border border-[#1f1f1f]'
                    }`}
                    style={
                      msg.role === 'jarvis'
                        ? { background: `${color}12`, borderColor: `${color}33` }
                        : {}
                    }
                  >
                    {msg.role === 'jarvis' && (
                      <div
                        className="text-[10px] font-bold tracking-widest mb-1 opacity-60"
                        style={{ color }}
                      >
                        JARVIS
                      </div>
                    )}
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Live transcript */}
              {state === 'listening' && transcript && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs font-mono bg-[#1a1a1a] border border-[#333] text-[#888] italic">
                    {transcript}...
                  </div>
                </div>
              )}

              {state === 'thinking' && (
                <div className="flex justify-start">
                  <div
                    className="rounded-lg px-3 py-2 text-xs font-mono border"
                    style={{ background: `${color}12`, borderColor: `${color}33`, color }}
                  >
                    <ThinkingDots />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Commands hint */}
            <div className="border-t border-[#1f1f1f] px-3 py-2">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-mono text-[#444] hover:text-[#666] w-full"
              >
                {expanded ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                VOICE COMMANDS
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 space-y-1">
                      {EXAMPLE_COMMANDS.map((cmd) => (
                        <div key={cmd} className="text-[10px] font-mono text-[#444]">
                          <span style={{ color: `${color}99` }}>"</span>
                          {cmd}
                          <span style={{ color: `${color}99` }}>"</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orb */}
      <div className="flex items-center gap-3">
        {/* State label */}
        <AnimatePresence>
          {state !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="text-[11px] font-mono font-bold tracking-widest"
              style={{ color }}
            >
              {STATE_LABELS[state]}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main orb button */}
        <motion.button
          onClick={() => {
            if (state === 'idle') {
              setShowPanel(true)
              startListening()
            } else if (state === 'listening') {
              setShowPanel(true)
            } else {
              setShowPanel((v) => !v)
            }
          }}
          className="relative w-14 h-14 rounded-full flex items-center justify-center focus:outline-none"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${color}44, ${color}11)`,
            border: `2px solid ${color}`,
            boxShadow: `0 0 20px ${color}44, 0 0 40px ${color}22, inset 0 0 20px ${color}11`,
          }}
          whileTap={{ scale: 0.92 }}
        >
          {/* Pulse rings */}
          {(state === 'listening' || state === 'speaking') && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: color }}
                animate={{ scale: [1, 1.4 + volume * 0.4], opacity: [0.6, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: color }}
                animate={{ scale: [1, 1.7 + volume * 0.3], opacity: [0.4, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
              />
            </>
          )}

          {/* Thinking spinner */}
          {state === 'thinking' && (
            <motion.div
              className="absolute inset-1 rounded-full border-t-2"
              style={{ borderColor: color }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* Icon */}
          <div style={{ color }}>
            {state === 'idle' && <Brain size={22} />}
            {state === 'listening' && (
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
                <Mic size={22} />
              </motion.div>
            )}
            {state === 'thinking' && <Brain size={22} />}
            {state === 'speaking' && (
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.4, repeat: Infinity }}>
                <Volume2 size={22} />
              </motion.div>
            )}
          </div>
        </motion.button>
      </div>

      {/* Keyboard hint */}
      <div className="text-[9px] font-mono text-[#333] text-center">
        CLICK OR SAY "HEY JARVIS"
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

const EXAMPLE_COMMANDS = [
  'Hey Jarvis, show me the macro dashboard',
  'What is Apple doing today?',
  'Show me Bitcoin',
  'Give me a market briefing',
  'What are the top movers?',
  'Show me the yield curve',
  'What is the S&P 500 at?',
  'Any market risks I should know about?',
  'Show me the news',
  'Analyze Tesla for me',
]
