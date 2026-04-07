import { useEffect, useMemo, useState } from 'react';
import { Flame, Gauge, Trophy, Zap } from 'lucide-react';
import { ErrorState, LoadingSkeleton, EmptyState } from '../../components/PageStates';
import { getCareerDashboard } from '../../utils/careerApi';
import { NavLink } from 'react-router-dom';

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="career-card p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
        <Icon size={20} className="text-[var(--career-accent2)]" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">{label}</div>
        <div className="mt-1 font-display font-extrabold text-2xl">{value}</div>
        {hint && <div className="mt-1 text-sm text-white/65">{hint}</div>}
      </div>
    </div>
  );
}

export default function CareerDashboard() {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const data = await getCareerDashboard();
      setState({ loading: false, error: null, data });
    } catch (e) {
      setState({ loading: false, error: 'Failed to load Career dashboard.', data: null });
    }
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const d = state.data;
    if (!d) return null;
    return {
      xp: d.profile?.xp ?? 0,
      level: d.profile?.level ?? 1,
      streak: d.profile?.streak ?? 0,
      readiness: d.readinessScore ?? 0,
      weakTopics: d.weakTopics ?? [],
      recentAttempts: d.recentAttempts ?? [],
      daily: d.dailyChallenge ?? null,
    };
  }, [state.data]);

  if (state.loading) return <LoadingSkeleton lines={6} className="career-card p-6" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!stats) return <EmptyState title="No Career data yet" hint="Solve your first problem to initialize your Career profile." icon="🧭" />;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Career Dashboard</div>
          <h1 className="font-display font-extrabold text-3xl mt-1">Your Readiness Command Center</h1>
          <p className="text-sm text-white/65 mt-2 max-w-2xl">
            Practice daily, earn XP, and let the system diagnose weak topics. The fastest path is consistent iteration.
          </p>
        </div>
        <NavLink to="/career/arena" className="career-btn no-underline">
          <Trophy size={16} />
          Start Problem Arena
        </NavLink>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Stat icon={Zap} label="XP" value={`${stats.xp}`} hint={`Level ${stats.level}`} />
        <Stat icon={Flame} label="Streak" value={`${stats.streak} days`} />
        <Stat icon={Gauge} label="Readiness" value={`${stats.readiness}%`} hint="Based on attempts + topic mastery" />
        <Stat icon={Trophy} label="Daily Challenge" value={stats.daily?.title ? 'Active' : '—'} hint={stats.daily?.title || 'No challenge set'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="career-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Recent attempts</div>
              <div className="font-display font-extrabold text-xl mt-1">Last 10 submissions</div>
            </div>
            <NavLink to="/career/arena" className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-accent2)] no-underline hover:underline">
              Open arena →
            </NavLink>
          </div>
          {stats.recentAttempts.length === 0 ? (
            <div className="text-sm text-white/60 border border-white/10 rounded-2xl p-6 bg-white/[0.03]">
              No attempts yet. Start with the daily challenge to get bonus XP.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentAttempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-4 border border-white/10 rounded-2xl p-4 bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{a.problemTitle}</div>
                    <div className="text-xs text-white/55 mt-1">{a.topic} · {a.difficulty} · {new Date(a.createdAt).toLocaleString()}</div>
                  </div>
                  <div className={`career-chip ${a.result === 'pass' ? '' : ''}`}>
                    {a.result === 'pass' ? 'PASS' : 'TRY'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="career-card p-6">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Weak topics</div>
          <div className="font-display font-extrabold text-xl mt-1">Where to focus next</div>
          <p className="text-sm text-white/65 mt-2">These are inferred from your recent attempts and hint usage.</p>

          <div className="mt-4 space-y-2">
            {stats.weakTopics.length === 0 ? (
              <div className="text-sm text-white/60 border border-white/10 rounded-2xl p-5 bg-white/[0.03]">
                No weak topics detected yet. Solve 3–5 problems to bootstrap diagnostics.
              </div>
            ) : (
              stats.weakTopics.map((t) => (
                <div key={t.topic} className="flex items-center justify-between gap-3 border border-white/10 rounded-2xl p-4 bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{t.topic}</div>
                    <div className="text-xs text-white/55 mt-1">Mastery {t.mastery}%</div>
                  </div>
                  <NavLink to="/career/map" className="text-xs font-extrabold uppercase tracking-[0.28em] text-purple-300 no-underline hover:underline">
                    map →
                  </NavLink>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

