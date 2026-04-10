import React, { useEffect, useState, useRef } from 'react';
import { useGamification } from '../../context/GamificationContext';
import api from '../../utils/api';
import gsap from 'gsap';

export default function DailyQuestsPanel({ world = 'study' }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addNotification, refreshProfile } = useGamification();
  const [timeLeft, setTimeLeft] = useState('');

  const fetchQuests = async () => {
    try {
      const { data } = await api.get(`/gamification/quests?world=${world}`);
      setQuests(data.quests || []);
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchQuests();
    
    // Countdown timer to midnight
    const tmr = setInterval(() => {
      const now = new Date();
      const next = new Date();
      next.setUTCHours(23,59,59,999);
      const diff = next - now;
      if (diff > 0) {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setTimeLeft(`${h}h ${m}m`);
      }
    }, 60000);
    // run once immediately
    const now = new Date();
    const next = new Date();
    next.setUTCHours(23,59,59,999);
    setTimeLeft(`${Math.floor((next-now)/3600000)}h ${Math.floor(((next-now)%3600000)/60000)}m`);

    return () => clearInterval(tmr);
  }, [world]);

  const claimQuest = async (e, q) => {
    e.preventDefault();
    if (q.status !== 'completed') return;

    const btn = e.currentTarget;
    
    // Animate coin fly
    const coin = document.createElement('div');
    coin.innerHTML = world === 'career' ? '⚡' : '🪙';
    coin.style.position = 'fixed';
    coin.style.left = `${e.clientX}px`;
    coin.style.top = `${e.clientY}px`;
    coin.style.fontSize = '24px';
    coin.style.zIndex = '99999';
    document.body.appendChild(coin);

    gsap.to(coin, {
      x: window.innerWidth - e.clientX - 100, // Roughly top right DashHeader
      y: 20 - e.clientY,
      duration: 1,
      ease: "power2.in",
      onComplete: () => coin.remove()
    });

    try {
      const { data } = await api.post('/gamification/quests/claim', { questId: q.id });
      if (data.success) {
        // Find quest card and animate glow
        const card = btn.closest('.quest-card');
        if (card) {
          gsap.to(card, { backgroundColor: world === 'career' ? 'rgba(139, 92, 246, 0.2)' : '#c8f7c5', duration: 0.3, yoyo: true, repeat: 1 });
        }
        if (data.bonusTriggered) {
          setTimeout(() => addNotification(`🎉 Daily Quests Complete! +50 XP and Streak Shield earned!`), 1000);
        }
        await fetchQuests();
        refreshProfile(); 
      }
    } catch(err) {
      console.error(err);
    }
  }

  const isCareer = world === 'career';

  if (loading) {
    if (isCareer) return <div className="animate-pulse bg-white/5 border border-white/10 rounded-2xl h-40"></div>;
    return <div className="animate-pulse bg-white border-2 border-[#E0E0E0] rounded-[16px] h-40"></div>;
  }

  return (
    <div className={isCareer ? "career-card p-5" : "bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5 shadow-[4px_4px_0_#E0E0E0]"}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={isCareer ? "font-display font-extrabold text-xl text-white" : "font-display font-extrabold text-xl text-[#0D0D0D]"}>Daily Quests</h3>
          <p className={isCareer ? "text-sm text-white/65" : "text-sm text-[#555555]"}>Earn XP and rank up!</p>
        </div>
        <div className={isCareer ? "text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-accent2)] bg-[var(--career-accent2)]/10 px-2 py-1 rounded border border-[var(--career-accent2)]/20" : "text-xs font-bold text-[#0D0D0D] bg-[#FFFF66] px-2 py-1 rounded border-2 border-[#0D0D0D]"}>
          Refreshes in {timeLeft}
        </div>
      </div>
      
      <div className="space-y-3">
        {quests.map(q => {
          let progressPercent = Math.min(100, Math.round((q.progress / q.target) * 100));
          return (
            <div key={q.id} className={`quest-card flex items-center justify-between gap-4 p-3 rounded-xl relative overflow-hidden ${isCareer ? "border border-white/10 bg-white/5" : "border-2 border-[#E0E0E0] bg-white"}`}>
              <div className="flex-1 min-w-0 z-10 relative">
                <div className="flex justify-between items-end mb-1">
                  <h4 className={`font-bold text-sm truncate ${isCareer ? "text-white" : "text-[#0D0D0D]"}`}>{q.title}</h4>
                  <span className={`text-xs font-bold ${isCareer ? "text-[var(--career-accent)]" : "text-[#0D0D0D]"}`}>+{q.xp_reward} XP</span>
                </div>
                <p className={`text-xs truncate mb-2 ${isCareer ? "text-white/55" : "text-[#555555]"}`}>{q.description}</p>
                <div className={`h-2 w-full rounded-full overflow-hidden ${isCareer ? "bg-white/10" : "bg-[#F0F0F0] border border-[#E0E0E0]"}`}>
                   <div className={`h-full transition-all ${isCareer ? "bg-[var(--career-accent)]" : "bg-[#FFB6C1]"}`} style={{ width: `${progressPercent}%` }} />
                </div>
                <div className={`text-[10px] text-right mt-1 font-bold ${isCareer ? "text-white/40" : "text-[#0D0D0D]"}`}>{q.progress}/{q.target}</div>
              </div>
              
              <div className="z-10 relative flex-shrink-0 ml-2">
                {q.status === 'pending' && <div className={`text-xs font-bold px-3 py-1 cursor-not-allowed ${isCareer ? "text-white/30" : "text-[#999999]"}`}>Locked</div>}
                {q.status === 'completed' && <button onClick={(e) => claimQuest(e, q)} className={isCareer ? "career-btn !py-1.5 !px-4" : "bg-[#0D0D0D] text-[#FFFF66] px-4 py-1.5 rounded-[8px] font-bold text-sm cursor-pointer hover:bg-black transition-colors border-2 border-black"}>Claim</button>}
                {q.status === 'claimed' && <div className={`text-xs font-bold px-3 py-1 rounded-full ${isCareer ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" : "text-green-600 bg-green-100 border-2 border-green-200"}`}>Claimed ✨</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
