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
    coin.innerHTML = '🪙';
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
          gsap.to(card, { backgroundColor: '#c8f7c5', duration: 0.3, yoyo: true, repeat: 1 });
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

  if (loading) return <div className="animate-pulse bg-white border-2 border-[#E0E0E0] rounded-[16px] h-40"></div>;

  return (
    <div className="bg-white border-2 border-[#0D0D0D] rounded-[16px] p-5 shadow-[4px_4px_0_#E0E0E0]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-extrabold text-xl text-[#0D0D0D]">Daily Quests</h3>
          <p className="text-sm text-[#555555]">Earn XP and rank up!</p>
        </div>
        <div className="text-xs font-bold text-[#0D0D0D] bg-[#FFFF66] px-2 py-1 rounded border-2 border-[#0D0D0D]">
          Refreshes in {timeLeft}
        </div>
      </div>
      
      <div className="space-y-3">
        {quests.map(q => {
          let progressPercent = Math.min(100, Math.round((q.progress / q.target) * 100));
          return (
            <div key={q.id} className="quest-card flex items-center justify-between gap-4 p-3 border-2 border-[#E0E0E0] rounded-xl relative overflow-hidden bg-white">
              <div className="flex-1 min-w-0 z-10 relative">
                <div className="flex justify-between items-end mb-1">
                  <h4 className="font-bold text-[#0D0D0D] text-sm truncate">{q.title}</h4>
                  <span className="text-xs font-bold text-[#0D0D0D]">+{q.xp_reward} XP</span>
                </div>
                <p className="text-xs text-[#555555] truncate mb-2">{q.description}</p>
                <div className="h-2 w-full bg-[#F0F0F0] rounded-full overflow-hidden border border-[#E0E0E0]">
                   <div className="h-full bg-[#FFB6C1] transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="text-[10px] text-right mt-1 font-bold text-[#0D0D0D]">{q.progress}/{q.target}</div>
              </div>
              
              <div className="z-10 relative">
                {q.status === 'pending' && <div className="text-xs font-bold text-[#999999] px-3 py-1 cursor-not-allowed">Locked</div>}
                {q.status === 'completed' && <button onClick={(e) => claimQuest(e, q)} className="bg-[#0D0D0D] text-[#FFFF66] px-4 py-1.5 rounded-[8px] font-bold text-sm cursor-pointer hover:bg-black transition-colors border-2 border-black">Claim</button>}
                {q.status === 'claimed' && <div className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-[8px] border-2 border-green-200">Claimed ✨</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
