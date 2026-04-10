import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { useGamification } from '../context/GamificationContext';

const commonSubjects = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History',
  'Geography', 'Computer Science', 'Python', 'Data Structures', 'Algorithms',
  'Machine Learning', 'Economics', 'Accountancy', 'Business Studies', 'Political Science',
];

export default function Profile() {
  const { user, eduData, saveEduData, logout } = useAuth();
  const { profile, getRankName } = useGamification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState(searchParams.get('edit') === 'true');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [form, setForm] = useState({
    institution: eduData?.institution || '', educationLevel: eduData?.educationLevel || '',
    course: eduData?.course || '', semester: eduData?.semester || '',
    specialization: eduData?.specialization || '', subjects: eduData?.subjects || [], customSubject: '',
  });

  const toggleSubject = (sub) => setForm(f => ({ ...f, subjects: f.subjects.includes(sub) ? f.subjects.filter(s => s !== sub) : [...f.subjects, sub] }));
  const addCustom = () => { const s = form.customSubject.trim(); if (s && !form.subjects.includes(s)) setForm(f => ({ ...f, subjects: [...f.subjects, s], customSubject: '' })); };

  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      await saveEduData(form);
      setSaveMsg('✓ Profile updated successfully!');
      setEditing(false);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  const inputCls = "px-3.5 py-[11px] border-2 border-[#0D0D0D] rounded-[8px] text-sm outline-none focus:shadow-[0_0_0_3px_#87CEEB] transition-all";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="My Profile" />
        <div className="p-8 flex flex-col gap-5 max-w-[760px] max-md:p-4">
          {saveMsg && <div className={`border-2 rounded-[8px] px-3.5 py-2.5 text-sm ${saveMsg.startsWith('✓') ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#2d8a4e]' : 'bg-[#fff0f0] border-red-400 text-red-700'}`}>{saveMsg}</div>}

          {/* Account info */}
          <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] px-7 py-6 flex items-start gap-5 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#FFFF66]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative border-4 border-[#0D0D0D] p-1 rounded-full bg-white shadow-lg z-10 w-[88px] h-[88px] flex items-center justify-center">
              <div className="w-full h-full bg-[#FFB6C1] rounded-full flex items-center justify-center font-display text-3xl font-extrabold flex-shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              {profile?.level >= 5 && (
                 <div className="absolute -inset-1 rounded-full border-[3px] border-dashed border-purple-400 rotate-180 animate-spin-slow pointer-events-none" />
              )}
              {profile?.level >= 10 && (
                 <div className="absolute -bottom-2 -right-2 bg-black text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-yellow-400 whitespace-nowrap">Elite Frame</div>
              )}
            </div>
            
            <div className="flex-1 mt-1">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold mb-[2px] text-[#0D0D0D]">{user?.name}</h2>
                    <span className="text-[10px] px-2 py-1 rounded bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold uppercase tracking-widest leading-none">
                       {profile ? getRankName(profile.xp) : 'Rookie'}
                    </span>
                 </div>
                 <button onClick={() => { logout(); navigate('/'); }}
                   className="px-5 py-2 bg-transparent border-2 border-red-500 rounded-[8px] text-red-500 text-sm font-semibold hover:bg-[#fff0f0] transition-colors cursor-pointer">
                   Logout
                 </button>
              </div>
              <p className="text-sm text-[#555555] font-medium">{user?.email}</p>
              
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#E0E0E0]">
                 <div className="text-sm font-bold"><span className="text-[#999]">Level</span> {profile?.level || 1}</div>
                 <div className="text-sm font-bold"><span className="text-[#999]">XP</span> {profile?.xp || 0}</div>
                 <div className="text-sm font-bold text-orange-500 flex items-center gap-1">🔥 {profile?.streak || 0} Days</div>
              </div>
              
              <div className="mt-4 flex gap-2">
                 <div className="text-[11px] font-bold text-[#0D0D0D] bg-[#F0F0F0] px-3 py-1.5 rounded-full border border-[#E0E0E0] inline-block opacity-70 cursor-not-allowed">
                    <span className="opacity-50">Equipped Title:</span> Scholar of React
                 </div>
                 <div className="text-[11px] font-bold text-[#0D0D0D] bg-[#F0F0F0] px-3 py-1.5 rounded-full border border-[#E0E0E0] inline-block opacity-70 cursor-not-allowed">
                    <span className="opacity-50">Equipped Frame:</span> Golden Laurel
                 </div>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] overflow-hidden">
            <div className="px-6 py-4 border-b-2 border-[#0D0D0D] flex items-center justify-between bg-[#F9F9F9]">
              <h3 className="text-[17px] font-extrabold">Education Details</h3>
              {!editing && (
                <button onClick={() => setEditing(true)}
                  className="px-4 py-[7px] bg-[#0D0D0D] text-[#FFFF66] border-none rounded-[8px] text-[13px] font-semibold cursor-pointer">
                  ✏️ Edit
                </button>
              )}
            </div>

            {!editing ? (
              <div className="px-6 py-5 flex flex-col gap-3.5">
                {[['Institution', form.institution], ['Education Level', form.educationLevel], ['Course', form.course], ['Semester / Year', form.semester], ['Specialization', form.specialization]].map(([label, val]) => val ? (
                  <div key={label} className="flex items-start gap-4 pb-3.5 border-b border-[#F0F0F0] last:border-b-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#555555] min-w-[130px] flex-shrink-0 pt-px">{label}</span>
                    <span className="text-sm">{val}</span>
                  </div>
                ) : null)}
                <div className="flex items-start gap-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#555555] min-w-[130px] flex-shrink-0 pt-px">Subjects</span>
                  <div className="flex flex-wrap gap-1.5">
                    {form.subjects.map(s => (
                      <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#87CEEB] border-[1.5px] border-[#0D0D0D] rounded-full text-xs font-semibold">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 flex flex-col gap-4">
                {[{key:'institution',label:'Institution',ph:'Your school/university'},{key:'educationLevel',label:'Education Level',ph:'e.g. Undergraduate'},{key:'course',label:'Course / Stream',ph:'e.g. B.Tech CSE'},{key:'semester',label:'Semester / Year',ph:'e.g. 3rd Semester'},{key:'specialization',label:'Specialization',ph:'e.g. AI/ML'}].map(({key,label,ph}) => (
                  <div key={key} className="flex flex-col gap-[7px]">
                    <label className="text-[13px] font-semibold">{label}</label>
                    <input type="text" placeholder={ph} value={form[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))} className={inputCls} />
                  </div>
                ))}
                <div className="flex flex-col gap-[7px]">
                  <label className="text-[13px] font-semibold">Subjects</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {commonSubjects.map(sub => (
                      <button key={sub} type="button" onClick={() => toggleSubject(sub)}
                        className={`px-3 py-[7px] border-2 border-[#0D0D0D] rounded-[8px] text-xs font-medium transition-all ${form.subjects.includes(sub) ? 'bg-[#FFB6C1] font-bold' : 'bg-white hover:bg-[#F0F0F0]'}`}>
                        {form.subjects.includes(sub) ? '✓ ' : ''}{sub}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Add custom subject…" value={form.customSubject}
                      onChange={e => setForm(f => ({...f,customSubject:e.target.value}))}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                      className="flex-1 px-3 py-2 border-2 border-[#E0E0E0] rounded-[8px] text-[13px] outline-none focus:border-[#0D0D0D] transition-colors" />
                    <button type="button" onClick={addCustom} className="px-4 py-2 bg-[#87CEEB] border-2 border-[#0D0D0D] rounded-[8px] text-[13px] font-semibold cursor-pointer">+ Add</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {form.subjects.map(s => (
                      <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#87CEEB] border-[1.5px] border-[#0D0D0D] rounded-full text-xs font-semibold">
                        {s}
                        <button type="button" onClick={() => toggleSubject(s)} className="bg-transparent border-none text-sm cursor-pointer p-0 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(false)} className="flex-1 py-3 border-2 border-[#0D0D0D] rounded-[8px] bg-white text-sm font-semibold hover:bg-[#F0F0F0] transition-colors cursor-pointer">Cancel</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-3 bg-[#0D0D0D] text-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] font-display text-sm font-bold hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-60">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
