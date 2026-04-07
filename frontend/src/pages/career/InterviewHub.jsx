import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorState } from '../../components/PageStates';
import api from '../../utils/api';
import { Send, Wand2 } from 'lucide-react';

async function startInterview(track = 'dsa', focusTopics = '') {
  const { data } = await api.post('/career/interview/start', { track, focusTopics });
  return data;
}

async function interviewTurn(sessionId, answer) {
  const { data } = await api.post('/career/interview/turn', { sessionId, answer });
  return data;
}

async function finalizeInterview(sessionId) {
  const { data } = await api.post('/career/interview/final', { sessionId });
  return data;
}

export default function InterviewHub() {
  const [searchParams] = useSearchParams();
  const focusHint = searchParams.get('focus') || '';
  const [track, setTrack] = useState('dsa');
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [err, setErr] = useState(null);

  const begin = async () => {
    setErr(null);
    setAssessment(null);
    setLoading(true);
    try {
      const focusTopics = focusHint ? decodeURIComponent(focusHint) : '';
      const s = await startInterview(track, focusTopics);
      setSession(s);
      setHistory([{ role: 'assistant', content: s.question }]);
    } catch {
      setErr('Failed to start interview. Ensure GROQ_API_KEY is set on the backend.');
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!session || !input.trim()) return;
    const answer = input.trim();
    setInput('');
    setLoading(true);
    setHistory((h) => [...h, { role: 'user', content: answer }]);
    try {
      const t = await interviewTurn(session.sessionId, answer);
      setHistory((h) => [...h, { role: 'assistant', content: t.question }]);
    } catch {
      setErr('Interview turn failed.');
    } finally {
      setLoading(false);
    }
  };

  const end = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const r = await finalizeInterview(session.sessionId);
      setAssessment(r.assessment || null);
    } catch {
      setErr('Failed to generate final report.');
    } finally {
      setLoading(false);
    }
  };

  const canChat = Boolean(session) && !assessment;
  const title = useMemo(() => {
    if (track === 'system') return 'System Design';
    if (track === 'behavioral') return 'Behavioral';
    return 'DSA';
  }, [track]);

  if (err) return <ErrorState message={err} onRetry={() => setErr(null)} />;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Interview Prep Hub</div>
          <h1 className="font-display font-extrabold text-3xl mt-1">AI Mock Interview ({title})</h1>
          <p className="text-sm text-white/65 mt-2 max-w-2xl">
            Groq-powered back-and-forth with RAG-grounded patterns. Session ends with a Gemini JSON report saved to your profile.
            {focusHint ? (
              <span className="block mt-2 text-[var(--career-accent2)] font-semibold">
                Focus from Resume Hub: {decodeURIComponent(focusHint)}
              </span>
            ) : null}
          </p>
        </div>
        <div className="career-card p-4 flex items-center gap-3">
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none"
            disabled={Boolean(session)}
          >
            <option value="dsa">DSA</option>
            <option value="system">System Design</option>
            <option value="behavioral">Behavioral</option>
          </select>
          {!session ? (
            <button type="button" onClick={begin} disabled={loading} className="career-btn">
              <Wand2 size={16} /> {loading ? 'Starting…' : 'Start'}
            </button>
          ) : (
            <button type="button" onClick={end} disabled={loading} className="career-btn">
              <Wand2 size={16} /> {loading ? 'Generating…' : 'End & Report'}
            </button>
          )}
        </div>
      </div>

      <div className="career-card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-white/55">Session</div>
        </div>
        <div className="p-6 space-y-4 max-h-[55vh] overflow-auto">
          {history.length === 0 ? (
            <div className="text-sm text-white/60 border border-white/10 rounded-2xl p-6 bg-white/[0.03]">
              Start a session to receive your first question.
            </div>
          ) : (
            history.map((m, i) => (
              <div key={i} className={`border rounded-[12px] p-4 ${m.role === 'user' ? 'border-[rgba(6,182,212,0.25)] bg-[rgba(6,182,212,0.06)]' : 'border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.06)]'}`}>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55 mb-2">
                  {m.role === 'user' ? 'You' : 'Interviewer'}
                </div>
                <div className="text-sm text-white/85 whitespace-pre-wrap">{m.content}</div>
              </div>
            ))
          )}

          {assessment && (
            <div className="space-y-4">
              <div className="career-card p-6">
                <div className="career-kicker">Interview Assessment</div>
                <div className="flex items-end justify-between gap-4 flex-wrap mt-2">
                  <div className="font-display font-extrabold text-3xl">
                    {assessment.overallScore}% <span className="text-white/60 text-lg font-extrabold">{assessment.verdict}</span>
                  </div>
                  <div className="career-chip">Details below</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                  {(assessment.categoryScores || []).map((c) => (
                    <div key={c.name} className="border border-white/10 rounded-2xl p-4 bg-white/[0.03]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{c.name}</div>
                        <div className="career-chip">{c.score}%</div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, c.score))}%`, background: 'linear-gradient(90deg, var(--career-accent), var(--career-accent2))' }} />
                      </div>
                      {c.notes && <div className="text-sm text-white/70 mt-3">{c.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="border border-white/10 rounded-2xl p-5 bg-white/[0.03]">
                  <div className="career-kicker mb-2">Strengths</div>
                  <ul className="text-sm text-white/80 space-y-1">
                    {(assessment.strengths || []).slice(0, 6).map((s, i) => <li key={i}>- {s}</li>)}
                  </ul>
                </div>
                <div className="border border-white/10 rounded-2xl p-5 bg-white/[0.03]">
                  <div className="career-kicker mb-2">Areas to improve</div>
                  <ul className="text-sm text-white/80 space-y-1">
                    {(assessment.improvements || []).slice(0, 6).map((s, i) => <li key={i}>- {s}</li>)}
                  </ul>
                </div>
                <div className="border border-white/10 rounded-2xl p-5 bg-white/[0.03]">
                  <div className="career-kicker mb-2">Next topics</div>
                  <ul className="text-sm text-white/80 space-y-1">
                    {(assessment.nextTopics || []).slice(0, 8).map((s, i) => <li key={i}>- {s}</li>)}
                  </ul>
                </div>
              </div>

              {assessment.report && (
                <div className="border border-white/10 rounded-2xl p-5 bg-white/[0.03]">
                  <div className="career-kicker mb-2">Report</div>
                  <div className="text-sm text-white/80 whitespace-pre-wrap">{assessment.report}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 bg-[#050816]/60">
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!canChat || loading}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none disabled:opacity-60"
              placeholder={canChat ? 'Type your answer…' : 'Start a session to answer'}
            />
            <button type="button" className="career-btn" onClick={send} disabled={!canChat || loading}>
              <Send size={16} /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

