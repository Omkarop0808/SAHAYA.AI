import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { useAuth } from '../context/AuthContext';
import { recommendMaterials } from '../utils/ai';
import { ExternalLink, Play, ListVideo, FileText, Globe, Book, Dna } from 'lucide-react';

const TYPE_COLORS = { 
  book: '#FFB6C1', 
  video: '#ff0000', 
  playlist: '#ff7b00', 
  website: '#87CEEB', 
  practice: '#c8f7c5',
  question_paper: '#FFFF66' 
};
const TYPE_ICONS = { 
  book: <Book size={18} />, 
  video: <Play fill="currentColor" size={16} />, 
  playlist: <ListVideo size={18} />, 
  website: <Globe size={18} />, 
  practice: <Dna size={18} />,
  question_paper: <FileText size={18} /> 
};
const TYPE_LABELS = {
  video: 'YouTube Videos (Popular & Trusted)',
  playlist: 'Playlists & Courses',
  question_paper: 'Question Papers & PYQs',
  practice: 'Practice Questions',
  book: 'Recommended Books',
  website: 'Helpful Websites & Notes'
};

export default function StudyMaterials() {
  const { eduData } = useAuth();
  const subjects = eduData?.subjects || [];
  const [selectedSubject, setSelectedSubject] = useState(subjects[0] || '');
  const [weakAreas, setWeakAreas] = useState('');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleRecommend = async () => {
    if (!selectedSubject) return;
    setLoading(true); setMaterials([]);
    try {
      const result = await recommendMaterials(selectedSubject, eduData?.educationLevel || 'general', weakAreas);
      setMaterials(result.materials || []);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to fetch materials.';
      alert(`Could not fetch study materials: ${message}`);
      setMaterials([]);
    }
    setLoading(false);
  };

  // Group materials by type to render them in separate sections
  const groupedMaterials = materials.reduce((acc, m) => {
    const t = m.type || 'website';
    if (!acc[t]) acc[t] = [];
    acc[t].push(m);
    return acc;
  }, {});

  const orderOfSections = ['video', 'playlist', 'question_paper', 'practice', 'book', 'website'];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Study Materials" />
        <div className="p-8 flex flex-col gap-7 flex-1 max-md:p-4">

          <div className="bg-white border-2 border-[#0D0D0D] rounded-[24px] p-8 animate-fadeUp">
            <h2 className="text-[22px] font-extrabold mb-1.5">Get AI-Recommended Study Materials</h2>
            <p className="text-sm text-[#555555] mb-6">Tell us your subject and weak areas — Sahay.AI will find the best resources for you.</p>

            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                <label className="text-[13px] font-semibold">Subject</label>
                <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                  className="px-3.5 py-[11px] border-2 border-[#0D0D0D] rounded-[8px] text-sm outline-none bg-white focus:shadow-[0_0_0_3px_#87CEEB] transition-all">
                  {subjects.map(s => <option key={s}>{s}</option>)}
                  {subjects.length === 0 && <option>Add subjects in profile first</option>}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                <label className="text-[13px] font-semibold">Weak areas (optional)</label>
                <input type="text" placeholder="e.g. Integration, Thermodynamics, Recursion" value={weakAreas} onChange={e => setWeakAreas(e.target.value)}
                  className="px-3.5 py-[11px] border-2 border-[#0D0D0D] rounded-[8px] text-sm outline-none bg-white focus:shadow-[0_0_0_3px_#87CEEB] transition-all" />
              </div>
              <button onClick={handleRecommend} disabled={loading || !selectedSubject}
                className="px-6 py-[11px] bg-[#0D0D0D] text-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] font-display text-sm font-bold whitespace-nowrap hover:-translate-y-0.5 hover:shadow-[3px_3px_0_rgba(0,0,0,0.15)] transition-all disabled:opacity-50 disabled:cursor-not-allowed h-fit">
                {loading ? 'Finding materials…' : '🔍 Find Materials'}
              </button>
            </div>
          </div>

          {materials.length > 0 && (
            <div className="flex flex-col gap-8 animate-fadeIn">
              {orderOfSections.map(type => {
                const sectionMats = groupedMaterials[type];
                if (!sectionMats || sectionMats.length === 0) return null;
                const color = TYPE_COLORS[type] || '#FFB6C1';
                const label = TYPE_LABELS[type] || type.toUpperCase();
                return (
                  <div key={type} className="flex flex-col gap-4">
                    <h3 className="text-xl font-extrabold flex items-center gap-2 border-b-2 border-[#E0E0E0] pb-2">
                       <span className="w-8 h-8 rounded-[8px] border-2 border-[#0D0D0D] flex items-center justify-center bg-white text-black" style={{background: color, color: type==='video' || type==='playlist' ? 'white' : 'black'}}>{TYPE_ICONS[type] || <FileText size={16}/>}</span>
                       <span>{label}</span>
                    </h3>
                    <div className="grid gap-5" style={{gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))'}}>
                      {sectionMats.map((m, i) => (
                        <div key={i} className="bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5 relative overflow-hidden transition-all hover:-translate-y-[3px] hover:shadow-[5px_5px_0_#0D0D0D]">
                          <div className="absolute top-0 left-0 right-0 h-1" style={{background: color}} />
                          
                          <h4 className="text-[15px] font-bold mb-2 leading-snug mt-2">{m.title}</h4>
                          <p className="text-[13px] text-[#555555] leading-relaxed mb-3.5">{m.description}</p>
                          {m.url && m.url !== '#' && (
                            <a href={m.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[13px] font-semibold bg-[#F9F9F9] px-3 py-1.5 rounded-[8px] border border-[#E0E0E0] text-[#0D0D0D] hover:bg-[#E0E0E0] transition-colors w-fit">
                              View Resource <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && materials.length === 0 && (
            <div className="text-center py-20 flex flex-col items-center gap-3">
              <span className="text-5xl">📚</span>
              <p className="text-[15px] text-[#555555]">Select a subject and search weak areas (e.g. "LPP", "Dynamic Programming") to get trusted YouTube videos, question papers, and more.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
