import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import api from '../utils/api';
import { generateStudySchedule } from '../utils/ai';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  RotateCcw,
  CalendarDays,
  TrendingUp,
  BookOpen,
  RefreshCw,
  Info,
  CalendarPlus,
} from 'lucide-react';

/* ─────────────── Tab definitions ─────────────── */
const TABS = [
  { key: 'daily', label: 'Daily Plan', icon: CalendarDays },
  { key: 'schedule', label: 'AI Schedule', icon: Sparkles },
  { key: 'exams', label: 'Exam Dates', icon: CalendarPlus },
];

const tabPanelVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};

/* ═══════════════ DAILY PLAN TAB ═══════════════ */
function DailyPlanTab() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [minutes, setMinutes] = useState(150);
  const [error, setError] = useState('');
  const [dueCards, setDueCards] = useState([]);
  const [flipId, setFlipId] = useState(null);
  const [srsLoading, setSrsLoading] = useState(false);

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get('/study/companion/daily-plan/today');
      setPlan(data.plan);
    } catch (e) {
      setError(e.message || 'Could not load plan');
    }
    setLoading(false);
  };

  const loadSrs = async () => {
    try {
      const { data } = await api.get('/study/companion/srs/due');
      setDueCards(data.cards || []);
    } catch {
      setDueCards([]);
    }
  };

  useEffect(() => {
    load();
    loadSrs();
  }, []);

  const reviewCard = async (cardId, quality) => {
    setSrsLoading(true);
    try {
      await api.post('/study/companion/srs/review', { cardId, quality });
      setFlipId(null);
      await loadSrs();
    } catch (e) {
      setError(e.message || 'Review failed');
    }
    setSrsLoading(false);
  };

  const generate = async () => {
    setError('');
    setGenerating(true);
    try {
      const { data } = await api.post('/study/companion/daily-plan/generate', { minutesAvailable: minutes });
      setPlan(data.plan);
    } catch (e) {
      setError(e.message || 'Generation failed');
    }
    setGenerating(false);
  };

  const completeTask = async (taskId) => {
    if (!plan?.id) return;
    try {
      const { data } = await api.post('/study/companion/daily-plan/complete-task', {
        planId: plan.id,
        taskId,
      });
      setPlan(data.plan);
    } catch (e) {
      setError(e.message || 'Could not update task');
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#555555]">
        Each morning, generate an <strong>actionable</strong> plan from your quiz history, upcoming exams, due flashcards,
        and how much time you have. Completing tasks awards XP and keeps your streak alive.
      </p>

      <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold uppercase text-[#555555] mb-2">Minutes today</label>
          <input
            type="number"
            min={30}
            max={600}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 120)}
            className="w-28 border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm font-semibold"
          />
        </div>
        <button
          type="button"
          disabled={generating}
          onClick={generate}
          className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-5 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50"
        >
          {generating ? (
            <span className="w-4 h-4 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
          Generate today's plan
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => setError('')} />}

      {loading && <LoadingSkeleton lines={5} />}

      {!loading && !plan && !error && (
        <EmptyState
          title="No plan for today yet"
          hint="Set how many minutes you can study, then generate. The AI will break your session into concrete tasks with time boxes."
        />
      )}

      <div className="bg-white border-2 border-[#E0E0E0] rounded-[20px] p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display font-bold text-lg">Spaced repetition (due today)</h3>
          <button
            type="button"
            onClick={loadSrs}
            className="text-xs font-bold uppercase text-[#555555] flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-[#0D0D0D]"
          >
            <RotateCcw size={14} /> Refresh
          </button>
        </div>
        {dueCards.length === 0 ? (
          <p className="text-sm text-[#555555]">
            No cards due — wrong answers in the adaptive quiz auto-create cards here.
          </p>
        ) : (
          <ul className="space-y-3">
            {dueCards.slice(0, 12).map((c) => (
              <li key={c.id} className="border border-[#E0E0E0] rounded-xl p-4">
                <button
                  type="button"
                  className="w-full text-left border-none bg-transparent cursor-pointer"
                  onClick={() => setFlipId((id) => (id === c.id ? null : c.id))}
                >
                  <p className="text-xs font-bold text-[#888] uppercase">{c.subject}</p>
                  <p className="font-semibold text-[#0D0D0D] mt-1">{flipId === c.id ? c.back : c.front}</p>
                  <p className="text-[11px] text-[#999] mt-2">{flipId === c.id ? 'Tap to show front' : 'Tap to reveal answer'}</p>
                </button>
                {flipId === c.id && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-[10px] font-bold text-[#555555] w-full uppercase">How well did you recall?</span>
                    {[1, 2, 3, 4, 5].map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={srsLoading}
                        onClick={() => reviewCard(c.id, q)}
                        className="px-2 py-1 rounded-lg text-xs font-bold bg-[#F4F4F4] border border-[#E0E0E0] hover:bg-[#FFFF66] cursor-pointer disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {plan && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-[#FFFF66] rounded-[20px] overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-[#E0E0E0] bg-[#FFFEEE]">
            <h3 className="font-display font-bold text-lg text-[#0D0D0D]">{plan.title}</h3>
            <p className="text-xs text-[#555555] mt-1">
              {plan.tasks?.reduce((s, t) => s + (t.minutes || 0), 0) || 0} min total ·{' '}
              {plan.tasks?.filter((t) => t.done).length || 0}/{plan.tasks?.length || 0} done
            </p>
          </div>
          <ul className="divide-y divide-[#ECECEC]">
            {(plan.tasks || []).map((t) => (
              <li key={t.id} className="px-6 py-4 flex gap-4 items-start">
                <button
                  type="button"
                  onClick={() => !t.done && completeTask(t.id)}
                  disabled={t.done}
                  className="mt-0.5 flex-shrink-0 border-none bg-transparent cursor-pointer disabled:cursor-default p-0"
                  aria-label={t.done ? 'Completed' : 'Mark complete'}
                >
                  <CheckCircle2
                    size={22}
                    className={t.done ? 'text-green-600' : 'text-[#CCCCCC] hover:text-[#0D0D0D]'}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0D0D0D]">{t.title}</p>
                  {t.detail && <p className="text-sm text-[#555555] mt-1">{t.detail}</p>}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs font-semibold text-[#555555]">
                    <span className="inline-flex items-center gap-1 bg-[#F4F4F4] px-2 py-0.5 rounded-md">
                      <Clock size={12} /> {t.minutes} min
                    </span>
                    <span className="bg-[#F4F4F4] px-2 py-0.5 rounded-md">{t.type}</span>
                    <span className="bg-[#F4F4F4] px-2 py-0.5 rounded-md">{t.subject}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════ AI SCHEDULE TAB ═══════════════ */
const PRIORITY_COLORS = { high: '#FFB6C1', medium: '#FFFF66', low: '#87CEEB' };

function AccuracyBar({ value }) {
  const color = value >= 70 ? '#2d8a4e' : value >= 45 ? '#d97706' : '#e53e3e';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-[#E0E0E0] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

function AIScheduleTab() {
  const { eduData } = useAuth();
  const subjects = eduData?.subjects || [];

  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [session, setSession] = useState(null);

  const [goals, setGoals] = useState([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [errorSchedule, setErrorSchedule] = useState('');

  const loadGoals = async () => {
    try {
      const { data } = await api.get('/study/goals');
      setGoals(data.goals || []);
    } catch {
      setGoals([]);
    }
  };

  useEffect(() => {
    api.get('/session/today').then(({ data }) => setSession(data.session)).catch(() => {});
    fetchAIPrediction();
    loadGoals();
  }, []);

  const fetchAIPrediction = async (overrideHours) => {
    setLoadingAI(true); setAiError('');
    try {
      const { data } = await api.post('/ai-predict', { study_hours: overrideHours ?? hoursPerDay });
      setAiPrediction(data);
    } catch (err) {
      setAiError(err?.response?.data?.error || err?.message || 'AI prediction failed.');
    }
    setLoadingAI(false);
  };

  const handleGenerate = async () => {
    if (!goalTitle.trim()) return;
    setLoadingSchedule(true);
    setErrorSchedule('');
    try {
      await api.post('/study/goals', { title: goalTitle.trim(), deadline: goalDeadline || null });
      setGoalTitle('');
      setGoalDeadline('');
      await loadGoals();
    } catch (e) {
      setErrorSchedule(e.message || 'Generation failed');
    }
    setLoadingSchedule(false);
  };

  const toggleTask = async (goalId, sprintIndex, taskId, done) => {
    try {
      await api.post(`/study/goals/${goalId}/task`, { sprintIndex, taskId, done });
      await loadGoals();
    } catch (e) {
      setErrorSchedule(e.message || 'Failed to update task');
    }
  };

  const adjustGoal = async (goalId) => {
    try {
      await api.post(`/study/goals/${goalId}/adjust`, {});
      await loadGoals();
    } catch (e) {
      setErrorSchedule(e.message || 'Failed to adjust goal');
    }
  };

  const handleHoursChange = (h) => { setHoursPerDay(h); fetchAIPrediction(h); };

  const perfColor = (p) => p >= 80 ? '#2d8a4e' : p >= 60 ? '#d97706' : '#e53e3e';
  const perfBg = (p) => p >= 80 ? '#f0fdf4' : p >= 60 ? '#fffbeb' : '#fff5f5';
  const perfBorder = (p) => p >= 80 ? '#bbf7d0' : p >= 60 ? '#fde68a' : '#fecaca';

  return (
    <div className="space-y-6">
      {/* ── AI PREDICTION PANEL ── */}
      <div className="bg-[#0D0D0D] border-2 border-[#0D0D0D] rounded-[24px] p-7 text-white">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFFF66] border-2 border-[#FFFF66] rounded-[10px] flex items-center justify-center">
              <Sparkles size={18} className="text-[#0D0D0D]" />
            </div>
            <div>
              <h2 className="text-[18px] font-extrabold">AI Study Prediction</h2>
              <p className="text-white/50 text-xs">Powered by your quiz scores &amp; session data</p>
            </div>
          </div>
          <button onClick={() => fetchAIPrediction()} disabled={loadingAI}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-[8px] text-sm font-semibold transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loadingAI ? 'animate-spin-slow' : ''} />
            {loadingAI ? 'Running model…' : 'Refresh'}
          </button>
        </div>

        {aiError && (
          <div className="bg-red-900/40 border border-red-500/40 rounded-[10px] px-4 py-3 text-sm text-red-300 mb-4">
            ⚠️ {aiError}
          </div>
        )}

        {loadingAI && !aiPrediction && (
          <div className="flex items-center gap-3 py-4">
            <div className="w-5 h-5 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin-slow flex-shrink-0" />
            <span className="text-sm text-white/60">Running RandomForest prediction model…</span>
          </div>
        )}

        {aiPrediction && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {/* Recommended hours */}
              <div className="bg-[#FFFF66] border-2 border-[#FFFF66] rounded-[16px] px-5 py-4 text-[#0D0D0D]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock size={14} />
                  <span className="text-[11px] font-bold uppercase tracking-wide">Recommended Daily Hours</span>
                </div>
                <div className="text-[38px] font-extrabold font-display leading-none">{aiPrediction.recommended_hours}</div>
                <div className="text-[12px] font-semibold mt-1 opacity-60">
                  You set: {hoursPerDay}h/day &nbsp;·&nbsp;
                  {aiPrediction.recommended_hours > hoursPerDay
                    ? `+${(aiPrediction.recommended_hours - hoursPerDay).toFixed(1)}h suggested`
                    : aiPrediction.recommended_hours < hoursPerDay
                      ? 'Can take it a bit lighter'
                      : 'On target!'}
                </div>
              </div>

              {/* Predicted performance */}
              <div className="rounded-[16px] px-5 py-4 border-2"
                style={{ background: perfBg(aiPrediction.predicted_performance), borderColor: perfBorder(aiPrediction.predicted_performance) }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp size={14} style={{ color: perfColor(aiPrediction.predicted_performance) }} />
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: perfColor(aiPrediction.predicted_performance) }}>
                    Predicted Performance
                  </span>
                </div>
                <div className="text-[38px] font-extrabold font-display leading-none" style={{ color: perfColor(aiPrediction.predicted_performance) }}>
                  {aiPrediction.predicted_performance}<span className="text-lg">%</span>
                </div>
                <p className="text-[12px] font-semibold mt-1 opacity-60">If you study as recommended</p>
              </div>

              {/* Session stats */}
              {session && (
                <div className="bg-white/8 border border-white/12 rounded-[16px] px-5 py-4 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-3 text-white/50">Today's Session</p>
                  <div className="flex flex-col gap-1.5 text-sm">
                    {[['Online', session.totalOnlineMinutes + ' min'],['Active', session.activeMinutes + ' min'],['Breaks', session.breaks],['Focus', session.focusLevel + '/10']].map(([l,v]) => (
                      <div key={l} className="flex justify-between">
                        <span className="text-white/50">{l}</span>
                        <span className="font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Per-subject allocation */}
            {aiPrediction.timetable?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={13} className="text-white/50" />
                  <span className="text-[12px] font-bold text-white/60 uppercase tracking-wide">AI Hour Allocation per Subject</span>
                </div>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                  {aiPrediction.timetable.map((item, i) => (
                    <div key={i} className="bg-white/8 border border-white/10 rounded-[12px] px-4 py-3">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="text-sm font-bold leading-tight">{item.subject}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.priority === 'high' ? 'bg-[#FFB6C1]/20 border-[#FFB6C1]/40 text-[#FFB6C1]' :
                          item.priority === 'medium' ? 'bg-[#FFFF66]/20 border-[#FFFF66]/40 text-[#FFFF66]' :
                          'bg-[#87CEEB]/20 border-[#87CEEB]/40 text-[#87CEEB]'
                        }`}>{item.priority}</span>
                      </div>
                      <div className="text-[26px] font-extrabold font-display leading-none mt-1">
                        {item.allocatedHours}<span className="text-sm font-semibold text-white/40 ml-1">h</span>
                      </div>
                      <AccuracyBar value={item.accuracy} />
                      <p className="text-[10px] text-white/35 mt-1">
                        {item.lastQuizDate ? `Last quiz: ${item.lastQuizDate} · ${item.lastQuizScore}%` : 'No quiz yet — equal priority'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2 bg-white/5 border border-white/10 rounded-[10px] px-3.5 py-2.5">
                  <Info size={12} className="text-white/35 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Inputs → study_hours: {aiPrediction.inputs?.study_hours}h · focus: {aiPrediction.inputs?.focus_level}/10 · breaks: {aiPrediction.inputs?.breaks} · difficulty: {aiPrediction.inputs?.difficulty_level?.toFixed(2)} · prev_score: {aiPrediction.inputs?.previous_score} · Updates automatically after each quiz.
                  </p>
                </div>
              </div>
            )}

            {aiPrediction.timetable?.length === 0 && (
              <div className="bg-white/8 border border-white/10 rounded-[12px] px-4 py-4 text-sm text-white/50">
                📝 Take a quiz in any subject to unlock per-subject hour allocation. All subjects get equal time until then.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SCHEDULE GENERATOR ── */}
      <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] p-8">
        <h2 className="text-[20px] font-extrabold mb-1">📅 AI Sprint Scheduler</h2>
        <p className="text-sm text-[#555555] mb-5">AI turns your big goal into atomic, weekly sprints incorporating the subjects and predictions above.</p>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[13px] font-semibold block mb-2">Subject / Goal</label>
              <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="e.g. Master algorithms" className="w-full border-2 border-[#E0E0E0] rounded-[10px] px-4 py-3 text-[15px] outline-none focus:border-[#87CEEB]" />
            </div>
            <div>
              <label className="text-[13px] font-semibold block mb-2">Deadline (Optional)</label>
              <input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} className="w-full border-2 border-[#E0E0E0] rounded-[10px] px-4 py-3 text-[15px] outline-none focus:border-[#87CEEB]" />
            </div>
          </div>
          
          {errorSchedule && <div className="text-red-500 text-sm font-semibold">⚠️ {errorSchedule}</div>}

          <button onClick={handleGenerate} disabled={loadingSchedule || !goalTitle.trim()}
            className="mt-2 px-7 py-3.5 bg-[#0D0D0D] text-[#FFFF66] border-2 border-[#0D0D0D] rounded-[10px] font-display text-[15px] font-bold w-fit hover:-translate-y-0.5 hover:shadow-[3px_3px_0_rgba(0,0,0,0.15)] transition-all disabled:opacity-50">
            {loadingSchedule ? 'Building sprints…' : '📅 Generate Sprints'}
          </button>
        </div>
      </div>

      {/* ── SPRINT CARDS ── */}
      {goals.length > 0 && (
        <div className="space-y-6 animate-fadeUp">
          {goals.map((g) => (
            <div key={g.id} className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#F4F4F4] pb-4">
                <div>
                  <h3 className="font-display font-extrabold text-[18px]">{g.title}</h3>
                  <p className="text-xs font-semibold text-[#555555] mt-1">{g.deadline ? `Due ${g.deadline}` : 'Flexible'} · <span className="uppercase text-[#87CEEB]">{g.status}</span></p>
                </div>
                {g.status !== 'completed' && (
                  <button type="button" onClick={() => adjustGoal(g.id)} className="text-xs font-bold border-2 border-[#0D0D0D] rounded-[8px] px-4 py-2 bg-white hover:bg-[#F4F4F4] cursor-pointer transition-colors">
                    Roll incomplete tasks forward
                  </button>
                )}
              </div>
              
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {(g.weekly_sprints || []).map((sp, si) => (
                  <div key={si} className="border-[1.5px] border-[#E0E0E0] rounded-[16px] p-4 bg-[#F9F9F9]">
                    <div className="flex justify-between items-center mb-3">
                      <p className="font-bold text-[14px] text-[#0D0D0D]">Week {sp.week_index}: {sp.theme}</p>
                    </div>
                    <ul className="space-y-2.5">
                      {(sp.tasks || []).map((t) => (
                        <li key={t.id} className="flex items-start gap-3 text-sm bg-white p-3 rounded-[12px] border border-[#EEEEEE] shadow-sm">
                          <button
                            type="button"
                            aria-label="toggle"
                            onClick={() => toggleTask(g.id, si, t.id, !t.done)}
                            className="mt-0.5 border-none bg-transparent cursor-pointer p-0 shrink-0 hover:scale-110 transition-transform"
                          >
                            <CheckCircle2 size={18} className={t.done ? 'text-[#2d8a4e]' : 'text-[#CCCCCC] hover:text-[#0D0D0D]'} />
                          </button>
                          <div className="flex-1">
                            <span className={`font-semibold ${t.done ? 'line-through text-[#999999]' : 'text-[#0D0D0D]'}`}>{t.title}</span>
                            <div className="mt-1.5 flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wider">
                              <span className="text-[#0D0D0D] bg-[#FFFF66] px-1.5 py-0.5 rounded-md">{t.day}</span>
                              <span className="text-[#555555] bg-[#E0E0E0] px-1.5 py-0.5 rounded-md">{t.resource_type}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loadingSchedule && goals.length === 0 && (
        <div className="text-center py-14 flex flex-col items-center gap-3">
          <span className="text-5xl">🎯</span>
          <p className="text-[15px] font-semibold text-[#555555] max-w-[400px]">
            No sprint goals active. Enter a goal above to auto-generate a customized AI sprint schedule.
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ EXAM DATES TAB ═══════════════ */
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

function ExamDatesTab() {
  const { eduData } = useAuth();
  const subjects = eduData?.subjects || [];
  const [exams, setExams] = useState([]);
  const [form, setForm] = useState({ subject: subjects[0] || '', date: '', time: '', duration: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/exams')
      .then(({ data }) => setExams(data.exams || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveExams = async (updated) => {
    setSaving(true);
    try {
      await api.post('/exams', { exams: updated });
    } catch {}
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!form.subject || !form.date) return;
    const newExam = { id: newId(), ...form, createdAt: new Date().toISOString() };
    const updated = [...exams, newExam].sort((a, b) => new Date(a.date) - new Date(b.date));
    setExams(updated);
    setForm({ subject: subjects[0] || '', date: '', time: '', duration: '', notes: '' });
    setShowForm(false);
    await saveExams(updated);
  };

  const handleDelete = async (id) => {
    const updated = exams.filter((e) => e.id !== id);
    setExams(updated);
    await saveExams(updated);
  };

  const today = new Date();
  const upcoming = exams.filter((e) => new Date(e.date) >= today);
  const past = exams.filter((e) => new Date(e.date) < today);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const daysLeft = (d) => Math.ceil((new Date(d) - today) / 86400000);

  const inputCls = 'px-3.5 py-2.5 border-2 border-[#0D0D0D] rounded-[8px] text-sm outline-none focus:shadow-[0_0_0_3px_#87CEEB] transition-all w-full bg-white';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#555555]">
          {upcoming.length} upcoming exam{upcoming.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-5 py-2.5 bg-[#0D0D0D] text-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] text-sm font-bold font-display hover:-translate-y-0.5 hover:shadow-[3px_3px_0_rgba(0,0,0,0.2)] transition-all"
        >
          + Add Exam
        </button>
      </div>

      {showForm && (
        <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] p-6 animate-fadeUp">
          <h3 className="text-[17px] font-extrabold mb-4">New Exam</h3>
          <div className="grid grid-cols-2 gap-3 mb-3 max-md:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold">Subject *</label>
              <select
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className={inputCls}
              >
                {subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
                {subjects.length === 0 && <option>Add subjects in Profile first</option>}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold">Duration</label>
              <input
                type="text"
                placeholder="e.g. 3 hours"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2 max-md:col-span-1">
              <label className="text-[13px] font-semibold">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. Room 204, bring calculator"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 border-2 border-[#0D0D0D] rounded-[8px] bg-white text-sm font-semibold hover:bg-[#F0F0F0] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!form.subject || !form.date}
              className="flex-1 py-2.5 bg-[#0D0D0D] text-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] text-sm font-bold font-display disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Exam'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-[#555555] text-sm">Loading exams...</div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-[15px] font-bold mb-3 text-[#555555] uppercase tracking-wider text-xs">Upcoming</h3>
              <div className="flex flex-col gap-3">
                {upcoming.map((exam) => {
                  const dl = daysLeft(exam.date);
                  const urgency = dl <= 3 ? '#FFB6C1' : dl <= 7 ? '#FFFF66' : '#87CEEB';
                  return (
                    <div
                      key={exam.id}
                      className="bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#0D0D0D] transition-all"
                    >
                      <div
                        className="w-14 h-14 rounded-[12px] border-2 border-[#0D0D0D] flex flex-col items-center justify-center flex-shrink-0"
                        style={{ background: urgency }}
                      >
                        <span className="font-display text-xl font-extrabold leading-none">{dl}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide">day{dl !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-[15px]">{exam.subject}</h4>
                        <p className="text-sm text-[#555555]">
                          {formatDate(exam.date)}
                          {exam.time ? ` at ${exam.time}` : ''}
                          {exam.duration ? ` - ${exam.duration}` : ''}
                        </p>
                        {exam.notes && <p className="text-xs text-[#777777] mt-0.5">{exam.notes}</p>}
                      </div>
                      <button
                        onClick={() => handleDelete(exam.id)}
                        className="text-[#999999] hover:text-red-500 transition-colors text-lg p-1 bg-transparent border-none cursor-pointer"
                      >
                        x
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h3 className="text-[15px] font-bold mb-3 text-[#555555] uppercase tracking-wider text-xs">Past</h3>
              <div className="flex flex-col gap-2">
                {past.map((exam) => (
                  <div
                    key={exam.id}
                    className="bg-white border-2 border-[#E0E0E0] rounded-[12px] p-4 flex items-center gap-3 opacity-60"
                  >
                    <div className="w-10 h-10 rounded-[8px] bg-[#E0E0E0] border-2 border-[#CCCCCC] flex items-center justify-center text-sm">
                      OK
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{exam.subject}</h4>
                      <p className="text-xs text-[#555555]">{formatDate(exam.date)}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      className="text-[#CCCCCC] hover:text-red-400 transition-colors text-lg p-1 bg-transparent border-none cursor-pointer"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {exams.length === 0 && !showForm && (
            <div className="text-center py-20 flex flex-col items-center gap-3">
              <span className="text-5xl">[ ]</span>
              <p className="text-[15px] text-[#555555]">No exam dates added yet. Click "+ Add Exam" to get started.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════ MAIN PAGE ═══════════════ */
export default function StudyPlanner() {
  const [activeTab, setActiveTab] = useState('daily');

  const [tabKey, setTabKey] = useState(0);
  useEffect(() => {
    setTabKey((k) => k + 1);
  }, [activeTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'daily':
        return <DailyPlanTab key={tabKey} />;
      case 'schedule':
        return <AIScheduleTab key={tabKey} />;
      case 'exams':
        return <ExamDatesTab key={tabKey} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Study Planner" />
        <div className="p-8 flex-1 max-w-3xl w-full mx-auto max-sm:p-4 space-y-6">
          <p className="text-sm text-[#555555]">Your daily plan, AI schedule, and exam dates \u2014 all in one place</p>

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
