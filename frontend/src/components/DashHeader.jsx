import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Edit, ChevronDown, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function DashHeader({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [xp, setXp] = useState(null);
  const [readiness, setReadiness] = useState(null);

  useEffect(() => {
    api.get('/study/xp')
      .then(({ data }) => setXp(data))
      .catch(() => setXp(null));
  }, []);

  useEffect(() => {
    api.get('/study/companion/readiness')
      .then(({ data }) => setReadiness(data))
      .catch(() => setReadiness(null));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="h-16 px-8 flex items-center justify-between border-b-2 border-[#E0E0E0] bg-white sticky top-0 z-50">
      <div className="flex items-center gap-4 min-w-0">
        <h2 className="font-display text-xl font-bold text-[#0D0D0D] truncate">{title}</h2>
        {xp && (
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold bg-[#0D0D0D] text-[#FFFF66] px-3 py-1.5 rounded-full flex-shrink-0">
            <Zap size={14} />
            <span>Lv.{xp.level}</span>
            <span className="text-white/80 font-semibold">{xp.xp} XP</span>
            <span className="text-white/50">🔥{xp.streak || 0}</span>
            {readiness?.overall != null && (
              <span className="text-white/90 font-semibold border-l border-white/20 pl-2 ml-1">
                Prep {readiness.overall}%
              </span>
            )}
          </div>
        )}
        {children}
      </div>

      <div
        className="relative flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-[8px] border-2 border-[#E0E0E0] hover:border-[#0D0D0D] transition-colors select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="w-8 h-8 bg-[#FFB6C1] rounded-full flex items-center justify-center font-display font-bold text-sm text-[#0D0D0D] flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <span className="text-sm font-semibold text-[#0D0D0D]">{user?.name || 'User'}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />

        {open && (
          <div className="absolute top-[calc(100%+8px)] right-0 w-56 bg-white border-2 border-[#0D0D0D] rounded-[16px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.12)] animate-fadeUp">
            <div className="px-4 py-3.5 bg-[#F9F9F9] border-b border-[#E0E0E0]">
              <p className="font-semibold text-sm">{user?.name}</p>
              <p className="text-xs text-[#555555] mt-0.5">{user?.email}</p>
            </div>
            <button
              className="flex items-center gap-2 w-full px-4 py-[11px] bg-transparent border-none text-sm text-[#0D0D0D] text-left hover:bg-[#F9F9F9] transition-colors"
              onClick={() => { navigate('/profile'); setOpen(false); }}
            >
              <User size={14} /> My Profile
            </button>
            <button
              className="flex items-center gap-2 w-full px-4 py-[11px] bg-transparent border-none text-sm text-[#0D0D0D] text-left hover:bg-[#F9F9F9] transition-colors"
              onClick={() => { navigate('/profile?edit=true'); setOpen(false); }}
            >
              <Edit size={14} /> Edit Edu Data
            </button>
            <div className="h-px bg-[#E0E0E0] my-1" />
            <button
              className="flex items-center gap-2 w-full px-4 py-[11px] bg-transparent border-none text-sm text-red-500 text-left hover:bg-[#F9F9F9] transition-colors"
              onClick={handleLogout}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
