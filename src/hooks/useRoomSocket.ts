import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomSnapshot } from '../types';

export interface NextRoundPayload {
  mode: 'random' | 'builtin' | 'ai' | 'custom';
  puzzleId?: string;
  theme?: string;
  difficulty?: 1 | 2 | 3;
  customTitle?: string;
  customSurface?: string;
  customTruth?: string;
}

export function useRoomSocket(roomCode: string | null, playerName: string, avatar: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) {
      setSnapshot(null);
      setPlayerId(null);
      setConnected(false);
      return;
    }

    let closedByUser = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        ws.send(
          JSON.stringify({
            type: 'join',
            roomCode,
            name: playerName,
            avatar,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            type: string;
            playerId?: string;
            snapshot?: RoomSnapshot;
            message?: string;
          };
          if (msg.type === 'joined') {
            if (msg.playerId) setPlayerId(msg.playerId);
            if (msg.snapshot) setSnapshot(msg.snapshot);
            setError(null);
          } else if (msg.type === 'room_state') {
            if (msg.snapshot) setSnapshot(msg.snapshot);
          } else if (msg.type === 'error') {
            setError(msg.message || '连接出错');
          }
        } catch {
          // ignore invalid frame
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!closedByUser) {
          reconnectTimer = window.setTimeout(connect, 2200);
        }
      };

      ws.onerror = () => {
        setConnected(false);
      };
    };

    connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomCode, playerName, avatar]);

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const askQuestion = useCallback((content: string) => send({ type: 'ask', content }), [send]);
  const submitGuess = useCallback((content: string) => send({ type: 'guess', content }), [send]);
  const sendChat = useCallback((content: string) => send({ type: 'chat', content }), [send]);
  const requestHint = useCallback(() => send({ type: 'hint' }), [send]);
  const revealTruth = useCallback(() => send({ type: 'reveal' }), [send]);
  const startNextRound = useCallback(
    (payload: NextRoundPayload) => send({ type: 'next_round', ...payload }),
    [send]
  );

  return {
    connected,
    playerId,
    snapshot,
    error,
    clearError: () => setError(null),
    askQuestion,
    submitGuess,
    sendChat,
    requestHint,
    revealTruth,
    startNextRound,
  };
}
