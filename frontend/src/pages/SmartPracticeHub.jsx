import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import api from '../utils/api';
import { generateQuestions } from '../utils/ai';
import { useAuth } from '../context/AuthContext';
import {
  Zap,
  FlaskConical,
  ListChecks,
  FileQuestion,
  Play,
  Target,
  Wand2,
  Send,
  LifeBuoy,
  Flag,
  Brain,
  Trophy,
  Timer,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

/* ─────────────── Tab definitions ─────────────── */
const TABS = [
  { key: 'unified_quiz', label: 'AI Quiz Lab', icon: Brain },
  { key: 'practice', label: 'Practice Lab', icon: FlaskConical },
  { key: 'questions', label: 'Question Bank', icon: FileQuestion },
];

const tabPanelVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};


/* ═══════════════ PRACTICE LAB TAB ═══════════════ */
function PracticeLabTab() {
  const { eduData } = useAuth();
  const subjects = eduData?.subjects || ['General'];
  const [subject, setSubject] = useState(subjects[0] || 'General');
  const [focusTopic, setFocusTopic] = useState('');
  const [problem, setProblem] = useState(null);
  const [answerText, setAnswerText] = useState('');
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
    setAnswerText('');
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
    if (!problem?.id || !answerText.trim()) return;
    setError('');
    setLoading(true);
    setRemedial(null);
    try {
      const { data } = await api.post('/study/companion/practice/evaluate', {
        problemId: problem.id,
        answer: answerText.trim(),
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
    <div className="space-y-6">
      <p className="text-sm text-[#555555]">
        Problems target <strong>weak topics</strong> inferred from your quiz mistakes (and optional semantic focus via embeddings when HF is configured).
        Submit a solution for <strong>line-by-line feedback</strong>; if you're stuck, get a <strong>fresh explanation</strong> from a different approach.
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
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold uppercase text-[#555555] mb-1">Focus topic (optional)</label>
            <input
              value={focusTopic}
              onChange={(e) => setFocusTopic(e.target.value)}
              placeholder="e.g. L'Hospital's rule"
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
          hint="We'll bias the prompt toward topics you've missed on past quizzes. Add a focus topic to steer embeddings."
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
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
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
              I'm stuck — explain differently
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
  );
}


/* ═══════════════ QUESTION BANK TAB ═══════════════ */
function QuestionBankTab() {
  const { eduData } = useAuth();
  const subjects = eduData?.subjects || [];
  const [subject, setSubject] = useState(subjects[0] || '');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});

  const handleGenerate = async () => {
    setLoading(true);
    setQuestions([]);
    setAnswers({});
    try {
      const result = await generateQuestions(subject, topic || `General ${subject}`, count);
      setQuestions(result);
    } catch {
      setQuestions([]);
    }
    setLoading(false);
  };

  const TYPE_COLORS = { mcq: '#87CEEB', short: '#FFB6C1', long: '#FFFF66' };

  return (
    <div className="space-y-6">
      {/* Tip banner */}
      <div className="bg-[#0D0D0D] border-2 border-[#0D0D0D] rounded-[16px] px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-[#FFB6C1] rounded-[8px] flex items-center justify-center flex-shrink-0">
          <Brain size={17} className="text-[#0D0D0D]" />
        </div>
        <div>
          <p className="text-white text-sm font-bold">Want a <em>scored</em> quiz?</p>
          <p className="text-white/50 text-xs">Switch to the Scored Quiz tab — it grades you, tracks accuracy, and feeds the AI timetable model.</p>
        </div>
      </div>

      <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] p-8">
        <h2 className="text-[22px] font-extrabold mb-1.5">Generate Practice Questions</h2>
        <p className="text-sm text-[#555555] mb-6">Choose your subject and topic — generates mixed MCQ, short, and long-answer questions.</p>

        <div className="flex gap-3.5 flex-wrap items-end">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
            <label className="text-[13px] font-semibold">Subject *</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="px-3.5 py-[11px] border-2 border-[#0D0D0D] rounded-[8px] text-sm outline-none bg-white"
            >
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
            <label className="text-[13px] font-semibold">Topic / Chapter (optional)</label>
            <input
              type="text"
              placeholder="e.g. Quadratic Equations, Photosynthesis"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="px-3.5 py-[11px] border-2 border-[#0D0D0D] rounded-[8px] text-sm outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1.5 w-[140px]">
            <label className="text-[13px] font-semibold">No. of Questions</label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="px-3.5 py-[11px] border-2 border-[#0D0D0D] rounded-[8px] text-sm outline-none bg-white"
            >
              {[3, 5, 8, 10, 15].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-[11px] bg-[#0D0D0D] text-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] font-display text-[15px] font-bold hover:-translate-y-0.5 hover:shadow-[3px_3px_0_rgba(0,0,0,0.15)] transition-all disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate ✦'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 px-4">
          <div className="w-5 h-5 border-[3px] border-[#0D0D0D] border-t-transparent rounded-full animate-spin-slow" />
          <span className="text-sm text-[#555555]">Generating questions…</span>
        </div>
      )}

      {questions.length > 0 && (
        <div className="flex flex-col gap-4 animate-fadeUp">
          {questions.map((q, i) => (
            <div key={i} className="bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5">
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[11px] font-bold tracking-widest px-2.5 py-[3px] rounded-full border-[1.5px] border-[#0D0D0D]"
                  style={{ background: TYPE_COLORS[q.type] || '#87CEEB' }}
                >
                  {q.type?.toUpperCase()}
                </span>
                <span className="text-xs text-[#999] font-semibold">Q{i + 1}</span>
              </div>
              <p className="text-[15px] font-medium leading-relaxed mb-4">{q.question}</p>
              {q.type === 'mcq' && q.options && (
                <div className="flex flex-col gap-2">
                  {q.options.map((opt, j) => (
                    <button
                      key={j}
                      onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 border-2 rounded-[8px] text-sm text-left transition-all ${
                        answers[i] === j ? 'border-[#0D0D0D] bg-[#87CEEB] font-semibold' : 'border-[#E0E0E0] hover:border-[#0D0D0D] bg-white'
                      }`}
                    >
                      <span className="w-[22px] h-[22px] bg-[#0D0D0D] text-white rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                        {String.fromCharCode(65 + j)}
                      </span>
                      {opt}
                    </button>
                  ))}
                  {answers[i] !== undefined && (
                    <div className="mt-1 px-3.5 py-2.5 bg-[#f0fdf4] border-2 border-[#bbf7d0] rounded-[8px] text-[13px]">
                      <strong>Answer:</strong> {q.answer}
                    </div>
                  )}
                </div>
              )}
              {q.type !== 'mcq' && (
                <button
                  onClick={() => setAnswers((a) => ({ ...a, [i]: !a[i] }))}
                  className="mt-1 px-4 py-2 bg-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] text-[13px] font-semibold hover:bg-[#e6e600] transition-colors w-full text-left"
                >
                  {answers[i] ? `✓ Answer: ${q.answer}` : 'Reveal Answer'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ UNIFIED AI QUIZ LAB TAB ═══════════════ */
const pad = n => String(n).padStart(2, '0');
function fmtTime(secs) { return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`; }
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' \u00B7 ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
const PHASE = { SETUP: 'setup', LOADING: 'loading', QUIZ: 'quiz', RESULT: 'result' };

function AIQuizLabTab() {
  const { eduData } = useAuth();
  const navigate = useNavigate();
  const subjects = eduData?.subjects || [];

  const [phase, setPhase] = useState(PHASE.SETUP);
  const [subject, setSubject] = useState(subjects[0] || '');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState({});
  const [revealed, setRevealed] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [result, setResult] = useState(null);
  
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => { if (subject) loadHistory(subject); }, []);
  useEffect(() => { if (subject) loadHistory(subject); }, [subject]);

  const loadHistory = async (sub) => {
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/quiz/${encodeURIComponent(sub)}`);
      setHistory(data.attempts || []);
    } catch { setHistory([]); }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (phase === PHASE.QUIZ) {
      setStartedAt(new Date());
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const handleStart = async () => {
    setPhase(PHASE.LOADING);
    setSelected({}); setRevealed({});
    try {
      const { data } = await api.post('/ai/questions', {
        subject,
        context: topic || `General ${subject}`,
        count,
      });
      const qs = (data.questions || []).map(q => ({
        ...q,
        type: q.type || 'mcq',
        options: q.options || [],
      }));
      setQuestions(qs);
      setCurrentIdx(0);
      setPhase(PHASE.QUIZ);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to generate questions.';
      alert(`Failed to generate questions: ${message}`);
      setPhase(PHASE.SETUP);
    }
  };

  const selectAnswer = (qIdx, answer) => {
    if (selected[qIdx] !== undefined) return;
    setSelected(s => ({ ...s, [qIdx]: answer }));
  };

  const revealAnswer = (qIdx) => {
    setRevealed(r => ({ ...r, [qIdx]: true }));
  };

  const handleSubmit = async () => {
    clearInterval(timerRef.current);
    const timeTaken = Math.round((new Date() - startedAt) / 1000);
    let correct = 0;
    let gradeable = 0;
    questions.forEach((q, i) => {
      if (q.type === 'mcq') {
        gradeable++;
        const userAnswer = selected[i];
        if (userAnswer !== undefined) {
          const correctLetter = q.answer?.trim().charAt(0).toUpperCase();
          const selectedLetter = String.fromCharCode(65 + (q.options || []).indexOf(userAnswer));
          if (correctLetter && selectedLetter === correctLetter) correct++;
          else if (userAnswer === q.answer) correct++;
        }
      }
    });

    const totalGraded = gradeable;
    const totalQuestions = questions.length;
    const resultData = {
      subject,
      correct,
      total: totalGraded || totalQuestions,
      timeTakenSeconds: timeTaken,
      questions: questions.map((q, i) => ({
        question: q.question,
        type: q.type,
        topic: q.topic || 'general',
        userAnswer: selected[i] || null,
        correctAnswer: q.answer,
        options: q.options
      })),
    };

    setPhase(PHASE.RESULT);

    try {
      const { data } = await api.post('/quiz/save', resultData);
      setResult(data.attempt);
      loadHistory(subject);
    } catch {
      setResult({ ...resultData, score: Math.round((correct / (totalGraded || 1)) * 100) });
    }

    setAnalyzing(true);
    try {
      const { data: analysisData } = await api.post('/quiz/analyze', {
        subject: resultData.subject,
        questions: resultData.questions
      });
      setAnalysis(analysisData);
    } catch (e) {
      console.error('Analyze failed', e);
    }
    setAnalyzing(false);
  };

  const q = questions[currentIdx];
  const totalQ = questions.length;
  const answeredCount = Object.keys(selected).length + Object.keys(revealed).length;
  const progress = totalQ > 0 ? (currentIdx / totalQ) * 100 : 0;

  const scoreColor = (score) => score >= 80 ? '#2d8a4e' : score >= 50 ? '#d97706' : '#e53e3e';
  const scoreBg = (score) => score >= 80 ? '#f0fdf4' : score >= 50 ? '#fffbeb' : '#fff5f5';
  const scoreBorder = (score) => score >= 80 ? '#bbf7d0' : score >= 50 ? '#fde68a' : '#fecaca';

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#555555]">
        Test yourself with precision AI questions. Results track your proficiency, provide deep weakness analytics, and <strong>feed your AI study planner</strong>.
      </p>

      {/* ── SETUP ── */}
      {phase === PHASE.SETUP && (
        <div className="flex flex-col gap-5 animate-fadeUp">
          <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] p-8">
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-10 h-10 bg-[#FFB6C1] border-2 border-[#0D0D0D] rounded-[10px] flex items-center justify-center">
                <Brain size={20} />
              </div>
              <h2 className="text-[22px] font-extrabold">AI Quiz Lab</h2>
            </div>
            <p className="text-sm text-[#555555] mb-6">Choose any topic. Get graded. Review your weakness map.</p>

            <div className="flex gap-4 flex-wrap items-end">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
                <label className="text-[13px] font-semibold">Subject *</label>
                <select value={subject} onChange={e => setSubject(e.target.value)}
                  className="px-3.5 py-[11px] border-2 border-[#0D0D0D] rounded-[8px] text-sm outline-none bg-white">
                  {subjects.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                <label className="text-[13px] font-semibold">Topic / Chapter <span className="text-[#999]">(optional)</span></label>
                <input type="text" placeholder="e.g. Newton's Laws"
                  value={topic} onChange={e => setTopic(e.target.value)}
                  className="px-3.5 py-[11px] border-2 border-[#0D0D0D] rounded-[8px] text-sm outline-none focus:shadow-[0_0_0_3px_#87CEEB] transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold">Questions</label>
                <div className="flex gap-1.5">
                  {[5, 10, 15].map(n => (
                    <button key={n} onClick={() => setCount(n)}
                      className={`w-11 h-11 border-2 border-[#0D0D0D] rounded-[8px] text-sm font-bold transition-all ${count === n ? 'bg-[#0D0D0D] text-[#FFFF66]' : 'bg-white hover:bg-[#F0F0F0]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={handleStart}
              className="mt-6 px-7 py-3.5 bg-[#FFB6C1] border-2 border-[#0D0D0D] rounded-[8px] font-display text-[15px] font-bold hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#0D0D0D] transition-all flex items-center gap-2">
              <Brain size={16} /> Generate & Start
            </button>
          </div>

          <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] overflow-hidden">
            <div className="px-6 py-4 border-b-2 border-[#0D0D0D] bg-[#F9F9F9] flex items-center justify-between">
              <h3 className="text-[17px] font-extrabold">History — {subject}</h3>
              <span className="text-xs text-[#555555] font-semibold">{history.length} attempt{history.length !== 1 ? 's' : ''}</span>
            </div>
            {loadingHistory ? (
              <div className="p-6 text-center text-sm text-[#555555]">Loading history…</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[40px] mb-2">📝</p>
                <p className="text-sm text-[#555555]">No quizzes yet for {subject}. Take your first one!</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3.5 hover:bg-[#F9F9F9] transition-colors">
                    <div>
                      <p className="text-sm font-semibold">{h.subject}</p>
                      <p className="text-xs text-[#555555] mt-0.5">{fmtDateTime(h.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-[#555555]">{h.correct}/{h.total} correct</p>
                        <p className="text-xs text-[#555555]">Difficulty: {h.difficulty?.toFixed(1)}</p>
                      </div>
                      <div className="w-14 h-14 rounded-full border-[3px] border-[#0D0D0D] flex flex-col items-center justify-center flex-shrink-0"
                        style={{ background: `conic-gradient(${scoreColor(h.score)} calc(${h.score} * 1%), #E0E0E0 0)` }}>
                        <span className="font-display text-sm font-extrabold">{h.score}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {phase === PHASE.LOADING && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fadeIn">
          <div className="w-16 h-16 border-4 border-[#0D0D0D] border-t-[#FFB6C1] rounded-full animate-spin-slow" />
          <p className="text-[17px] font-bold">Generating {count} questions for {subject}…</p>
          <p className="text-sm text-[#555555]">Hang tight, your personalised quiz is being prepared!</p>
        </div>
      )}

      {/* ── QUIZ ── */}
      {phase === PHASE.QUIZ && q && (
        <div className="flex flex-col gap-4 animate-fadeIn max-w-[700px]">
          {/* Header bar */}
          <div className="flex items-center justify-between bg-white border-2 border-[#0D0D0D] rounded-[16px] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-sm">{subject}</span>
              <span className="text-[#999] text-sm">\u2022</span>
              <span className="text-sm font-semibold text-[#555555]">Q{currentIdx + 1} / {totalQ}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#0D0D0D] text-[#FFFF66] px-3 py-1.5 rounded-[8px] font-display font-bold text-sm">
              <Timer size={14} /> {fmtTime(elapsed)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-[#E0E0E0] rounded-full overflow-hidden">
            <div className="h-full bg-[#FFB6C1] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {/* Question card */}
          <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6">
            <div className="flex items-center justify-between mb-4">
              <span className={`text-[11px] font-bold tracking-widest px-2.5 py-[3px] rounded-full border-[1.5px] border-[#0D0D0D] ${
                q.type === 'mcq' ? 'bg-[#87CEEB]' : q.type === 'short' ? 'bg-[#FFB6C1]' : 'bg-[#FFFF66]'
              }`}>{q.type?.toUpperCase()}</span>
              <span className="text-xs font-semibold text-[#999]">{answeredCount} answered</span>
            </div>

            <p className="text-[16px] font-semibold leading-relaxed mb-5">{q.question}</p>

            {/* MCQ */}
            {q.type === 'mcq' && q.options?.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {q.options.map((opt, j) => {
                  const letter = String.fromCharCode(65 + j);
                  const isSelected = selected[currentIdx] === opt;
                  const isLocked = selected[currentIdx] !== undefined;
                  const correctLetter = q.answer?.trim().charAt(0).toUpperCase();
                  const isCorrect = isLocked && letter === correctLetter;
                  const isWrong = isLocked && isSelected && !isCorrect;
                  return (
                    <button key={j} onClick={() => selectAnswer(currentIdx, opt)}
                      className={`flex items-center gap-3 px-4 py-3 border-2 rounded-[10px] text-sm text-left transition-all w-full ${
                        isCorrect ? 'border-green-500 bg-[#f0fdf4] font-semibold' :
                        isWrong ? 'border-red-400 bg-[#fff5f5]' :
                        isSelected ? 'border-[#0D0D0D] bg-[#87CEEB] font-semibold' :
                        isLocked ? 'border-[#E0E0E0] opacity-60 cursor-default' :
                        'border-[#E0E0E0] hover:border-[#0D0D0D] hover:bg-[#F9F9F9] cursor-pointer'
                      }`}>
                      <span className="w-7 h-7 rounded-full bg-[#0D0D0D] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{letter}</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />}
                      {isWrong && <XCircle size={16} className="text-red-400 flex-shrink-0" />}
                    </button>
                  );
                })}
                {selected[currentIdx] !== undefined && (
                  <div className="mt-1 px-4 py-2.5 bg-[#f0fdf4] border-2 border-[#bbf7d0] rounded-[8px] text-[13px]">
                    <strong>Correct answer:</strong> {q.answer}
                  </div>
                )}
              </div>
            )}

            {/* Short / Long answer */}
            {q.type !== 'mcq' && (
              <div>
                {!revealed[currentIdx] ? (
                  <button onClick={() => revealAnswer(currentIdx)}
                    className="px-5 py-2.5 bg-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] text-sm font-bold hover:-translate-y-0.5 transition-all">
                    Reveal Answer
                  </button>
                ) : (
                  <div className="px-4 py-3.5 bg-[#fffbeb] border-2 border-[#fde68a] rounded-[10px] text-sm leading-relaxed">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#d97706] mb-1.5">Model Answer</p>
                    {q.answer}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3 justify-between">
            <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
              className="px-5 py-2.5 border-2 border-[#0D0D0D] rounded-[8px] text-sm font-semibold bg-white hover:bg-[#F0F0F0] disabled:opacity-40 disabled:cursor-default transition-colors">
              \u2190 Prev
            </button>
            <div className="flex gap-1.5 items-center flex-1 justify-center overflow-x-auto">
              {questions.map((_, i) => (
                <button key={i} onClick={() => setCurrentIdx(i)}
                  className={`w-8 h-8 rounded-full border-[1.5px] text-xs font-bold flex-shrink-0 transition-all ${
                    i === currentIdx ? 'bg-[#0D0D0D] text-[#FFFF66] border-[#0D0D0D]' :
                    (selected[i] !== undefined || revealed[i]) ? 'bg-[#FFB6C1] border-[#0D0D0D]' :
                    'bg-white border-[#E0E0E0] hover:border-[#0D0D0D]'
                  }`}>{i + 1}</button>
              ))}
            </div>
            {currentIdx < totalQ - 1 ? (
              <button onClick={() => setCurrentIdx(i => i + 1)}
                className="px-5 py-2.5 bg-[#0D0D0D] text-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] text-sm font-bold hover:opacity-85 transition-opacity flex items-center gap-1.5">
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={handleSubmit}
                className="px-5 py-2.5 bg-[#FFB6C1] border-2 border-[#0D0D0D] rounded-[8px] text-sm font-bold hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#0D0D0D] transition-all flex items-center gap-1.5">
                <Trophy size={14} /> Submit
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {phase === PHASE.RESULT && result && (
        <div className="flex flex-col gap-5 animate-fadeUp">
          <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] p-8 text-center max-w-[600px] mx-auto w-full">
            <div className="w-24 h-24 rounded-full border-4 border-[#0D0D0D] mx-auto mb-5 flex flex-col items-center justify-center"
              style={{ background: `conic-gradient(${scoreColor(result.score)} calc(${result.score} * 1%), #E0E0E0 0)` }}>
              <span className="font-display text-[28px] font-extrabold leading-tight">{result.score}</span>
              <span className="text-xs text-[#555555]">/ 100</span>
            </div>
            <h2 className="text-[24px] font-extrabold mb-1.5">
              {result.score >= 80 ? '🎉 Excellent!' : result.score >= 60 ? '👍 Good job!' : '💪 Keep practicing!'}
            </h2>
            <p className="text-sm text-[#555555] mb-6">
              {result.correct} / {result.total} correct • {fmtTime(result.timeTakenSeconds || 0)} taken
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Score', val: `${result.score}%`, bg: scoreBg(result.score), border: scoreBorder(result.score) },
                { label: 'Difficulty', val: result.difficulty?.toFixed(1), bg: '#fffbeb', border: '#fde68a' },
                { label: 'Prev Score', val: `${result.previousScore}%`, bg: '#f5f5f5', border: '#e0e0e0' },
              ].map(({ label, val, bg, border }) => (
                <div key={label} className="rounded-[12px] border-2 py-3 px-2"
                  style={{ background: bg, borderColor: border }}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#555555] mb-0.5">{label}</p>
                  <p className="text-[20px] font-extrabold font-display">{val}</p>
                </div>
              ))}
            </div>

            <p className="text-[13px] text-[#555555] mb-6 px-4">
              ✅ Your quiz data has been saved and will be used to personalise your AI study timetable.
            </p>

            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => { setPhase(PHASE.SETUP); setQuestions([]); setSelected({}); setRevealed({}); }}
                className="flex items-center gap-1.5 px-5 py-2.5 border-2 border-[#0D0D0D] rounded-[8px] bg-white text-sm font-semibold hover:bg-[#F0F0F0] transition-colors">
                <RotateCcw size={14} /> New Quiz
              </button>
              <button onClick={() => navigate('/study/planner')}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0D0D0D] text-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] text-sm font-bold hover:-translate-y-0.5 transition-all">
                View AI Timetable →
              </button>
            </div>
          </div>
          
          {/* WEAKNESS ANALYSIS SECTION ENHANCED FROM MOCK EXAM */}
          <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] p-8 max-w-[800px] mx-auto w-full">
             {analyzing ? (
               <div className="flex flex-col items-center justify-center p-6 gap-3">
                 <div className="w-8 h-8 border-[3px] border-[#0D0D0D] border-t-transparent rounded-full animate-spin" />
                 <p className="font-bold text-sm text-[#0D0D0D]">Analyzing weaknesses...</p>
               </div>
             ) : analysis ? (
               <div className="space-y-6">
                 <div>
                   <div className="flex items-center gap-2 mb-3">
                     <Brain size={18} className="text-[#0D0D0D]" />
                     <h3 className="font-display font-bold text-[18px]">Weakness Map</h3>
                   </div>
                   {analysis.weakness_map?.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {analysis.weakness_map.map((w, i) => (
                         <div key={i} className="text-sm border-2 border-[#E0E0E0] rounded-[12px] p-3.5 bg-[#F9F9F9]">
                           <div className="flex justify-between items-start mb-1">
                             <span className="font-extrabold text-[#0D0D0D]">{w.topic}</span>
                             <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-100 px-2 py-0.5 rounded-full">Severity {w.severity}</span>
                           </div>
                           <p className="text-[#555555] text-xs leading-relaxed">{w.hint}</p>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <p className="text-sm text-[#555555] italic">Stellar performance! No critical weaknesses detected.</p>
                   )}
                 </div>

                 {analysis.revision_plan?.length > 0 && (
                   <div className="pt-4 border-t-2 border-[#E0E0E0]">
                     <h3 className="font-display font-bold text-[18px] mb-4">Recommended 3-Day Revision</h3>
                     <div className="space-y-3">
                       {analysis.revision_plan.map((d) => (
                         <div key={d.day} className="flex gap-4 p-4 border-2 border-[#0D0D0D] rounded-[16px] bg-white">
                           <div className="w-12 h-12 bg-[#FFFF66] border-2 border-[#0D0D0D] rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-lg">
                             D{d.day}
                           </div>
                           <div className="flex-1">
                             <ul className="list-disc pl-4 space-y-1.5 mt-1">
                               {d.tasks?.map((t, i) => (
                                 <li key={i} className="text-[13px] font-medium text-[#111]">{t}</li>
                               ))}
                             </ul>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             ) : (
                <p className="text-sm text-[#555555]">Analysis highly dependent on completed questions...</p>
             )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ MAIN HUB PAGE ═══════════════ */
export default function SmartPracticeHub() {
  const [activeTab, setActiveTab] = useState('unified_quiz');

  /* State-isolation key — forces child remount on tab switch */
  const [tabKey, setTabKey] = useState(0);
  useEffect(() => {
    setTabKey((k) => k + 1);
  }, [activeTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'unified_quiz':
        return <AIQuizLabTab key={tabKey} />;
      case 'practice':
        return <PracticeLabTab key={tabKey} />;
      case 'questions':
        return <QuestionBankTab key={tabKey} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Smart Practice Hub" />
        <div className="p-8 flex-1 max-w-3xl w-full mx-auto max-sm:p-4 space-y-6">
          {/* Subtitle */}
          <p className="text-sm text-[#555555]">All your AI-powered practice tools in one place</p>

          {/* ── Pill tab bar ── */}
          <div className="flex flex-wrap gap-1.5 bg-white border-2 border-[#0D0D0D] rounded-[16px] p-1.5">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border-none cursor-pointer ${
                    active
                      ? 'bg-[#0D0D0D] text-[#FFFF66]'
                      : 'bg-transparent text-[#555555] hover:bg-[#F0F0F0]'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>

          {/* ── Tab content ── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabPanelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
