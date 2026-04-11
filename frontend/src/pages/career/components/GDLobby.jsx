import React, { useState, useEffect } from 'react';
import GDVideoRoom from './GDVideoRoom';
import { useSocket } from '../../../context/SocketContext';
import { User } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-900/40 text-red-100 rounded-xl max-w-lg mx-auto mt-20 border border-red-500">
          <h2 className="text-2xl font-bold mb-4">CRASH: Video Room Failed to Load</h2>
          <pre className="text-xs whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 rounded">Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function GDLobbyInternal({ config, eduData, onEndGd }) {
  const socket = useSocket();
  const [matchData, setMatchData] = useState(null);
  const [isSearching, setIsSearching] = useState(true);
  const [waitlist, setWaitlist] = useState([]);

  // Ready Check States
  const [roomStarted, setRoomStarted] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const reqSize = config.gdParticipants || 4;
    const topicDesc = config.subject || 'General Tech';
    const uName = eduData?.name || 'Student';

    // emit join
    socket.emit('join_gd_lobby', {
      name: uName,
      requestedSize: reqSize,
      topic: topicDesc
    });

    const handleMatch = (data) => {
      setMatchData(data);
      setIsSearching(false);
    };

    const handleUpdate = (newList) => {
      setWaitlist(newList);
    };

    const handleReadyUpdate = (count) => {
      setReadyCount(count);
    };

    const handleRoomStart = () => {
      setRoomStarted(true);
    };

    const handleMatchCancelled = () => {
      setMatchData(null);
      setRoomStarted(false);
      setReadyCount(0);
      setIsReady(false);
      setIsSearching(true);
    };

    socket.on('gd_match_found', handleMatch);
    socket.on('lobby_update', handleUpdate);
    socket.on('gd_ready_update', handleReadyUpdate);
    socket.on('gd_start_room', handleRoomStart);
    socket.on('gd_match_cancelled', handleMatchCancelled);

    return () => {
      socket.emit('leave_gd_lobby');
      socket.off('gd_match_found', handleMatch);
      socket.off('lobby_update', handleUpdate);
      socket.off('gd_ready_update', handleReadyUpdate);
      socket.off('gd_start_room', handleRoomStart);
      socket.off('gd_match_cancelled', handleMatchCancelled);
    };
  }, [socket, config, eduData]);

  /* ── PHASE 3: All ready → render Video Room ── */
  if (matchData && roomStarted) {
    return (
      <GDVideoRoom
        roomId={matchData.roomId}
        participants={matchData.participants}
        duration={config.duration}
        topic={config.subject || 'General Tech'}
        onEnd={onEndGd}
      />
    );
  }

  /* ── PHASE 2: Match found → Ready Check screen ── */
  if (matchData && !roomStarted) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[var(--career-text)] min-h-[60vh]">
        <h2 className="text-4xl font-extrabold mb-4 text-green-400 drop-shadow-md tracking-tight">
          Match Found!
        </h2>
        <p className="text-[var(--career-muted)] mb-8 max-w-sm text-center">
          Your Group Discussion room is ready. Please confirm your attendance.
        </p>

        <div className="bg-[var(--career-surface)] border border-[var(--career-border)] rounded-2xl p-8 max-w-sm w-full text-center flex flex-col items-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="text-5xl font-mono font-bold mb-2 text-[var(--career-text)] drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
            {readyCount}{' '}
            <span className="text-2xl text-[var(--career-muted)]">/ {matchData.participants.length}</span>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] font-extrabold text-[var(--career-accent)] mb-8">
            Users Ready
          </div>

          {!isReady ? (
            <button
              onClick={() => {
                setIsReady(true);
                socket.emit('gd_player_ready', { roomId: matchData.roomId });
              }}
              className="w-full py-4 rounded-xl font-bold text-lg bg-[linear-gradient(135deg,#10B981,#059669)] text-[var(--career-text)] shadow-xl hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:brightness-110 active:scale-95 transition-all transform hover:-translate-y-1"
            >
              I'm Ready
            </button>
          ) : (
            <div className="w-full py-4 rounded-xl font-bold text-lg bg-[var(--career-surface)] border border-[var(--career-border)] text-[var(--career-muted)] cursor-not-allowed flex items-center justify-center gap-3">
              <span className="animate-spin h-5 w-5 border-2 border-white/50 border-t-transparent rounded-full"></span>
              Waiting for others...
            </div>
          )}
        </div>

        <p className="text-xs text-[var(--career-muted)] font-medium mt-6 text-center max-w-xs">
          *If a participant fails to ready up or disconnects, the group will automatically disband.
        </p>
      </div>
    );
  }

  /* ── PHASE 1: Searching / Lobby queue ── */
  const searchTopic = config.subject || 'General Tech';
  const matchingQueue = waitlist.filter(
    (w) => w.requestedSize === config.gdParticipants && w.topic === searchTopic
  );
  const otherQueue = waitlist.filter(
    (w) => w.requestedSize !== config.gdParticipants || w.topic !== searchTopic
  );

  return (
    <div className="flex flex-col items-center justify-center p-12 text-[var(--career-text)] min-h-[60vh]">
      <div className="relative mb-8">
        <div className="animate-spin h-24 w-24 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <span className="text-xl">&#9203;</span>
        </div>
      </div>
      <h2 className="text-3xl font-bold mb-4 tracking-wide text-center">Finding GD Partners...</h2>
      <p className="text-[var(--career-muted)] text-sm mb-8 text-center max-w-sm">
        We are matching you with {config.gdParticipants - 1} other student(s) interested in{' '}
        <strong className="text-[var(--career-accent)]">{searchTopic}</strong>.
      </p>

      <div className="w-full max-w-md mt-4 text-left">
        <h3 className="text-xs font-bold text-[var(--career-accent)] uppercase tracking-widest mb-3">
          Live Queue ({matchingQueue.length}/{config.gdParticipants})
        </h3>

        <div className="flex flex-col gap-3">
          {matchingQueue.length === 0 ? (
            <div className="text-center py-4 text-[var(--career-muted)] text-sm">
              You are the first one here for this configuration.
            </div>
          ) : (
            matchingQueue.map((user, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 bg-[var(--career-surface)] rounded-lg p-3 border border-[var(--career-border)]"
              >
                <div className="h-10 w-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                  <User size={18} />
                </div>
                <div className="text-sm font-bold text-[var(--career-text)] text-opacity-90">{user.name}</div>
              </div>
            ))
          )}

          {/* Render empty slots */}
          {Array.from({ length: Math.max(0, config.gdParticipants - matchingQueue.length) }).map(
            (_, idx) => (
              <div
                key={`empty-${idx}`}
                className="flex items-center gap-3 bg-[var(--career-surface)] border border-dashed border-[var(--career-border)] rounded-lg p-3 opacity-50"
              >
                <div className="h-10 w-10 bg-[var(--career-surface)] rounded-full flex items-center justify-center text-[var(--career-muted)] opacity-50">
                  <User size={18} />
                </div>
                <div className="text-sm font-medium text-[var(--career-muted)] italic">Waiting...</div>
              </div>
            )
          )}
        </div>

        {otherQueue.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[var(--career-border)]">
            <h3 className="text-xs font-bold text-[var(--career-muted)] uppercase tracking-widest mb-3">
              Other Students Waiting
            </h3>
            <div className="flex flex-col gap-2">
              {otherQueue.map((user, idx) => (
                <div
                  key={`other-${idx}`}
                  className="flex flex-col bg-[var(--career-surface)] border border-[var(--career-border)] rounded p-2 px-3"
                >
                  <div className="text-sm text-[var(--career-muted)] font-medium">{user.name || 'Student'}</div>
                  <div className="text-[10px] text-[var(--career-muted)]">
                    Looking for GD on {user.topic} ({user.requestedSize} peers)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 px-6 py-3 bg-[var(--career-surface)] rounded-lg text-sm text-[var(--career-text)] shadow-xl border border-[var(--career-border)]">
        Socket Connected:{' '}
        <span className={socket ? 'text-green-400 font-medium' : 'text-yellow-400 font-medium'}>
          {socket ? 'Yes' : 'Connecting...'}
        </span>
      </div>
    </div>
  );
}

export default function GDLobby(props) {
  return (
    <ErrorBoundary>
      <GDLobbyInternal {...props} />
    </ErrorBoundary>
  );
}
