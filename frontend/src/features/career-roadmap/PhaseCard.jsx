export default function PhaseCard({ phase, onToggleItem, expanded, onToggleExpand }) {
  const itemRow = (item, kind) => (
    <label key={item.id} className="flex items-start gap-2 text-sm text-white/80">
      <input
        type="checkbox"
        checked={Boolean(item.completed)}
        onChange={(e) => onToggleItem(item.id, e.target.checked, kind)}
        className="mt-1"
      />
      <span>{item.name || item.title}</span>
    </label>
  );

  return (
    <div className="career-card">
      <button type="button" className="w-full flex items-center justify-between text-left" onClick={onToggleExpand}>
        <div>
          <div className="career-kicker">{phase.duration}</div>
          <h3 className="font-display font-extrabold text-xl mt-1">{phase.title}</h3>
          <p className="text-xs text-white/60 mt-1 uppercase tracking-wider">State: {phase.state?.replace('_', ' ')}</p>
        </div>
        <span className="career-chip">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="text-xs text-white/55 uppercase tracking-[0.2em] mb-2">Skills</div>
            <div className="space-y-2">{(phase.skills || []).map((item) => itemRow(item, 'skills'))}</div>
          </div>
          <div>
            <div className="text-xs text-white/55 uppercase tracking-[0.2em] mb-2">Resources</div>
            <div className="space-y-2">{(phase.resources || []).map((item) => itemRow(item, 'resources'))}</div>
          </div>
          <div>
            <div className="text-xs text-white/55 uppercase tracking-[0.2em] mb-2">Projects</div>
            <div className="space-y-2">{(phase.projects || []).map((item) => itemRow(item, 'projects'))}</div>
          </div>
          <div className="rounded-[10px] border border-white/10 bg-white/[0.03] p-3 text-sm text-white/80">
            <span className="font-semibold text-[var(--career-accent2)]">Milestone:</span> {phase.milestone || 'Complete this phase outcomes.'}
          </div>
        </div>
      )}
    </div>
  );
}
