import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const GamificationContext = createContext();

export function useGamification() {
  return useContext(GamificationContext);
}

// Minimal fallback if ENV not present
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export function GamificationProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [levelUp, setLevelUp] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const lastXpRef = useRef(null);
  const lastRankRef = useRef(null);

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/gamification/profile');
      setProfile(data);
      if (lastXpRef.current !== null && data.xp > lastXpRef.current) {
         addNotification(`+${data.xp - lastXpRef.current} XP Earned!`);
      }
      if (data.level && lastXpRef.current !== null && data.level > profile?.level) {
         setLevelUp({ type: 'level', newLevel: data.level, newRank: getRankName(data.xp) });
      }
      lastXpRef.current = data.xp;
    } catch(err) {}
  };

  const refreshLeaderboard = async () => {
    try {
       const { data } = await api.get('/gamification/leaderboard');
       setLeaderboard(data.leaderboard || []);
    } catch(err){}
  };

  useEffect(() => {
    if (user) {
      refreshProfile();
      refreshLeaderboard();
    }
  }, [user]);

  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase.channel('gamification_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gamification_profiles', filter: `user_id=eq.${user.id}` }, (payload) => {
         const newXp = payload.new.xp;
         const oldXp = payload.old.xp || lastXpRef.current;
         const newLevel = payload.new.level;
         if (newXp > oldXp) addNotification(`+${newXp - oldXp} XP`);
         if (profile && newLevel > profile.level) {
            setLevelUp({ type: 'level', newLevel: newLevel, newRank: getRankName(newXp) });
         }
         lastXpRef.current = newXp;
         setProfile(prev => ({ ...prev, ...payload.new }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, (payload) => {
         refreshLeaderboard(); // Naive refresh, can optimize later
         if (payload.new && payload.new.user_id !== user.id) {
            // Check if friend overtakes (simplified: check if they passed us)
            // Implementation requires tracking previous ranks.
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const addNotification = (text) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  return (
    <GamificationContext.Provider value={{
      profile, 
      refreshProfile, 
      addNotification,
      leaderboard,
      levelUp,
      setLevelUp,
      getRankName
    }}>
      {children}
      <ToastContainer notifications={notifications} />
    </GamificationContext.Provider>
  );
}

function ToastContainer({ notifications }) {
  if (notifications.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {notifications.map(n => (
        <div key={n.id} className="bg-gradient-to-r from-[#0D0D0D] to-[#1a1a1a] border-2 border-[#FFFF66] text-[#FFFF66] px-5 py-3 rounded-2xl font-bold flex items-center gap-3 shadow-[0_8px_30px_rgba(255,255,102,0.2)] animate-slideUpFade">
          <span className="text-xl">⚡</span>
          {n.text}
        </div>
      ))}
    </div>
  );
}

function getRankName(xp) {
  const x = Number(xp) || 0;
  if (x < 1000) return 'Rookie';
  if (x < 3000) return 'Explorer';
  if (x < 6000) return 'Scholar';
  if (x < 10000) return 'Tactician';
  if (x < 15000) return 'Elite';
  if (x < 25000) return 'Master';
  if (x < 40000) return 'Grandmaster';
  return 'Legend';
}
