export default function ProgressDashboard({ roadmap, today }) {
  const progress = roadmap?.progress?.percent || 0;
  return (
    <div className="space-y-4">
      <div className="career-card">
        <div className="career-kicker">Overall Progress</div>
        <div className="mt-2 text-3xl font-extrabold text-[var(--career-accent2)]">{progress}%</div>
        <div className="mt-3 h-2 rounded-full bg-[var(--career-surface)] border border-[var(--career-border)] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[var(--career-accent)] to-[var(--career-accent2)]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="career-card">
        <div className="career-kicker">Consistency</div>
        <div className="mt-2 text-xl font-bold">Streak: {roadmap?.streak || 0} days</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Days active and completion activity are tracked automatically.</div>
      </div>

      <div className="career-card">
        <div className="career-kicker">What To Do Today</div>
        <div className="text-sm text-white/85 mt-2">{today?.today || 'Generate a roadmap to get an AI-prioritized task.'}</div>
        {today?.etaWeeks ? <div className="text-xs text-[var(--career-muted)] mt-2">Estimated time remaining: {today.etaWeeks} weeks</div> : null}
      </div>
    </div>
  );
}
