import { useEffect, useMemo, useState } from 'react';
import { Flame, Gauge, Trophy, Zap } from 'lucide-react';
import { ErrorState, LoadingSkeleton, EmptyState } from '../../components/PageStates';
import { getCareerDashboard, getCareerAnalyticsSummary, getGamificationQuests } from '../../utils/careerApi';
import { NavLink } from 'react-router-dom';
import DailyQuestsPanel from '../../components/gamification/DailyQuestsPanel';

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="career-card p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-2xl border border-[var(--career-border)] bg-black/[0.02] flex items-center justify-center">
        <Icon size={20} className="text-[var(--career-accent2)]" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">{label}</div>
        <div className="mt-1 font-display font-extrabold text-2xl text-[var(--career-text)]">{value}</div>
        {hint && <div className="mt-1 text-sm text-[var(--career-muted)]">{hint}</div>}
      </div>
    </div>
  );
}

export default function CareerDashboard() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [quests, setQuests] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const load = async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const [data, q, a] = await Promise.all([
        getCareerDashboard(),
        getGamificationQuests('career'),
        getCareerAnalyticsSummary().catch(() => null),
      ]);
      setState({ loading: false, error: null, data });
      setQuests(q?.quests || []);
      setAnalytics(a);
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
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Career Dashboard</div>
          <h1 className="font-display font-extrabold text-3xl mt-1 text-[var(--career-text)]">Your Readiness Command Center</h1>
          <p className="text-sm text-[var(--career-muted)] mt-2 max-w-2xl">
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
              <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Recent attempts</div>
              <div className="font-display font-extrabold text-xl mt-1 text-[var(--career-text)]">Last 10 submissions</div>
            </div>
            <NavLink to="/career/arena" className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-accent2)] no-underline hover:underline">
              Open arena →
            </NavLink>
          </div>
          {stats.recentAttempts.length === 0 ? (
            <div className="text-sm text-[var(--career-muted)] border border-[var(--career-border)] rounded-2xl p-6 bg-black/[0.02]">
              No attempts yet. Start with the daily challenge to get bonus XP.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentAttempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-4 border border-[var(--career-border)] rounded-2xl p-4 bg-black/[0.02]">
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-[var(--career-text)]">{a.problemTitle}</div>
                    <div className="text-xs text-[var(--career-muted)] mt-1">{a.topic} · {a.difficulty} · {new Date(a.createdAt).toLocaleString()}</div>
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
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Weak topics</div>
          <div className="font-display font-extrabold text-xl mt-1 text-[var(--career-text)]">Where to focus next</div>
          <p className="text-sm text-[var(--career-muted)] mt-2">These are inferred from your recent attempts and hint usage.</p>

          <div className="mt-4 space-y-2">
            {stats.weakTopics.length === 0 ? (
              <div className="text-sm text-[var(--career-muted)] border border-[var(--career-border)] rounded-2xl p-5 bg-black/[0.02]">
                No weak topics detected yet. Solve 3–5 problems to bootstrap diagnostics.
              </div>
            ) : (
              stats.weakTopics.map((t) => (
                <div key={t.topic} className="flex items-center justify-between gap-3 border border-[var(--career-border)] rounded-2xl p-4 bg-black/[0.02]">
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-[var(--career-text)]">{t.topic}</div>
                    <div className="text-xs text-[var(--career-muted)] mt-1">Mastery {t.mastery}%</div>
                  </div>
                  <NavLink to="/career/map" className="text-xs font-extrabold uppercase tracking-[0.28em] text-purple-600 no-underline hover:underline">
                    map →
                  </NavLink>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="career-card !p-0 overflow-hidden bg-transparent border-none">
        <DailyQuestsPanel world="career" />
      </div>

      {analytics ? (
        <div className="career-card p-6">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Usage analytics</div>
          <div className="font-display font-extrabold text-xl mt-1 text-[var(--career-text)]">Career activity summary</div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><div className="font-display font-extrabold text-2xl text-[var(--career-text)]">{analytics.usage?.attempts ?? 0}</div><div className="text-xs text-[var(--career-muted)]">Submissions</div></div>
            <div><div className="font-display font-extrabold text-2xl text-[var(--career-text)]">{analytics.usage?.interviewSessions ?? 0}</div><div className="text-xs text-[var(--career-muted)]">Interviews</div></div>
            <div><div className="font-display font-extrabold text-2xl text-[var(--career-text)]">{analytics.usage?.visualizerRuns ?? 0}</div><div className="text-xs text-[var(--career-muted)]">Visualizer runs</div></div>
            <div><div className="font-display font-extrabold text-2xl text-[var(--career-text)]">{analytics.learning?.passRate ?? 0}%</div><div className="text-xs text-[var(--career-muted)]">Pass rate</div></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

