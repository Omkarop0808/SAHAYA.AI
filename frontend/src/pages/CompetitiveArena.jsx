import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, ErrorState } from '../components/PageStates';
import api from '../utils/api';

export default function CompetitiveArena() {
  const [tab, setTab] = useState('duel');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('Science');
  const [duel, setDuel] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [answers, setAnswers] = useState({});
  const [boss, setBoss] = useState(null);
  const [squadName, setSquadName] = useState('');
  const [squadInvite, setSquadInvite] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, lb, b] = await Promise.all([
        api.get('/study/arena/summary'),
        api.get('/study/arena/leaderboard'),
        api.get('/study/arena/boss'),
      ]);
      setSummary(s.data);
      setLeaderboard(lb.data.leaderboard || []);
      setBoss(b.data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const createDuel = async () => {
    const { data } = await api.post('/study/arena/duel/create', { topic });
    setDuel(data.duel);
    setAnswers({});
  };

  const joinDuel = async () => {
    const { data } = await api.post('/study/arena/duel/join', { code: joinCode });
    setDuel(data.duel);
    setAnswers({});
  };

  const submitDuel = async () => {
    if (!duel) return;
    await api.post(`/study/arena/duel/${duel.id}/submit`, { answers });
    await refresh();
  };

  const submitBoss = async () => {
    if (!boss?.boss) return;
    await api.post('/study/arena/boss/submit', { answers });
    setAnswers({});
    await refresh();
  };

  const createSquad = async () => {
    await api.post('/study/arena/squad/create', { name: squadName });
    setSquadName('');
    await refresh();
  };

  const joinSquad = async () => {
    await api.post('/study/arena/squad/join', { invite: squadInvite });
    setSquadInvite('');
    await refresh();
  };

  const bossQs = boss?.boss?.questions || [];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-[#F9F9F9] min-w-0">
        <DashHeader title="Competitive Arena" />
        <div className="p-8 max-w-4xl mx-auto w-full space-y-6 max-sm:p-4">
          <div className="flex flex-wrap gap-2">
            {['duel', 'boss', 'squad', 'board'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`px-4 py-2 rounded-xl font-bold text-sm border-2 cursor-pointer ${tab === k ? 'bg-[#0D0D0D] text-[#FFFF66] border-[#0D0D0D]' : 'bg-white border-[#E0E0E0]'}`}
              >
                {k === 'board' ? 'Leaderboard' : k}
              </button>
            ))}
          </div>

          {loading && <LoadingSkeleton />}
          {error && <ErrorState message={error} onRetry={refresh} />}

          {tab === 'duel' && !loading && (
            <div className="space-y-4">
              <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-3">
                <input value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full border-2 rounded-xl px-3 py-2" />
                <button type="button" onClick={createDuel} className="bg-[#0D0D0D] text-[#FFFF66] font-bold px-4 py-2 rounded-xl border-none cursor-pointer">Create duel (share code)</button>
                <div className="flex gap-2">
                  <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="CODE" className="border-2 rounded-xl px-3 py-2 w-32" />
                  <button type="button" onClick={joinDuel} className="border-2 border-[#0D0D0D] font-bold px-4 py-2 rounded-xl bg-white cursor-pointer">Join</button>
                </div>
              </div>
              {duel && (
                <div className="bg-white border-2 border-[#FFFF66] rounded-[20px] p-6 space-y-3">
                  <p className="font-bold">Code: {duel.code} · {duel.status}</p>
                  {(duel.questions || []).map((q, i) => (
                    <div key={q.id || i} className="border border-[#E0E0E0] rounded-xl p-4">
                      <p className="font-semibold">{q.q || q.question}</p>
                      {(q.options || []).map((o) => (
                        <label key={o} className="flex gap-2 mt-1 text-sm">
                          <input type="radio" name={`q-${q.id || i}`} checked={answers[q.id || String(i)] === o} onChange={() => setAnswers({ ...answers, [q.id || String(i)]: o })} />
                          {o}
                        </label>
                      ))}
                    </div>
                  ))}
                  <button type="button" onClick={submitDuel} className="bg-[#0D0D0D] text-[#FFFF66] font-bold px-4 py-2 rounded-xl border-none cursor-pointer">Submit answers</button>
                </div>
              )}
            </div>
          )}

          {tab === 'boss' && boss?.boss && (
            <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-4">
              <h3 className="font-display font-bold text-lg">{boss.boss.title || 'Boss Challenge'}</h3>
              {bossQs.map((q, i) => (
                <div key={q.id || i} className="border border-[#E0E0E0] rounded-xl p-4">
                  <p className="font-semibold">{q.q || q.question}</p>
                  {(q.options || []).map((o) => (
                    <label key={o} className="flex gap-2 mt-1 text-sm">
                      <input type="radio" name={`boss-${q.id || i}`} checked={answers[q.id || `b${i}`] === o} onChange={() => setAnswers({ ...answers, [q.id || `b${i}`]: o })} />
                      {o}
                    </label>
                  ))}
                </div>
              ))}
              <button type="button" onClick={submitBoss} className="bg-[#0D0D0D] text-[#FFFF66] font-bold px-4 py-2 rounded-xl border-none cursor-pointer">Submit Boss run</button>
            </div>
          )}

          {tab === 'squad' && (
            <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-4">
              <input value={squadName} onChange={(e) => setSquadName(e.target.value)} placeholder="Squad name" className="w-full border-2 rounded-xl px-3 py-2" />
              <button type="button" onClick={createSquad} className="bg-[#0D0D0D] text-[#FFFF66] font-bold px-4 py-2 rounded-xl border-none cursor-pointer">Create squad</button>
              <div className="flex gap-2">
                <input value={squadInvite} onChange={(e) => setSquadInvite(e.target.value)} placeholder="Invite" className="border-2 rounded-xl px-3 py-2 flex-1" />
                <button type="button" onClick={joinSquad} className="border-2 font-bold px-4 py-2 rounded-xl cursor-pointer">Join</button>
              </div>
              <ul className="text-sm space-y-2">
                {(summary?.squads || []).map((s) => (
                  <li key={s.id} className="border rounded-lg p-3">
                    <strong>{s.name}</strong> — invite {s.invite} — {s.memberIds?.length || 0} members · progress {s.challengeProgress}/{s.challengeTarget}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'board' && (
            <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6">
              <ol className="space-y-2">
                {leaderboard.map((r, i) => (
                  <li key={r.userId} className="flex justify-between text-sm">
                    <span>{i + 1}. {r.name}</span>
                    <span>{r.xp} XP · Lv.{r.level} · 🔥{r.streak}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
