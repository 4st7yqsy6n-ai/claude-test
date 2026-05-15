import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import type { WSMessage, WSPriceUpdate } from '@/types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
const RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 30000;

// Symbols to simulate live prices for when backend is unavailable
const SIMULATED_SYMBOLS = [
  'SPX', 'NDX', 'DJI', 'VIX', 'AAPL', 'MSFT', 'NVDA', 'META', 'AMZN',
  'GOOGL', 'TSLA', 'SPY', 'QQQ', 'GLD', 'EURUSD', 'GBPUSD', 'USDJPY',
  'BTCUSD', 'ETHUSD', 'XAUUSD', 'USOIL', 'US10Y', 'US2Y',
];

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectedRef = useRef(false);
  const { updateLivePrice, liveprices } = useMarketStore();

  const startSimulation = useCallback(() => {
    // Simulate live price updates when backend is unavailable
    simulationRef.current = setInterval(() => {
      const symbol = SIMULATED_SYMBOLS[Math.floor(Math.random() * SIMULATED_SYMBOLS.length)];
      const current = liveprices[symbol];
      if (!current) return;

      const volatility = symbol.includes('BTC') ? 0.003 : symbol.includes('JPY') ? 0.001 : 0.0008;
      const delta = (Math.random() - 0.5) * current.price * volatility;
      const newPrice = Math.max(0.01, current.price + delta);
      const newChange = current.change + delta;
      const basePrice = newPrice - newChange;
      const newChangePct = basePrice > 0 ? (newChange / basePrice) * 100 : 0;

      updateLivePrice(symbol, newPrice, newChange, newChangePct);
    }, 800 + Math.random() * 1200);
  }, [liveprices, updateLivePrice]);

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectedRef.current = true;
        stopSimulation();

        // Start heartbeat
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);

          if (msg.type === 'price_update') {
            const update = msg.data as WSPriceUpdate;
            updateLivePrice(update.symbol, update.price, update.change, update.change_pct);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        // Will trigger onclose
      };

      ws.onclose = () => {
        isConnectedRef.current = false;
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);

        // Start simulation as fallback
        startSimulation();

        // Attempt reconnect
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      };
    } catch {
      // WebSocket not available, start simulation
      startSimulation();
    }
  }, [updateLivePrice, startSimulation, stopSimulation]);

  useEffect(() => {
    // Start simulation immediately so UI feels alive
    startSimulation();

    // Try WebSocket connection
    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (simulationRef.current) clearInterval(simulationRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnection on unmount
        wsRef.current.close();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isConnected: isConnectedRef.current };
}
