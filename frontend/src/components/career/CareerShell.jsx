import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Network, Sparkles, Trophy, Wand2, FileBadge } from 'lucide-react';
import WorldToggle from '../world/WorldToggle';
import '../../styles/career.css';

const nav = [
  { to: '/career/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/career/visualizer', icon: Sparkles, label: 'Algorithm Visualizer' },
  { to: '/career/arena', icon: Trophy, label: 'DSA Arena + Duels' },
  { to: '/career/interview', icon: Wand2, label: 'AI Interview Prep' },
  { to: '/career/map', icon: Network, label: 'Career Concept Map' },
  { to: '/career/resume', icon: FileBadge, label: 'Resume Hub' },
];

export default function CareerShell() {
  return (
    <div data-world="career" className="flex min-h-screen">
      <aside className="w-80 max-md:hidden flex-shrink-0 h-screen sticky top-0 px-5 py-6 border-r border-[rgba(139,92,246,0.2)]">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <div className="career-kicker">Career</div>
            <div className="font-display font-extrabold text-[22px] truncate text-[var(--career-text)]">
              Technical Prep Suite
            </div>
          </div>
          <WorldToggle compact />
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
                    : 'bg-transparent border-transparent text-[var(--career-muted)] hover:bg-white/[0.06] hover:text-[var(--career-text)]'
                }`
              }
            >
              <Icon size={18} className="text-[var(--career-accent2)] opacity-90" />
              <span className="font-semibold">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 rounded-[12px] border border-[rgba(139,92,246,0.3)] bg-[#111118] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55 mb-2">Hint</div>
          <p className="text-sm text-white/75 leading-relaxed">
            Career World actions earn XP and improve your readiness score. Use the world toggle for the cinematic transition.
          </p>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-[var(--career-bg)]">
        <header className="h-16 px-6 flex items-center justify-between border-b border-[rgba(139,92,246,0.2)] sticky top-0 z-40 bg-[#0A0A0F]/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[12px] border border-[rgba(139,92,246,0.35)] flex items-center justify-center bg-[#111118]">
              <Sparkles size={18} className="text-[var(--career-accent)]" />
            </div>
            <div className="min-w-0">
              <div className="career-kicker">Career</div>
              <div className="font-display font-extrabold text-lg truncate text-[var(--career-text)]">Prep Dashboard</div>
            </div>
          </div>
          <div className="md:hidden">
            <WorldToggle compact />
          </div>
        </header>

        <div className="p-6 max-sm:p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
