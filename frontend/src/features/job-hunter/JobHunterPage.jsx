import { useEffect, useMemo, useState } from 'react';
import { Bot, Send, BriefcaseBusiness, RefreshCcw } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import DashHeader from '../../components/DashHeader';
import { applyJobs, getApplications, getOutreachHistory, sendOutreach } from './jobHunterApi';

const tabs = ['auto-applier', 'outreach'];

const initialApplyForm = {
  role: '',
  location: '',
  skills: '',
  experience: '',
  dryRun: true,
};

const initialOutreachForm = {
  target: '',
  channel: 'email',
  tone: 'formal',
  message: '',
  dryRun: true,
};

export default function JobHunterPage() {
  const [activeTab, setActiveTab] = useState('auto-applier');
  const [applyForm, setApplyForm] = useState(initialApplyForm);
  const [outreachForm, setOutreachForm] = useState(initialOutreachForm);
  const [applications, setApplications] = useState([]);
  const [outreachRows, setOutreachRows] = useState([]);
  const [loadingApply, setLoadingApply] = useState(false);
  const [loadingOutreach, setLoadingOutreach] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setRefreshing(true);
    setError('');
    try {
      const [appData, outData] = await Promise.all([getApplications(), getOutreachHistory()]);
      setApplications(appData.applications || []);
      setOutreachRows(outData.outreach || []);
    } catch (e) {
      setError(e?.message || 'Failed to load job hunter data.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const applyLogs = useMemo(() => {
    if (!applications.length) return 'No runs yet.';
    return (applications[0]?.logs || []).join('\n');
  }, [applications]);

  async function onApplySubmit(e) {
    e.preventDefault();
    setLoadingApply(true);
    setError('');
    try {
      await applyJobs({
        ...applyForm,
        skills: applyForm.skills.split(',').map((s) => s.trim()).filter(Boolean),
      });
      await refresh();
      setApplyForm((prev) => ({ ...prev, role: '', location: '', skills: '', experience: '' }));
    } catch (err) {
      setError(err?.message || 'Failed to start auto apply pipeline.');
    } finally {
      setLoadingApply(false);
    }
  }

  async function onOutreachSubmit(e) {
    e.preventDefault();
    setLoadingOutreach(true);
    setError('');
    try {
      await sendOutreach(outreachForm);
      await refresh();
      setOutreachForm((prev) => ({ ...prev, target: '', message: '' }));
    } catch (err) {
      setError(err?.message || 'Failed to send outreach.');
    } finally {
      setLoadingOutreach(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Job Hunter" />
        <div className="p-8 flex flex-col gap-6 max-sm:p-4">
          <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-5 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
            <div>
              <h1 className="text-2xl font-extrabold text-[#0D0D0D]">Job Hunter</h1>
              <p className="text-sm text-[#555555]">Auto-apply to roles and run personalized recruiter outreach from one workspace.</p>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] border-none rounded-[10px] px-4 py-2 text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="bg-white border-2 border-[#E0E0E0] rounded-[16px] p-2 inline-flex gap-2 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-[10px] text-sm font-bold border-none cursor-pointer transition-colors ${
                  activeTab === tab ? 'bg-[#0D0D0D] text-[#FFFF66]' : 'bg-transparent text-[#0D0D0D]'
                }`}
              >
                {tab === 'auto-applier' ? 'Auto Applier' : 'Outreach'}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-[12px] px-4 py-3 text-sm">{error}</div>
          )}

          {activeTab === 'auto-applier' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <form onSubmit={onApplySubmit} className="bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-bold"><Bot size={16} /> Auto Job Applier</div>
                <input className="px-3 py-2 border-2 border-[#E0E0E0] rounded-[10px] text-sm" placeholder="Target role" value={applyForm.role} onChange={(e) => setApplyForm({ ...applyForm, role: e.target.value })} required />
                <input className="px-3 py-2 border-2 border-[#E0E0E0] rounded-[10px] text-sm" placeholder="Location" value={applyForm.location} onChange={(e) => setApplyForm({ ...applyForm, location: e.target.value })} required />
                <input className="px-3 py-2 border-2 border-[#E0E0E0] rounded-[10px] text-sm" placeholder="Skills (comma separated)" value={applyForm.skills} onChange={(e) => setApplyForm({ ...applyForm, skills: e.target.value })} />
                <input className="px-3 py-2 border-2 border-[#E0E0E0] rounded-[10px] text-sm" placeholder="Experience (entry/mid/senior)" value={applyForm.experience} onChange={(e) => setApplyForm({ ...applyForm, experience: e.target.value })} />
                <label className="text-xs text-[#555555] inline-flex items-center gap-2">
                  <input type="checkbox" checked={applyForm.dryRun} onChange={(e) => setApplyForm({ ...applyForm, dryRun: e.target.checked })} />
                  Dry run (safe mode)
                </label>
                <button type="submit" disabled={loadingApply} className="mt-1 bg-[#0D0D0D] text-[#FFFF66] border-none rounded-[10px] px-4 py-2 text-sm font-bold cursor-pointer disabled:opacity-60">
                  {loadingApply ? 'Starting…' : 'Trigger Auto Apply'}
                </button>
              </form>

              <div className="bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5">
                <div className="text-sm font-bold mb-2">Live status / logs</div>
                <pre className="bg-[#0D0D0D] text-[#d4fcd4] rounded-[10px] p-3 text-xs overflow-auto max-h-[280px] whitespace-pre-wrap">{applyLogs}</pre>
              </div>

              <div className="bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5 lg:col-span-2 overflow-auto">
                <div className="text-sm font-bold mb-3">Applications</div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-[#E0E0E0]">
                      <th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Location</th><th className="py-2 pr-3">Status</th><th className="py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((a) => (
                      <tr key={a.id} className="border-b border-[#F1F1F1]">
                        <td className="py-2 pr-3">{a.role}</td>
                        <td className="py-2 pr-3">{a.location}</td>
                        <td className="py-2 pr-3">{a.status}</td>
                        <td className="py-2">{a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                    {!applications.length && <tr><td colSpan={4} className="py-4 text-[#777777]">No applications yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'outreach' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <form onSubmit={onOutreachSubmit} className="bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-bold"><Send size={16} /> AI Outreach</div>
                <input className="px-3 py-2 border-2 border-[#E0E0E0] rounded-[10px] text-sm" placeholder="Target (recruiter/company)" value={outreachForm.target} onChange={(e) => setOutreachForm({ ...outreachForm, target: e.target.value })} required />
                <select className="px-3 py-2 border-2 border-[#E0E0E0] rounded-[10px] text-sm" value={outreachForm.channel} onChange={(e) => setOutreachForm({ ...outreachForm, channel: e.target.value })}>
                  <option value="email">Email</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
                <select className="px-3 py-2 border-2 border-[#E0E0E0] rounded-[10px] text-sm" value={outreachForm.tone} onChange={(e) => setOutreachForm({ ...outreachForm, tone: e.target.value })}>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                </select>
                <textarea className="px-3 py-2 border-2 border-[#E0E0E0] rounded-[10px] text-sm min-h-28" placeholder="Message prompt or manual message" value={outreachForm.message} onChange={(e) => setOutreachForm({ ...outreachForm, message: e.target.value })} />
                <label className="text-xs text-[#555555] inline-flex items-center gap-2">
                  <input type="checkbox" checked={outreachForm.dryRun} onChange={(e) => setOutreachForm({ ...outreachForm, dryRun: e.target.checked })} />
                  Dry run (safe mode)
                </label>
                <button type="submit" disabled={loadingOutreach} className="mt-1 bg-[#0D0D0D] text-[#FFFF66] border-none rounded-[10px] px-4 py-2 text-sm font-bold cursor-pointer disabled:opacity-60">
                  {loadingOutreach ? 'Sending…' : 'Generate / Send Outreach'}
                </button>
              </form>

              <div className="bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5 overflow-auto">
                <div className="text-sm font-bold mb-3 inline-flex items-center gap-2"><BriefcaseBusiness size={16} /> Outreach Tracker</div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-[#E0E0E0]">
                      <th className="py-2 pr-3">Target</th><th className="py-2 pr-3">Channel</th><th className="py-2 pr-3">Status</th><th className="py-2">Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outreachRows.map((o) => (
                      <tr key={o.id} className="border-b border-[#F1F1F1]">
                        <td className="py-2 pr-3">{o.target}</td>
                        <td className="py-2 pr-3">{o.channel}</td>
                        <td className="py-2 pr-3">{o.status}</td>
                        <td className="py-2">{o.response?.reply_score != null ? `${o.response.reply_score}/100` : '-'}</td>
                      </tr>
                    ))}
                    {!outreachRows.length && <tr><td colSpan={4} className="py-4 text-[#777777]">No outreach activity yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
