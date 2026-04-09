import { useCallback, useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { ErrorState, LoadingSkeleton, EmptyState } from '../../components/PageStates';
import {
  listCareerProblems,
  getCareerProblem,
  requestCareerHint,
  runCareerAttempt,
  submitCareerAttempt,
  getCareerDashboard,
  createCareerRoom,
  joinCareerRoom,
  getCareerRoom,
  startCareerRoom,
  submitDuelCode,
} from '../../utils/careerApi';
import { BookOpen, Brain, Sparkles, Swords, Trophy, Users } from 'lucide-react';

function ModeTabs({ mode, onMode }) {
  return (
    <div className="flex gap-2 p-1 rounded-xl border border-white/10 bg-black/25 w-fit">
      {[
        { id: 'solo', label: 'Solo' },
        { id: 'duel', label: 'Live duel' },
      ].map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onMode(t.id)}
          className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${
            mode === t.id ? 'bg-[rgba(139,92,246,0.35)] text-white border border-[rgba(139,92,246,0.45)]' : 'text-white/55 hover:text-white'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function ProblemArena() {
  const [mode, setMode] = useState('solo');
  const [state, setState] = useState({ loading: true, error: null, problems: [] });
  const [daily, setDaily] = useState(null);
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [hint, setHint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState(null);
  const [runResult, setRunResult] = useState(null);

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState(null);
  const [duelProblem, setDuelProblem] = useState(null);
  const [duelErr, setDuelErr] = useState(null);
  const [duelLoading, setDuelLoading] = useState(false);

  const load = async () => {
    setState({ loading: true, error: null, problems: [] });
    try {
      const data = await listCareerProblems();
      setState({ loading: false, error: null, problems: data.problems || [] });
    } catch {
      setState({ loading: false, error: 'Failed to load problems.', problems: [] });
    }
  };

  useEffect(() => {
    load();
    getCareerDashboard()
      .then((d) => setDaily(d?.dailyChallenge || null))
      .catch(() => {});
  }, []);

  const topics = useMemo(() => {
    const set = new Set(state.problems.map((p) => p.topic));
    return Array.from(set).sort();
  }, [state.problems]);

  const onSelect = (p) => {
    setSelected(p);
    setCode(p.starterCode || '');
    setHint('');
    setHintLevel(0);
    setReview(null);
  };

  const onHint = async (level) => {
    if (!selected) return;
    const next = Math.max(1, Math.min(3, level));
    setHintLevel(next);
    setHint('');
    try {
      const data = await requestCareerHint({
        problemId: selected.id,
        hintLevel: next,
        userCode: code,
      });
      setHint(data.hint || '');
    } catch {
      setHint('⚠️ Could not fetch hint. Ensure GROQ_API_KEY is set on the backend.');
    }
  };

  const onSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setReview(null);
    setRunResult(null);
    try {
      const data = await submitCareerAttempt({
        problemId: selected.id,
        code,
        language: 'javascript',
      });
      setReview(data.review || null);
    } catch {
      setReview({ summary: 'Submission failed. Check backend logs and GEMINI_API_KEY for reviews.' });
    } finally {
      setSubmitting(false);
    }
  };

  const onRun = async () => {
    if (!selected) return;
    setSubmitting(true);
    setRunResult(null);
    try {
      const data = await runCareerAttempt({ problemId: selected.id, code, language: 'javascript' });
      setRunResult(data.judge || null);
    } catch {
      setRunResult({ error: 'Run failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const refreshRoom = useCallback(async () => {
    if (!room?.roomId) return;
    try {
      const r = await getCareerRoom(room.roomId);
      setRoom((cur) => ({ ...cur, ...r }));
      const pid = r.status?.problemId;
      if (r.status?.phase === 'active' && pid) {
        const full = state.problems.find((p) => p.id === pid);
        if (full) {
          setDuelProblem((prev) => {
            if (prev?.id === pid) return prev;
            setCode(full.starterCode || '');
            return full;
          });
        } else {
          const { problem } = await getCareerProblem(pid);
          if (problem) {
            setDuelProblem((prev) => {
              if (prev?.id === pid) return prev;
              setCode(problem.starterCode || '');
              return problem;
            });
          }
        }
      }
    } catch {
      /* transient */
    }
  }, [room?.roomId, state.problems]);

  useEffect(() => {
    if (mode !== 'duel' || !room?.roomId) return;
    refreshRoom();
    const int = setInterval(refreshRoom, 1500);
    return () => clearInterval(int);
  }, [mode, room?.roomId, refreshRoom]);

  const startCreateRoom = async () => {
    setDuelErr(null);
    setDuelLoading(true);
    try {
      const r = await createCareerRoom();
      setRoom(r);
      setRoomCodeInput(r.roomCode);
      setDuelProblem(null);
    } catch {
      setDuelErr('Failed to create room.');
    } finally {
      setDuelLoading(false);
    }
  };

  const startJoinRoom = async () => {
    setDuelErr(null);
    setDuelLoading(true);
    try {
      const r = await joinCareerRoom(roomCodeInput.trim());
      setRoom(r);
      setDuelProblem(null);
    } catch {
      setDuelErr('Failed to join room.');
    } finally {
      setDuelLoading(false);
    }
  };

  const onHostStart = async () => {
    if (!room?.roomId) return;
    setDuelErr(null);
    setDuelLoading(true);
    try {
      const rly = await startCareerRoom(room.roomId);
      setDuelProblem(rly.problem);
      setCode(rly.problem?.starterCode || '');
      await refreshRoom();
    } catch (e) {
      setDuelErr(e?.response?.data?.error || 'Start failed.');
    } finally {
      setDuelLoading(false);
    }
  };

  const onDuelSubmit = async () => {
    if (!room?.roomId) return;
    setDuelLoading(true);
    setDuelErr(null);
    try {
      const res = await submitDuelCode(room.roomId, { code, language: 'javascript' });
      if (!res.passed && res.judge) {
        setRunResult(res.judge);
      } else {
        setRunResult(res.judge);
      }
      if (res.status) setRoom((cur) => ({ ...cur, status: res.status }));
    } catch (e) {
      setDuelErr(e?.response?.data?.error || 'Submit failed.');
    } finally {
      setDuelLoading(false);
    }
  };

  if (state.loading) return <LoadingSkeleton lines={8} className="career-card p-6" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (state.problems.length === 0) return <EmptyState icon="🏟️" title="No problems available yet" hint="Seed the curated problem set from the backend and reload." />;

  if (mode === 'duel') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">DSA Arena</div>
            <h1 className="font-display font-extrabold text-3xl mt-1">Live duels</h1>
            <p className="text-sm text-white/65 mt-2 max-w-2xl">
              Same Monaco editor as solo mode. Host starts the match; first passing solution earns bonus XP. Updates sync via fast refresh polling (add Supabase Realtime for instant events).
            </p>
          </div>
          <ModeTabs mode={mode} onMode={setMode} />
        </div>

        {duelErr && <ErrorState message={duelErr} onRetry={() => setDuelErr(null)} />}

        {!room ? (
          <div className="career-card p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-[12px] border border-[rgba(139,92,246,0.3)] p-5 bg-[#111118]/80">
                <div className="font-display font-extrabold text-xl">Create a room</div>
                <p className="text-sm text-white/65 mt-2">Share the code with your opponent.</p>
                <button type="button" onClick={startCreateRoom} disabled={duelLoading} className="career-btn mt-4">
                  <Swords size={16} /> {duelLoading ? 'Creating…' : 'Create'}
                </button>
              </div>
              <div className="rounded-[12px] border border-[rgba(139,92,246,0.3)] p-5 bg-[#111118]/80">
                <div className="font-display font-extrabold text-xl">Join a room</div>
                <p className="text-sm text-white/65 mt-2">Enter a room code.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <input
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value)}
                    className="flex-1 min-w-[160px] bg-black/30 border border-white/10 rounded-[12px] px-4 py-3 text-sm text-white outline-none"
                    placeholder="ROOM CODE"
                  />
                  <button type="button" onClick={startJoinRoom} disabled={duelLoading || !roomCodeInput.trim()} className="career-btn">
                    <Users size={16} /> Join
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="career-card p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Room</div>
                <div className="font-display font-extrabold text-2xl mt-1">{room.roomCode}</div>
                <p className="text-sm text-white/65 mt-2">Participants: {room.participants?.length ?? 0}</p>
              </div>
              <div className="flex gap-2">
                {(!room.status || room.status.phase === 'lobby') && (
                  <button type="button" onClick={onHostStart} disabled={duelLoading} className="career-btn">
                    Host: start duel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRoom(null);
                    setDuelProblem(null);
                    setRunResult(null);
                  }}
                  className="career-btn"
                >
                  Leave
                </button>
              </div>
            </div>

            {duelProblem && room.status?.phase === 'active' && (
              <>
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">{duelProblem.topic} · {duelProblem.difficulty}</div>
                  <h2 className="font-display font-extrabold text-xl mt-1">{duelProblem.title}</h2>
                  <p className="text-sm text-white/65 mt-2 whitespace-pre-wrap">{duelProblem.prompt}</p>
                </div>
                <div className="rounded-[12px] border border-white/10 overflow-hidden h-[280px]">
                  <Editor
                    height="280px"
                    theme="vs-dark"
                    defaultLanguage="javascript"
                    value={code}
                    onChange={(v) => setCode(v ?? '')}
                    options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>
                <button type="button" onClick={onDuelSubmit} disabled={duelLoading} className="career-btn">
                  Submit solution
                </button>
              </>
            )}

            {room.status?.winner && (
              <div className="rounded-[12px] border border-[rgba(6,182,212,0.35)] p-4 bg-[rgba(6,182,212,0.06)] text-sm text-white/85">
                Duel complete. Winner recorded (first to pass all tests).
              </div>
            )}

            {runResult && !selected && (
              <div className="rounded-[12px] border border-white/10 p-4 bg-white/[0.03] text-sm text-white/80">
                Tests: {runResult.passed}/{runResult.total}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">DSA Arena</div>
          <h1 className="font-display font-extrabold text-3xl mt-1">Solo practice</h1>
          <p className="text-sm text-white/65 mt-2 max-w-2xl">
            Monaco editor, three-tier AI hints on Groq, and Gemini-powered code review after submission.
          </p>
        </div>
        <ModeTabs mode={mode} onMode={setMode} />
      </div>

      {daily?.id && (
        <div className="career-card p-4 flex flex-wrap items-center justify-between gap-3 border border-[rgba(6,182,212,0.25)]">
          <div className="text-sm text-white/80">
            <span className="font-extrabold text-[var(--career-accent2)]">Daily challenge:</span> {daily.title}
            {daily.bonusXp ? <span className="text-white/55"> · +{daily.bonusXp} XP on pass</span> : null}
          </div>
          <button
            type="button"
            className="career-btn"
            onClick={() => {
              const p = state.problems.find((x) => x.id === daily.id);
              if (p) onSelect(p);
            }}
          >
            Open challenge
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="career-card p-5 xl:col-span-1">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Problem set</div>
              <div className="font-display font-extrabold text-xl mt-1">Curated</div>
            </div>
            <div className="career-chip">
              <Trophy size={14} /> {state.problems.length}
            </div>
          </div>

          <div className="text-xs text-white/55 mb-3">Topics: {topics.join(', ') || '—'}</div>
          <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
            {state.problems.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className={`w-full text-left px-4 py-3 rounded-[12px] border transition-colors ${
                  selected?.id === p.id ? 'border-[rgba(6,182,212,0.45)] bg-white/[0.08]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.title}</div>
                    <div className="text-xs text-white/55 mt-1">{p.topic} · {p.difficulty}</div>
                  </div>
                  <BookOpen size={18} className="text-white/40 flex-shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="career-card p-6 xl:col-span-2">
          {!selected ? (
            <div className="text-sm text-white/60 border border-white/10 rounded-[12px] p-6 bg-white/[0.03]">
              Select a problem. Use the hint ladder (nudge → approach → full). Submit for structured review.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">{selected.topic} · {selected.difficulty}</div>
                  <h2 className="font-display font-extrabold text-2xl mt-1">{selected.title}</h2>
                  <p className="text-sm text-white/65 mt-2 whitespace-pre-wrap">{selected.prompt}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={onRun} disabled={submitting} className="career-btn">
                    <Brain size={16} />
                    {submitting ? 'Running…' : 'Run tests'}
                  </button>
                  <button type="button" onClick={onSubmit} disabled={submitting} className="career-btn">
                    <Brain size={16} />
                    {submitting ? 'Reviewing…' : 'Submit for AI review'}
                  </button>
                </div>
              </div>

              <div className="rounded-[12px] border border-white/10 overflow-hidden h-[280px]">
                <Editor
                  height="280px"
                  theme="vs-dark"
                  defaultLanguage="javascript"
                  value={code}
                  onChange={(v) => setCode(v ?? '')}
                  options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono, monospace' }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => onHint(1)} className="career-btn" disabled={submitting}>
                  <Sparkles size={16} /> Nudge
                </button>
                <button type="button" onClick={() => onHint(2)} className="career-btn" disabled={submitting}>
                  <Sparkles size={16} /> Approach
                </button>
                <button type="button" onClick={() => onHint(3)} className="career-btn" disabled={submitting}>
                  <Sparkles size={16} /> Full walkthrough
                </button>
                {hintLevel > 0 && <span className="career-chip">Tier {hintLevel}/3</span>}
              </div>

              {hint && (
                <div className="border border-[rgba(6,182,212,0.25)] bg-[rgba(6,182,212,0.06)] rounded-[12px] p-5">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-accent2)] mb-2">AI hint (Groq)</div>
                  <div className="text-sm text-white/80 whitespace-pre-wrap">{hint}</div>
                </div>
              )}

              {review && (
                <div className="border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.06)] rounded-[12px] p-5">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-accent)] mb-2">AI review (Gemini)</div>
                  <div className="text-sm text-white/80 whitespace-pre-wrap">{review.summary || review}</div>
                  {review.complexity && (
                    <div className="mt-3 text-xs text-white/70">
                      Time: <span className="font-semibold">{review.complexity.time}</span> · Space: <span className="font-semibold">{review.complexity.space}</span>
                    </div>
                  )}
                </div>
              )}

              {runResult && (
                <div className="border border-white/10 bg-white/[0.03] rounded-[12px] p-5">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55 mb-2">Test run</div>
                  {runResult.error ? (
                    <div className="text-sm text-red-200">{runResult.error}</div>
                  ) : (
                    <div className="text-sm text-white/80 whitespace-pre-wrap">
                      Passed {runResult.passed}/{runResult.total}
                      {'\n'}
                      {Array.isArray(runResult.results) ? runResult.results.map((r, i) => `${r.ok ? '✅' : '❌'} Test ${i + 1}${r.error ? ` — ${r.error}` : ''}`).join('\n') : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
