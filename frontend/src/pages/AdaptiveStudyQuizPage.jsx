import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Play, Target } from 'lucide-react';

export default function AdaptiveStudyQuizPage() {
  const { eduData } = useAuth();
  const subjects = eduData?.subjects || ['General'];
  const [subject, setSubject] = useState(subjects[0] || 'General');
  const [context, setContext] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFeedback, setLastFeedback] = useState(null);
  const [summary, setSummary] = useState(null);

  const start = async () => {
    setError('');
    setLoading(true);
    setSummary(null);
    setLastFeedback(null);
    try {
      const { data } = await api.post('/study/companion/adaptive/start', {
        subject,
        context: context.trim() || undefined,
        rounds: 8,
      });
      setSessionId(data.sessionId);
      setQuestion(data.question);
      setProgress(data.progress || { answered: 0, total: 8, currentQuestion: 1 });
    } catch (e) {
      setError(e.message || 'Could not start');
    }
    setLoading(false);
  };

  const answer = async (idx) => {
    if (!sessionId || !question) return;
    setError('');
    setLoading(true);
    setLastFeedback(null);
    try {
      const { data } = await api.post('/study/companion/adaptive/answer', {
        sessionId,
        selectedIndex: idx,
      });
      setLastFeedback({
        correct: data.correct,
        explanation: data.explanation,
        flashcardCreated: data.flashcardCreated,
      });
      setProgress(data.progress);
      if (data.done) {
        setQuestion(null);
        setSummary(data.sessionSummary);
        setSessionId(null);
      } else {
        setQuestion(data.nextQuestion);
      }
    } catch (e) {
      setError(e.message || 'Submit failed');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Adaptive Quiz" />
        <div className="p-8 flex-1 max-w-2xl w-full mx-auto max-sm:p-4 space-y-6">
          <p className="text-sm text-[#555555]">
            Difficulty shifts after every question. Wrong answers trigger a <strong>different-angle explanation</strong> and auto-create a{' '}
            <strong>spaced-repetition flashcard</strong>. When you finish, your <strong>exam readiness</strong> score updates for this subject.
          </p>

          {!sessionId && !question && !summary && (
            <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-4">
              <label className="block text-xs font-bold uppercase text-[#555555]">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm font-medium"
              >
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className="block text-xs font-bold uppercase text-[#555555]">Optional context (notes snippet)</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                placeholder="Paste a short paragraph from your notes to ground questions…"
                className="w-full border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm"
              />
              {error && <ErrorState message={error} onRetry={() => setError('')} />}
              <button
                type="button"
                disabled={loading}
                onClick={start}
                className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-6 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play size={18} />
                )}
                Start adaptive run
              </button>
            </div>
          )}

          {!sessionId && !question && !summary && !loading && (
            <EmptyState
              title="Ready when you are"
              hint="Eight questions per run. The system tightens or loosens difficulty based on how you’re performing in real time."
            />
          )}

          {loading && (sessionId || question) && <LoadingSkeleton lines={4} />}

          <AnimatePresence mode="wait">
            {question && !loading && (
              <motion.div
                key={question.question}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="bg-white border-2 border-[#FFFF66] rounded-[20px] p-6 space-y-4"
              >
                {progress && (
                  <div className="flex items-center justify-between text-xs font-bold text-[#555555]">
                    <span className="inline-flex items-center gap-1">
                      <Target size={14} /> Difficulty band: {question.difficulty}/5
                    </span>
                    <span>
                      Q {progress.currentQuestion ?? progress.answered + 1}/{progress.total}
                    </span>
                  </div>
                )}
                <p className="font-display font-bold text-lg leading-snug">{question.question}</p>
                <div className="grid gap-2">
                  {question.options.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => answer(i)}
                      disabled={loading}
                      className="text-left border-2 border-[#E0E0E0] rounded-xl px-4 py-3 text-sm font-medium hover:border-[#0D0D0D] hover:bg-[#FFFEEE] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <span className="font-bold text-[#888] mr-2">{String.fromCharCode(65 + i)}.</span>
                      {opt}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {lastFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-[16px] border-2 px-4 py-3 text-sm ${lastFeedback.correct ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}
            >
              <p className="font-bold mb-1">{lastFeedback.correct ? 'Nice — level up!' : 'Let’s fix that gap'}</p>
              {lastFeedback.explanation && <p className="whitespace-pre-wrap">{lastFeedback.explanation}</p>}
              {lastFeedback.flashcardCreated && (
                <p className="mt-2 text-xs font-semibold">Flashcard added to spaced repetition for this concept.</p>
              )}
            </motion.div>
          )}

          {summary && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0D0D0D] text-[#FFFF66] rounded-[20px] p-6 space-y-2"
            >
              <p className="font-display font-bold text-xl">Session complete</p>
              <p className="text-white/90 text-sm">
                Score {summary.attempt?.score}% · +{summary.xpGained} XP
              </p>
              {summary.readiness?.overall != null && (
                <p className="text-white/70 text-xs">Overall readiness index: {summary.readiness.overall}%</p>
              )}
              <button
                type="button"
                onClick={() => {
                  setSummary(null);
                  setLastFeedback(null);
                }}
                className="mt-4 bg-[#FFFF66] text-[#0D0D0D] font-bold px-4 py-2 rounded-xl border-none cursor-pointer"
              >
                Run again
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
