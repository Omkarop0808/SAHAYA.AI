import { useEffect, useMemo, useState } from 'react';
import { Bot, Send, RefreshCcw } from 'lucide-react';
import {
  jobHunterApplications,
  jobHunterApply,
  jobHunterOutreach,
  jobHunterOutreachList,
  streamJobHunterRun,
  updateJobHunterOutreachStatus,
} from '../../utils/careerApi';

const tabs = ['auto-applier', 'outreach'];

export default function CareerJobHunterPage() {
  const [tab, setTab] = useState('auto-applier');
  const [applications, setApplications] = useState([]);
  const [outreachRows, setOutreachRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamLogs, setStreamLogs] = useState([]);
  const [streamingRunId, setStreamingRunId] = useState('');
  const [applyForm, setApplyForm] = useState({ role: '', location: '', skills: '', experience: '', jobType: 'full-time', dryRun: true });
  const [outreachForm, setOutreachForm] = useState({ target: '', channel: 'email', tone: 'formal', message: '', dryRun: true });

  const logs = useMemo(() => {
    if (streamLogs.length) return streamLogs.join('\n');
    return (applications[0]?.logs || []).join('\n') || 'No logs yet.';
  }, [applications, streamLogs]);

  async function refresh() {
    setError('');
    try {
      const [a, o] = await Promise.all([jobHunterApplications(), jobHunterOutreachList()]);
      setApplications(a.applications || []);
      setOutreachRows(o.outreach || []);
    } catch (e) {
      setError(e?.message || 'Failed to load Job Hunter data.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const submitApply = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await jobHunterApply({
        ...applyForm,
        skills: applyForm.skills.split(',').map((s) => s.trim()).filter(Boolean),
      });
      const runId = result?.application?.id;
      if (runId) {
        setStreamingRunId(runId);
        setStreamLogs([]);
      }
      await refresh();
    } catch (err) {
      setError(err?.message || 'Auto apply request failed.');
    } finally {
      setLoading(false);
    }
  };

  const submitOutreach = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await jobHunterOutreach(outreachForm);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Outreach request failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!streamingRunId) return undefined;
    const controller = new AbortController();
    streamJobHunterRun(streamingRunId, {
      signal: controller.signal,
      onData: (payload) => {
        if (payload.type === 'snapshot') {
          setStreamLogs(payload.logs || []);
          return;
        }
        if (payload.type === 'log' && payload.line) {
          setStreamLogs((prev) => [...prev, payload.line]);
        }
        if (payload.type === 'complete') {
          setTimeout(() => {
            refresh();
            setStreamingRunId('');
          }, 250);
        }
      },
    }).catch(() => {});
    return () => controller.abort();
  }, [streamingRunId]);

  const STATUSES = ['drafted', 'sent', 'replied', 'converted'];

  const updateStatus = async (outreachId, nextStatus) => {
    setError('');
    try {
      await updateJobHunterOutreachStatus(outreachId, nextStatus);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Failed to update outreach status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="career-kicker">Job Hunter</div>
          <h1 className="font-display font-extrabold text-3xl mt-1">Auto apply + Outreach</h1>
          <p className="text-sm text-white/65 mt-2 max-w-2xl">AI-assisted job application automation and personalized recruiter outreach pipeline.</p>
        </div>
        <button type="button" onClick={refresh} className="career-btn"><RefreshCcw size={14} /> Refresh</button>
      </div>

      {error ? <div className="career-card text-red-300 border-red-500/40">{error}</div> : null}

      <div className="flex gap-2">
        {tabs.map((x) => (
          <button key={x} className={`career-btn ${tab === x ? '' : 'opacity-60'}`} onClick={() => setTab(x)}>
            {x === 'auto-applier' ? 'Auto Applier' : 'Outreach'}
          </button>
        ))}
      </div>

      {tab === 'auto-applier' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <form onSubmit={submitApply} className="career-card space-y-3">
            <div className="font-semibold inline-flex gap-2 items-center"><Bot size={16} /> Auto Job Applier</div>
            <input className="w-full bg-[#0A0A0F] border border-white/15 rounded-[10px] px-3 py-2 text-white" placeholder="Role" value={applyForm.role} onChange={(e) => setApplyForm({ ...applyForm, role: e.target.value })} required />
            <input className="w-full bg-[#0A0A0F] border border-white/15 rounded-[10px] px-3 py-2 text-white" placeholder="Location" value={applyForm.location} onChange={(e) => setApplyForm({ ...applyForm, location: e.target.value })} required />
            <input className="w-full bg-[#0A0A0F] border border-white/15 rounded-[10px] px-3 py-2 text-white" placeholder="Skills (comma-separated)" value={applyForm.skills} onChange={(e) => setApplyForm({ ...applyForm, skills: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full bg-[#0A0A0F] border border-white/15 rounded-[10px] px-3 py-2 text-white" placeholder="Experience" value={applyForm.experience} onChange={(e) => setApplyForm({ ...applyForm, experience: e.target.value })} />
              <select className="w-full bg-[#0A0A0F] border border-white/15 rounded-[10px] px-3 py-2 text-white" value={applyForm.jobType} onChange={(e) => setApplyForm({ ...applyForm, jobType: e.target.value })}>
                <option value="full-time">Full-time</option>
                <option value="internship">Internship</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <label className="text-xs text-white/70 inline-flex gap-2 items-center">
              <input type="checkbox" checked={applyForm.dryRun} onChange={(e) => setApplyForm({ ...applyForm, dryRun: e.target.checked })} />
              Dry run
            </label>
            <button className="career-btn" disabled={loading}>{loading ? 'Running...' : 'Trigger AI Auto Applier'}</button>
          </form>

          <div className="career-card">
            <div className="text-sm font-semibold mb-2">Live logs</div>
            <pre className="bg-[#0A0A0F] border border-white/10 rounded-[10px] p-3 text-xs text-[#c6f7d0] max-h-[320px] overflow-auto whitespace-pre-wrap">{logs}</pre>
          </div>

          <div className="career-card xl:col-span-2 overflow-auto">
            <div className="text-sm font-semibold mb-3">Applications</div>
            <table className="w-full text-sm">
              <thead className="text-left text-white/70 border-b border-white/15">
                <tr><th className="py-2">Role</th><th>Location</th><th>Status</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id} className="border-b border-white/10">
                    <td className="py-2">{a.role}</td>
                    <td>{a.location}</td>
                    <td><span className="career-chip">{a.status}</span></td>
                    <td>{a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {!applications.length ? <tr><td className="py-3 text-white/50" colSpan={4}>No applications yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <form onSubmit={submitOutreach} className="career-card space-y-3">
            <div className="font-semibold inline-flex gap-2 items-center"><Send size={16} /> AI Outreach</div>
            <input className="w-full bg-[#0A0A0F] border border-white/15 rounded-[10px] px-3 py-2 text-white" placeholder="Target (recruiter/company/connection)" value={outreachForm.target} onChange={(e) => setOutreachForm({ ...outreachForm, target: e.target.value })} required />
            <div className="grid grid-cols-2 gap-3">
              <select className="w-full bg-[#0A0A0F] border border-white/15 rounded-[10px] px-3 py-2 text-white" value={outreachForm.channel} onChange={(e) => setOutreachForm({ ...outreachForm, channel: e.target.value })}>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              <select className="w-full bg-[#0A0A0F] border border-white/15 rounded-[10px] px-3 py-2 text-white" value={outreachForm.tone} onChange={(e) => setOutreachForm({ ...outreachForm, tone: e.target.value })}>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            <textarea className="w-full bg-[#0A0A0F] border border-white/15 rounded-[10px] px-3 py-2 text-white min-h-[120px]" placeholder="Compose or prompt AI message..." value={outreachForm.message} onChange={(e) => setOutreachForm({ ...outreachForm, message: e.target.value })} />
            <label className="text-xs text-white/70 inline-flex gap-2 items-center">
              <input type="checkbox" checked={outreachForm.dryRun} onChange={(e) => setOutreachForm({ ...outreachForm, dryRun: e.target.checked })} />
              Dry run
            </label>
            <button className="career-btn" disabled={loading}>{loading ? 'Sending...' : 'Generate / Send Outreach'}</button>
          </form>

          <div className="career-card overflow-auto">
            <div className="text-sm font-semibold mb-3">Outreach pipeline</div>
            <table className="w-full text-sm">
              <thead className="text-left text-white/70 border-b border-white/15">
                <tr><th className="py-2">Target</th><th>Channel</th><th>Status</th><th>Transition</th><th>Reply Score</th></tr>
              </thead>
              <tbody>
                {outreachRows.map((o) => (
                  <tr key={o.id} className="border-b border-white/10">
                    <td className="py-2">{o.target}</td>
                    <td>{o.channel}</td>
                    <td><span className="career-chip">{o.status || 'drafted'}</span></td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {STATUSES.map((status) => (
                          <button
                            key={`${o.id}-${status}`}
                            type="button"
                            onClick={() => updateStatus(o.id, status)}
                            className={`text-[10px] px-2 py-1 rounded border ${status === o.status ? 'bg-white/20 border-white/30' : 'bg-transparent border-white/15 text-white/70'}`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>{o.response?.reply_score ?? '-'}</td>
                  </tr>
                ))}
                {!outreachRows.length ? <tr><td className="py-3 text-white/50" colSpan={5}>No outreach logs yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
