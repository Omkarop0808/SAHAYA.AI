import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import api from '../utils/api';
import { Plus, CheckCircle2 } from 'lucide-react';

export default function GoalsSprints() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/study/goals');
      setGoals(data.goals || []);
    } catch {
      setGoals([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError('');
    try {
      await api.post('/study/goals', { title: title.trim(), deadline: deadline || null });
      setTitle('');
      setDeadline('');
      await load();
    } catch (e) {
      setError(e.message);
    }
    setCreating(false);
  };

  const toggleTask = async (goalId, sprintIndex, taskId, done) => {
    try {
      await api.post(`/study/goals/${goalId}/task`, { sprintIndex, taskId, done });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const adjust = async (goalId) => {
    try {
      await api.post(`/study/goals/${goalId}/adjust`, {});
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-[#F9F9F9] min-w-0">
        <DashHeader title="Goals & Weekly Sprints" />
        <div className="p-8 max-w-3xl mx-auto w-full space-y-8 max-sm:p-4">
          <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-3">
            <h3 className="font-display font-bold">New goal</h3>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Master linear algebra for midterm" className="w-full border-2 rounded-xl px-4 py-3" />
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full border-2 rounded-xl px-4 py-3" />
            {error && <ErrorState message={error} />}
            <button type="button" onClick={create} disabled={creating} className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-5 py-3 rounded-xl border-none cursor-pointer">
              <Plus size={18} /> Decompose with AI
            </button>
          </div>

          {loading && <LoadingSkeleton lines={6} />}

          {!loading && goals.length === 0 && (
            <EmptyState title="No goals yet" hint="Set one big goal — Gemini breaks it into weekly sprints and linkable tasks." />
          )}

          {!loading && goals.map((g) => (
            <div key={g.id} className="bg-white border-2 border-[#E0E0E0] rounded-[20px] p-6 space-y-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-lg">{g.title}</h3>
                  <p className="text-xs text-[#555555]">{g.deadline ? `Due ${g.deadline}` : 'Flexible'} · {g.status}</p>
                </div>
                <button type="button" onClick={() => adjust(g.id)} className="text-xs font-bold border-2 border-[#0D0D0D] rounded-lg px-3 py-1.5 bg-transparent cursor-pointer">
                  Roll incomplete forward
                </button>
              </div>
              {(g.weekly_sprints || []).map((sp, si) => (
                <div key={si} className="border border-[#EEEEEE] rounded-xl p-4">
                  <p className="font-bold text-sm mb-2">Week {sp.week_index}: {sp.theme}</p>
                  <ul className="space-y-2">
                    {(sp.tasks || []).map((t) => (
                      <li key={t.id} className="flex items-start gap-2 text-sm">
                        <button
                          type="button"
                          aria-label="toggle"
                          onClick={() => toggleTask(g.id, si, t.id, !t.done)}
                          className="mt-0.5 border-none bg-transparent cursor-pointer p-0"
                        >
                          <CheckCircle2 size={18} className={t.done ? 'text-green-600' : 'text-[#CCCCCC]'} />
                        </button>
                        <div>
                          <span className={t.done ? 'line-through text-[#999999]' : ''}>{t.title}</span>
                          <span className="text-[10px] uppercase tracking-wide text-[#888888] ml-2">{t.day} · {t.resource_type}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
