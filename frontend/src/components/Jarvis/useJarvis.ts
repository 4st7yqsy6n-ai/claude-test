import { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useMarketStore } from '../../stores/marketStore'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export type JarvisState = 'idle' | 'listening' | 'thinking' | 'speaking'

export interface JarvisMessage {
  id: string
  role: 'user' | 'jarvis'
  text: string
  timestamp: Date
}

export interface JarvisAction {
  type: 'navigate' | 'setSymbol' | 'none'
  view?: string
  symbol?: string
}

const WAKE_PHRASES = ['hey jarvis', 'jarvis', 'ok jarvis']

export function useJarvis() {
  const [state, setState] = useState<JarvisState>('idle')
  const [messages, setMessages] = useState<JarvisMessage[]>([
    {
      id: '0',
      role: 'jarvis',
      text: "Hello. I'm JARVIS, your AI trading analyst. Say \"Hey Jarvis\" or click the orb to activate me.",
      timestamp: new Date(),
    },
  ])
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const [volume, setVolume] = useState(0)
  const [alwaysListening, setAlwaysListening] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef(window.speechSynthesis)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const isListeningRef = useRef(false)

  const { setActiveView } = useUIStore()
  const { setSelectedSymbol } = useMarketStore()

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      setIsSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let interim = ''
        let final = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript
          if (event.results[i].isFinal) final += t
          else interim += t
        }
        setTranscript(final || interim)
        if (final) handleQuery(final)
      }

      recognition.onend = () => {
        if (isListeningRef.current && alwaysListening) {
          recognition.start()
        } else {
          isListeningRef.current = false
          if (state !== 'thinking' && state !== 'speaking') setState('idle')
        }
      }

      recognition.onerror = () => {
        isListeningRef.current = false
        setState('idle')
      }

      recognitionRef.current = recognition
    }

    return () => {
      recognitionRef.current?.abort()
      synthRef.current.cancel()
      cancelAnimationFrame(animFrameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alwaysListening])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current) return
    synthRef.current.cancel()
    setTranscript('')
    setState('listening')
    isListeningRef.current = true
    try {
      recognitionRef.current.start()
      startVolumeMonitor()
    } catch {
      isListeningRef.current = false
      setState('idle')
    }
  }, [])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    recognitionRef.current?.stop()
    cancelAnimationFrame(animFrameRef.current)
    setVolume(0)
  }, [])

  const startVolumeMonitor = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setVolume(Math.min(avg / 50, 1))
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // microphone not available, no volume viz
    }
  }

  const speak = useCallback((text: string) => {
    synthRef.current.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.05
    utterance.pitch = 0.85
    utterance.volume = 1

    // Prefer a deeper male voice (Jarvis-like)
    const voices = synthRef.current.getVoices()
    const preferred = voices.find(
      (v) =>
        v.name.toLowerCase().includes('google uk english male') ||
        v.name.toLowerCase().includes('daniel') ||
        v.name.toLowerCase().includes('alex') ||
        (v.lang === 'en-GB' && v.name.toLowerCase().includes('male'))
    )
    if (preferred) utterance.voice = preferred

    setState('speaking')
    utterance.onend = () => setState('idle')
    synthRef.current.speak(utterance)
  }, [])

  const addMessage = (role: 'user' | 'jarvis', text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role, text, timestamp: new Date() },
    ])
  }

  const handleQuery = useCallback(
    async (query: string) => {
      stopListening()

      // Check for wake phrase detection in always-on mode
      const lower = query.toLowerCase().trim()
      const activated = WAKE_PHRASES.some((w) => lower.startsWith(w))
      const cleanQuery = activated
        ? lower.replace(/^(hey jarvis|jarvis|ok jarvis)[,\s]*/i, '').trim()
        : lower

      if (!cleanQuery) {
        setState('idle')
        return
      }

      addMessage('user', query)
      setState('thinking')

      try {
        const res = await axios.post(`${API_URL}/api/ai/jarvis`, {
          query: cleanQuery,
          context: {
            currentView: useUIStore.getState().activeView,
            selectedSymbol: useMarketStore.getState().selectedSymbol,
            watchlist: useMarketStore.getState().watchlist,
          },
        })

        const { text, action } = res.data

        addMessage('jarvis', text)

        // Execute UI action
        if (action) {
          if (action.type === 'navigate' && action.view) {
            setActiveView(action.view as any)
          }
          if (action.type === 'setSymbol' && action.symbol) {
            setSelectedSymbol(action.symbol)
            setActiveView('terminal')
          }
          if (action.type === 'navigate_symbol' && action.symbol) {
            setSelectedSymbol(action.symbol)
            setActiveView('terminal')
          }
        }

        speak(text)
      } catch {
        const fallback =
          "I'm having trouble reaching the analysis server. Please check your connection."
        addMessage('jarvis', fallback)
        speak(fallback)
      }
    },
    [stopListening, speak, setActiveView, setSelectedSymbol]
  )

  const toggleAlwaysListening = () => {
    setAlwaysListening((v) => !v)
    if (!alwaysListening) startListening()
    else stopListening()
  }

  return {
    state,
    messages,
    transcript,
    volume,
    isSupported,
    alwaysListening,
    startListening,
    stopListening,
    toggleAlwaysListening,
    handleQuery,
  }
}
