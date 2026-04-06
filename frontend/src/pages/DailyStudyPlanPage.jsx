import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import api from '../utils/api';
import { Sparkles, CheckCircle2, Clock, RotateCcw } from 'lucide-react';

export default function DailyStudyPlanPage() {
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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Daily Study Plan" />
        <div className="p-8 flex-1 max-w-3xl w-full mx-auto max-sm:p-4 space-y-6">
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
              Generate today’s plan
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
      </div>
    </div>
  );
}
