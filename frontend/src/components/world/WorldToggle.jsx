import { useMemo } from 'react';
import '../../styles/career.css';
import { useWorld } from '../../context/WorldContext';
import { useLocation } from 'react-router-dom';
import { Sparkles, ShipWheel } from 'lucide-react';

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
      className={`group relative overflow-hidden border-2 rounded-[14px] transition-all select-none ${motionClass} ${
        compact ? 'px-3 py-2' : 'px-4 py-2.5'
      }`}
      style={{
        borderColor: target === 'career' ? 'rgba(139,92,246,0.45)' : 'rgba(5,150,105,0.35)',
        background:
          target === 'career'
            ? 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(6,182,212,0.10))'
            : 'linear-gradient(135deg, rgba(224,242,254,0.12), rgba(236,253,245,0.14))',
        boxShadow:
          target === 'career'
            ? '0 0 0 1px rgba(6,182,212,0.12), 0 0 24px rgba(139,92,246,0.15)'
            : '0 0 0 1px rgba(5,150,105,0.12), 0 0 18px rgba(5,150,105,0.12)',
      }}
      aria-label={label}
      title={label}
    >
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background:
            target === 'career'
              ? 'radial-gradient(700px 220px at 20% 40%, rgba(139,92,246,0.28), transparent 55%), radial-gradient(700px 220px at 80% 60%, rgba(6,182,212,0.2), transparent 55%)'
              : 'radial-gradient(700px 220px at 20% 40%, rgba(5,150,105,0.22), transparent 55%), radial-gradient(700px 220px at 80% 60%, rgba(224,242,254,0.2), transparent 55%)',
        }}
      />

      <span className="relative flex items-center gap-2">
        <span
          className="w-9 h-9 rounded-[12px] flex items-center justify-center border"
          style={{
            borderColor: target === 'career' ? 'rgba(6,182,212,0.25)' : 'rgba(5,150,105,0.25)',
            background: target === 'career' ? 'rgba(17,17,24,0.75)' : 'rgba(255,255,255,0.82)',
          }}
        >
          {target === 'career' ? (
            <ShipWheel size={18} className="text-[#06B6D4]" />
          ) : (
            <Sparkles size={18} className="text-[#059669]" />
          )}
        </span>
        {!compact && (
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[11px] font-extrabold uppercase tracking-widest opacity-70">
              {world === 'career' ? 'Career' : 'Study'}
            </span>
            <span className="text-sm font-extrabold">{label}</span>
          </span>
        )}
        {compact && <span className="text-xs font-extrabold uppercase tracking-widest">{label}</span>}
      </span>
    </button>
  );
}

