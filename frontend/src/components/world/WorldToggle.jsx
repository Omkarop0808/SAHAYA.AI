import { useMemo } from 'react';
import '../../styles/career.css';
import { useWorld } from '../../context/WorldContext';
import { useLocation } from 'react-router-dom';
import { Sparkles, Orbit } from 'lucide-react';

export default function WorldToggle({ compact = false }) {
  const { requestWorldSwitch } = useWorld();
  const location = useLocation();

  const inferredWorld = location.pathname.startsWith('/career') ? 'career' : 'study';
  const world = inferredWorld;
  const target = world === 'career' ? 'study' : 'career';

  const label = useMemo(() => {
    if (compact) return target === 'career' ? 'Career' : 'Study';
    return target === 'career' ? 'Enter Career World' : 'Back to Study World';
  }, [compact, target]);

  const motionClass = world === 'career' ? 'career-toggle-career' : 'career-toggle-study';

  return (
    <button
      type="button"
      onClick={() => requestWorldSwitch(target)}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-[16px] transition-all duration-300 ease-out select-none ${motionClass} ${
        compact ? 'px-3 py-2' : 'px-5 py-3'
      }`}
      style={{
        background:
          target === 'career'
            ? 'linear-gradient(180deg, rgba(20,20,30,0.8), rgba(10,10,15,0.9))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,250,252,0.95))',
        boxShadow:
          target === 'career'
            ? 'inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 20px -5px rgba(139,92,246,0.3), 0 0 0 1px rgba(139,92,246,0.45)'
            : 'inset 0 1px 1px rgba(255,255,255,1), 0 4px 20px -5px rgba(5,150,105,0.2), 0 0 0 1px rgba(5,150,105,0.3)',
        backdropFilter: 'blur(10px)',
      }}
      aria-label={label}
      title={label}
    >
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
        style={{
          background:
            target === 'career'
              ? 'radial-gradient(150px circle at 50% 50%, rgba(139,92,246,0.2), transparent), linear-gradient(180deg, rgba(139,92,246,0.1), rgba(6,182,212,0.15))'
              : 'radial-gradient(150px circle at 50% 50%, rgba(5,150,105,0.15), transparent), linear-gradient(180deg, rgba(16,185,129,0.05), rgba(5,150,105,0.1))',
        }}
      />

      <span className="relative flex items-center justify-center w-10 h-10 rounded-[10px] transition-transform duration-300 group-hover:scale-110 shadow-sm"
        style={{
          background: target === 'career' 
            ? 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))' 
            : 'linear-gradient(135deg, #059669, #10B981)',
          boxShadow: target === 'career'
            ? 'inset 0 1px 1px rgba(255,255,255,0.15), 0 0 0 1px rgba(139,92,246,0.2)'
            : 'inset 0 1px 2px rgba(255,255,255,0.5), 0 4px 12px rgba(5,150,105,0.3)'
        }}
      >
        {target === 'career' ? (
          <Orbit size={20} className="text-[#06B6D4] opacity-90 group-hover:animate-pulse" />
        ) : (
          <Sparkles size={20} className="text-white opacity-100 group-hover:animate-pulse" />
        )}
      </span>

      {!compact && (
        <span className="relative flex flex-col items-start leading-none gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60"
            style={{ color: target === 'career' ? '#E2E8F0' : '#475569' }}
          >
            {world === 'career' ? 'Currently in Career' : 'Currently in Study'}
          </span>
          <span className="text-[15px] font-extrabold tracking-tight"
            style={{ color: target === 'career' ? '#FFFFFF' : '#0F172A' }}
          >
            {label}
          </span>
        </span>
      )}
      {compact && (
        <span 
          className="relative text-[13px] font-extrabold uppercase tracking-widest"
          style={{ color: target === 'career' ? '#FFFFFF' : '#0F172A' }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
