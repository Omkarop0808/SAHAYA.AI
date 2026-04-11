import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Sparkles, Trophy, Wand2, FileBadge, Route, User, LogOut, Edit, ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import WorldToggle from '../world/WorldToggle';
import '../../styles/career.css';

const nav = [
  { to: '/career/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/career/visualizer', icon: Sparkles, label: 'Algorithm Visualizer' },
  { to: '/career/arena', icon: Trophy, label: 'DSA Arena + Duels' },
  { to: '/career/interview', icon: Wand2, label: 'Interview Lab' },
  { to: '/career/roadmap', icon: Route, label: 'Career Roadmap' },
  { to: '/career/resume', icon: FileBadge, label: 'Resume Hub' },
];

export default function CareerShell() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed z-[90] top-[14px] left-4 p-1.5 bg-[var(--career-surface)] border border-[var(--career-border)] text-[var(--career-accent2)] rounded-md shadow-[0_4px_12px_rgba(139,92,246,0.15)]"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[80] md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <div data-world="career" className="flex min-h-screen">
        <aside 
          className={`w-80 flex-shrink-0 h-screen fixed md:sticky top-0 left-0 flex flex-col px-5 py-6 border-r border-[var(--career-border)] bg-[var(--career-surface)] z-[85] transition-transform duration-300 ease-in-out ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="flex items-center gap-3 mb-6 mt-8 md:mt-0">
            <div className="min-w-0">
              <div className="career-kicker">Career</div>
              <div className="font-display font-extrabold text-[22px] truncate text-[var(--career-text)]">
                Technical Prep Suite
              </div>
            </div>
          </div>

        <nav className="flex flex-col gap-1.5" style={{ rowGap: '6px' }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `career-nav-item flex items-center gap-3 px-4 py-3 no-underline transition-all border ${
                  isActive
                    ? 'active text-[var(--career-text)]'
                    : 'bg-transparent border-transparent text-[var(--career-muted)] hover:bg-black/[0.04] hover:text-[var(--career-text)]'
                }`
              }
            >
              <Icon size={18} className="text-[var(--career-accent2)] opacity-90" />
              <span className="font-semibold">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-[12px] border border-[var(--career-border)] bg-[var(--career-surface)] p-4 shadow-[0_8px_32px_rgba(139,92,246,0.1)]">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] mb-2">Hint</div>
          <p className="text-sm text-[var(--career-text)] opacity-80 leading-relaxed">
            Career World actions earn XP and improve your readiness score. Use the world toggle for the cinematic transition.
          </p>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-[var(--career-bg)] w-full">
        <header className="h-16 px-6 max-md:pl-16 flex items-center justify-between border-b border-[var(--career-border)] sticky top-0 z-40 bg-[var(--career-bg)]/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[12px] border border-[rgba(139,92,246,0.35)] md:flex items-center justify-center bg-[var(--career-surface)] hidden">
              <Sparkles size={18} className="text-[var(--career-accent)]" />
            </div>
            <div className="min-w-0">
              <div className="career-kicker hidden md:block">Career</div>
              <div className="font-display font-extrabold text-lg truncate text-[var(--career-text)] max-md:text-base">Prep Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/leaderboard')}
              className="flex items-center justify-center w-10 h-10 rounded-[10px] border border-[rgba(139,92,246,0.35)] bg-[linear-gradient(135deg,rgba(139,92,246,0.1),rgba(6,182,212,0.05))] text-[#06B6D4] hover:shadow-[0_0_15px_rgba(139,92,246,0.25)] transition-all cursor-pointer relative"
              title="World Leaderboard"
            >
              <Trophy size={18} className="stroke-[2px] opacity-90" />
            </button>
            <WorldToggle compact />
            
            <div
              className="relative flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-[12px] border border-[var(--career-border)] bg-[var(--career-surface)] hover:border-[rgba(139,92,246,0.5)] transition-colors select-none"
              onClick={() => setOpen(!open)}
            >
              <div className="w-7 h-7 bg-[linear-gradient(135deg,#8B5CF6,#06B6D4)] rounded-full flex items-center justify-center font-display font-bold text-xs text-white flex-shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-semibold text-[var(--career-text)] tracking-wide">{user?.name || 'User'}</span>
              <ChevronDown size={14} className={`text-[var(--career-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />

              {open && (
                <div className="absolute top-[calc(100%+8px)] right-0 w-56 bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[12px] overflow-hidden shadow-[0_8px_32px_rgba(139,92,246,0.15)] animate-fadeUp z-50">
                  <div className="px-4 py-3 bg-[linear-gradient(180deg,rgba(139,92,246,0.05),transparent)] border-b border-[var(--career-border)]">
                    <p className="font-semibold text-sm text-[var(--career-text)]">{user?.name}</p>
                    <p className="text-xs text-[var(--career-muted)] mt-0.5">{user?.email}</p>
                  </div>
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2.5 bg-transparent border-none text-sm text-[var(--career-text)] text-left hover:bg-black/[0.04] transition-colors"
                    onClick={() => { navigate('/profile'); setOpen(false); }}
                  >
                    <User size={14} className="opacity-70" /> My Profile
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2.5 bg-transparent border-none text-sm text-[var(--career-text)] text-left hover:bg-black/[0.04] transition-colors"
                    onClick={() => { navigate('/profile?edit=true'); setOpen(false); }}
                  >
                    <Edit size={14} className="opacity-70" /> Edit Edu Data
                  </button>
                  <div className="h-px bg-[rgba(139,92,246,0.15)] my-1" />
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2.5 bg-transparent border-none text-sm text-red-500 text-left hover:bg-black/[0.04] transition-colors"
                    onClick={handleLogout}
                  >
                    <LogOut size={14} className="opacity-70" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-6 max-sm:p-4 w-full">
          <Outlet />
        </div>
      </main>
    </div>
    </>
  );
}
