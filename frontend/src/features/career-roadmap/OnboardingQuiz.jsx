import { useEffect, useMemo, useState } from 'react';

const ROLE_OPTIONS = ['Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer', 'AI/ML Engineer', 'Data Scientist', 'Product Manager', 'DevOps Engineer', 'UX Designer'];
const SKILL_OPTIONS = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'Git', 'Communication', 'Docker', 'System Design'];

export default function OnboardingQuiz({ initial, onSubmit, loading, onCancel }) {
  const [form, setForm] = useState(() => ({
    educationLevel: initial?.educationLevel || 'undergraduate',
    skills: initial?.skills || [],
    targetRole: initial?.targetRole || 'Frontend Engineer',
    timeline: initial?.timeline || '1 year',
    learningStyle: initial?.learningStyle || 'project-based',
  }));
  const canSubmit = useMemo(() => form.targetRole && form.timeline, [form]);

  useEffect(() => {
    setForm({
      educationLevel: initial?.educationLevel || 'undergraduate',
      skills: initial?.skills || [],
      targetRole: initial?.targetRole || 'Frontend Engineer',
      timeline: initial?.timeline || '1 year',
      learningStyle: initial?.learningStyle || 'project-based',
    });
  }, [initial?.educationLevel, initial?.learningStyle, initial?.targetRole, initial?.timeline, initial?.skills]);

  const toggleSkill = (skill) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill) ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
    }));
  };

  return (
    <div className="career-card space-y-5">
      <div>
        <div className="career-kicker">Career Roadmap Quiz</div>
        <h2 className="font-display font-extrabold text-2xl mt-2">Set your target path</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="space-y-2 text-sm">
          <span className="text-[var(--career-text)] text-opacity-80">Education level</span>
          <select className="w-full bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[10px] px-3 py-2 text-[var(--career-text)]" value={form.educationLevel} onChange={(e) => setForm({ ...form, educationLevel: e.target.value })}>
            <option value="high-school">High School</option>
            <option value="undergraduate">Undergraduate</option>
            <option value="postgraduate">Postgraduate</option>
            <option value="bootcamp">Bootcamp</option>
            <option value="self-taught">Self-taught</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-[var(--career-text)] text-opacity-80">Target role/domain</span>
          <select className="w-full bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[10px] px-3 py-2 text-[var(--career-text)]" value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })}>
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-[var(--career-text)] text-opacity-80">Timeline goal</span>
          <select className="w-full bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[10px] px-3 py-2 text-[var(--career-text)]" value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })}>
            <option value="3 months">3 months</option>
            <option value="6 months">6 months</option>
            <option value="1 year">1 year</option>
            <option value="2+ years">2+ years</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-[var(--career-text)] text-opacity-80">Learning style</span>
          <select className="w-full bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[10px] px-3 py-2 text-[var(--career-text)]" value={form.learningStyle} onChange={(e) => setForm({ ...form, learningStyle: e.target.value })}>
            <option value="project-based">Project-based</option>
            <option value="course-based">Course-based</option>
            <option value="reading">Reading</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-[var(--career-text)] text-opacity-80">Current skills</div>
        <div className="flex flex-wrap gap-2">
          {SKILL_OPTIONS.map((skill) => (
            <button key={skill} type="button" onClick={() => toggleSkill(skill)} className={`career-chip ${form.skills.includes(skill) ? '' : 'opacity-60'}`}>
              {skill}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        {onCancel ? (
          <button type="button" className="career-btn opacity-80 hover:opacity-100" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        ) : (
          <div />
        )}
        <button type="button" disabled={!canSubmit || loading} className="career-btn" onClick={() => onSubmit(form)}>
          {loading ? 'Generating...' : 'Generate roadmap'}
        </button>
      </div>
    </div>
  );
}
