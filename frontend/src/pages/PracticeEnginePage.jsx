import { useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Wand2, Send, LifeBuoy } from 'lucide-react';

export default function PracticeEnginePage() {
  const { eduData } = useAuth();
  const subjects = eduData?.subjects || ['General'];
  const [subject, setSubject] = useState(subjects[0] || 'General');
  const [focusTopic, setFocusTopic] = useState('');
  const [problem, setProblem] = useState(null);
  const [answer, setAnswer] = useState('');
  const [evalResult, setEvalResult] = useState(null);
  const [remedial, setRemedial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setError('');
    setLoading(true);
    setProblem(null);
    setEvalResult(null);
    setRemedial(null);
    setAnswer('');
    try {
      const { data } = await api.post('/study/companion/practice/generate', {
        subject,
        focusTopic: focusTopic.trim() || undefined,
      });
      setProblem(data.problem);
    } catch (e) {
      setError(e.message || 'Could not generate');
    }
    setLoading(false);
  };

  const evaluate = async (stuck) => {
    if (!problem?.id || !answer.trim()) return;
    setError('');
    setLoading(true);
    setRemedial(null);
    try {
      const { data } = await api.post('/study/companion/practice/evaluate', {
        problemId: problem.id,
        answer: answer.trim(),
        stuck: !!stuck,
      });
      if (data.mode === 'remedial') {
        setRemedial(data.explanation);
        setEvalResult(null);
      } else {
        setEvalResult(data.evaluation);
      }
    } catch (e) {
      setError(e.message || 'Evaluation failed');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Practice Lab" />
        <div className="p-8 flex-1 max-w-3xl w-full mx-auto max-sm:p-4 space-y-6">
          <p className="text-sm text-[#555555]">
            Problems target <strong>weak topics</strong> inferred from your quiz mistakes (and optional semantic focus via embeddings when HF is configured).
            Submit a solution for <strong>line-by-line feedback</strong>; if you’re stuck, get a <strong>fresh explanation</strong> from a different approach (Claude when available).
          </p>

          <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#555555] mb-1">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm font-medium min-w-[160px]"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold uppercase text-[#555555] mb-1">Focus topic (optional)</label>
                <input
                  value={focusTopic}
                  onChange={(e) => setFocusTopic(e.target.value)}
                  placeholder="e.g. L’Hospital’s rule"
                  className="w-full border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={generate}
              className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-5 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50"
            >
              {loading && !problem ? (
                <span className="w-4 h-4 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Wand2 size={18} />
              )}
              Generate targeted problem
            </button>
          </div>

          {error && <ErrorState message={error} onRetry={() => setError('')} />}

          {loading && !problem && <LoadingSkeleton lines={5} />}

          {!problem && !loading && (
            <EmptyState
              title="No active problem"
              hint="We’ll bias the prompt toward topics you’ve missed on past quizzes. Add a focus topic to steer embeddings."
            />
          )}

          {problem && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-[#FFFF66] rounded-[20px] p-6 space-y-4"
            >
              <div className="flex justify-between items-center text-xs font-bold text-[#555555]">
                <span>Difficulty ~{problem.difficulty}/5</span>
              </div>
              <p className="font-display font-bold text-lg whitespace-pre-wrap">{problem.prompt}</p>
              {problem.hints?.length > 0 && (
                <div className="text-sm bg-[#F9F9F9] rounded-xl p-4 border border-[#E0E0E0]">
                  <p className="font-bold text-xs uppercase text-[#555555] mb-2">Hints</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {problem.hints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={8}
                placeholder="Write your full solution here…"
                className="w-full border-2 border-[#E0E0E0] rounded-xl px-4 py-3 text-sm font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => evaluate(false)}
                  className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-5 py-2.5 rounded-xl border-none cursor-pointer disabled:opacity-50"
                >
                  {loading && !remedial ? (
                    <span className="w-4 h-4 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Get feedback
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => evaluate(true)}
                  className="inline-flex items-center gap-2 bg-white border-2 border-[#0D0D0D] text-[#0D0D0D] font-bold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  <LifeBuoy size={16} />
                  I’m stuck — explain differently
                </button>
              </div>
            </motion.div>
          )}

          {evalResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-3"
            >
              <p className="font-display font-bold text-lg">
                Score: {evalResult.score_0_100 ?? evalResult.score ?? '—'}/100
              </p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {(evalResult.feedback_bullets || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              {(evalResult.line_by_line || []).length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-bold uppercase text-[#555555]">Line by line</p>
                  {(evalResult.line_by_line || []).map((row, i) => (
                    <div key={i} className="text-sm border border-[#ECECEC] rounded-lg p-3">
                      <p className="text-[#888] text-xs font-mono mb-1">{row.fragment}</p>
                      <p>{row.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {remedial && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-[#FFFEEE] border-2 border-[#FFFF66] rounded-[20px] p-6 text-sm whitespace-pre-wrap leading-relaxed"
            >
              <p className="font-bold mb-2">Different approach</p>
              {remedial}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
