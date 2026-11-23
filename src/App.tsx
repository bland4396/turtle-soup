import React, { useEffect, useState } from 'react';
import { AVATARS, type HealthInfo, type PuzzleSummary } from './types';
import { useRoomSocket } from './hooks/useRoomSocket';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';

function getInitialRoomFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get('room') || '').replace(/\D/g, '').slice(0, 6);
}

export default function App() {
  const [urlRoom] = useState<string>(() => getInitialRoomFromUrl());
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>(() => localStorage.getItem('ts_nickname') || '');
  const [avatar, setAvatar] = useState<string>(
    () => localStorage.getItem('ts_avatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)]
  );
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);

  useEffect(() => {
    localStorage.setItem('ts_nickname', nickname);
  }, [nickname]);

  useEffect(() => {
    localStorage.setItem('ts_avatar', avatar);
  }, [avatar]);

  useEffect(() => {
    fetch('/api/puzzles')
      .then((r) => r.json())
      .then((d: { puzzles?: PuzzleSummary[] }) => {
        if (d.puzzles) setPuzzles(d.puzzles);
      })
      .catch(() => {});

    fetch('/api/health')
      .then((r) => r.json())
      .then((d: HealthInfo) => setHealth(d))
      .catch(() => {});
  }, [activeRoomCode]);

  const {
    connected,
    playerId,
    snapshot,
    error,
    clearError,
    askQuestion,
    submitGuess,
    sendChat,
    requestHint,
    revealTruth,
    startNextRound,
  } = useRoomSocket(activeRoomCode, nickname || '神秘侦探', avatar);

  const handleEnterRoom = (code: string) => {
    clearError();
    setActiveRoomCode(code);
    const nextUrl = `${window.location.pathname}?room=${encodeURIComponent(code)}`;
    window.history.replaceState({}, '', nextUrl);
  };

  const handleLeaveRoom = () => {
    setActiveRoomCode(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  if (activeRoomCode && snapshot) {
    return (
      <GameRoom
        snapshot={snapshot}
        connected={connected}
        playerId={playerId}
        puzzles={puzzles}
        onAsk={askQuestion}
        onGuess={submitGuess}
        onChat={sendChat}
        onHint={requestHint}
        onReveal={revealTruth}
        onNextRound={startNextRound}
        onLeave={handleLeaveRoom}
      />
    );
  }

  return (
    <div className="min-h-full">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-rose-500/90 text-white text-xs shadow-lg">
          {error}
        </div>
      )}
      <Lobby
        initialRoomCode={urlRoom}
        nickname={nickname}
        avatar={avatar}
        puzzles={puzzles}
        health={health}
        onChangeNickname={setNickname}
        onChangeAvatar={setAvatar}
        onEnterRoom={handleEnterRoom}
      />
    </div>
  );
}
