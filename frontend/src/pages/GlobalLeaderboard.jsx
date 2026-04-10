import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
import { Trophy, Medal, Award, Flame, Zap, Users, Shield, GraduationCap } from 'lucide-react';

const BADGE_COLORS = {
  Rookie: 'bg-gray-300 text-gray-800',
  Explorer: 'bg-green-400 text-green-900',
  Scholar: 'bg-blue-400 text-blue-900',
  Tactician: 'bg-purple-400 text-purple-900',
  Elite: 'bg-[#FBBF24] text-[#78350F]', // restores yellow-400/900
  Master: 'bg-orange-500 text-white',
  Grandmaster: 'bg-red-600 text-white',
  Legend: 'bg-gradient-to-r from-[#EC4899] via-red-500 to-[#EAB308] text-white animate-pulse', // restores pink/yellow
};

// Top 3 Hero Cards
function Top3Card({ user, rank }) {
  if (!user) return null;
  const isFirst = rank === 1;
  const isSecond = rank === 2;
  
  let crownIcon = null;
  let border = 'border-[#E0E0E0]';
  let height = 'min-h-[200px]';
  let glow = '';

  if (isFirst) {
    crownIcon = <Trophy size={40} className="text-[#FBBF24] drop-shadow-md" />;
    border = 'border-[#FBBF24]';
    glow = 'shadow-[0_0_30px_rgba(250,204,21,0.4)]';
    height = 'min-h-[240px] -translate-y-4';
  } else if (isSecond) {
    crownIcon = <Medal size={32} className="text-gray-300 drop-shadow-md" />;
    border = 'border-gray-300';
    height = 'min-h-[210px] -translate-y-2';
  } else {
    crownIcon = <Award size={32} className="text-amber-600 drop-shadow-md" />;
    border = 'border-amber-600';
    height = 'min-h-[190px]';
  }

  // Ensure rank gracefully falls back
  const rankKey = user.rank ? user.rank.trim() : 'Rookie';
  const badgeClass = BADGE_COLORS[rankKey] || BADGE_COLORS['Rookie'];

  return (
    <div className={`relative flex-1 bg-[#1a1a1a] rounded-[24px] border-4 flex flex-col items-center justify-center p-6 mx-2 transition-all ${border} ${height} ${glow} animate-fadeUp`}>
       <div className="mb-3 shrink-0 flex items-center justify-center">{crownIcon}</div>
       <div className="shrink-0 w-16 h-16 rounded-full bg-white flex items-center justify-center text-3xl font-extrabold text-black border-4 border-[#0D0D0D] z-10 relative shadow-inner">
          {user.name?.[0]?.toUpperCase()}
       </div>
       <div className="font-display font-extrabold text-white text-xl mt-4 truncate w-full text-center shrink-0">{user.name}</div>
       <div className={`shrink-0 text-[11px] uppercase tracking-wide font-black px-3 py-1 rounded-full mt-2 ${badgeClass}`}>{rankKey}</div>
       <div className="shrink-0 font-black tracking-wide text-[#FFFF66] mt-4 text-lg">{user.xp} XP</div>
       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent rounded-[20px] pointer-events-none" />
    </div>
  )
}

export default function GlobalLeaderboard() {
  const { leaderboard } = useGamification();
  const { user } = useAuth();
  const [filter, setFilter] = useState('Global');
  const [time, setTime] = useState('All-Time');

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const myRank = leaderboard.findIndex(x => x.userId === user?.id);
  const isOutsideTop10 = myRank > 9;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-[#F9F9F9] min-w-0">
        <DashHeader title="World Leaderboard" />
        <div className="p-8 max-w-5xl mx-auto w-full space-y-8 max-sm:p-4">

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div>
                <h1 className="text-3xl font-display font-extrabold text-[#0D0D0D]">Hall of Fame</h1>
                <p className="text-[#555555]">Compete with students globally and prove your mastery.</p>
             </div>
             <div className="flex flex-col gap-2">
                <div className="flex bg-[#E0E0E0] p-1 rounded-xl">
                   {['Global', 'Friends', 'College Batch'].map(f => (
                     <button key={f} onClick={() => setFilter(f)}
                       className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filter === f ? 'bg-white text-black shadow-sm' : 'text-[#555555] hover:text-black'}`}>
                       {f === 'Global' && <Users size={14} className="inline mr-1 -mt-0.5"/>}
                       {f === 'Friends' && <Shield size={14} className="inline mr-1 -mt-0.5"/>}
                       {f === 'College Batch' && <GraduationCap size={14} className="inline mr-1 -mt-0.5"/>}
                       {f}
                     </button>
                   ))}
                </div>
                <div className="flex bg-[#E0E0E0] p-1 rounded-xl self-end">
                   {['All-Time', 'Weekly'].map(f => (
                     <button key={f} onClick={() => setTime(f)}
                       className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${time === f ? 'bg-black text-white shadow-sm' : 'text-[#555555] hover:text-black'}`}>
                       {f}
                     </button>
                   ))}
                </div>
             </div>
          </div>

          {/* Top 3 Section */}
          <div className="flex items-end justify-center gap-4 pt-10">
            {top3[1] && <Top3Card user={top3[1]} rank={2} />}
            {top3[0] && <Top3Card user={top3[0]} rank={1} />}
            {top3[2] && <Top3Card user={top3[2]} rank={3} />}
          </div>

          {/* Rest of Leaderboard */}
          <div className="bg-white border-2 border-[#E0E0E0] rounded-[24px] overflow-hidden">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-[#111] text-white text-xs uppercase tracking-widest">
                     <th className="py-4 px-6 font-bold">Rank</th>
                     <th className="py-4 px-6 font-bold">User</th>
                     <th className="py-4 px-6 font-bold">Tier</th>
                     <th className="py-4 px-6 font-bold">Level</th>
                     <th className="py-4 px-6 font-bold">Streak</th>
                     <th className="py-4 px-6 font-bold text-right">XP Total</th>
                   </tr>
                </thead>
                <tbody>
                   {leaderboard.slice(0, 10).map((row, idx) => (
                     <tr key={row.userId} className={`border-b border-[#E0E0E0] last:border-none ${row.userId === user?.id ? 'bg-[#FFFF66]/20' : 'hover:bg-[#F9F9F9]'} transition-colors`}>
                       <td className="py-4 px-6 font-bold text-[#555555]">#{idx + 1}</td>
                       <td className="py-4 px-6 font-bold text-[#0D0D0D] flex items-center gap-3">
                         <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs">{row.name[0]}</div>
                         {row.name}
                       </td>
                       <td className="py-4 px-6"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${BADGE_COLORS[row.rank || 'Rookie']}`}>{row.rank}</span></td>
                       <td className="py-4 px-6 font-bold text-[#555]">{row.level}</td>
                       <td className="py-4 px-6 font-bold text-orange-500 flex items-center gap-1"><Flame size={14}/>{row.streak}</td>
                       <td className="py-4 px-6 font-display font-extrabold text-right text-black">{row.xp}</td>
                     </tr>
                   ))}
                   
                   {/* Pinned current user if outside top 10 */}
                   {isOutsideTop10 && leaderboard[myRank] && (
                     <>
                        <tr className="bg-[#f0f0f0]">
                          <td colSpan={6} className="py-1 text-center text-xs font-bold text-[#999]">•••</td>
                        </tr>
                        <tr className="border-t-4 border-[#0D0D0D] bg-[#FFFF66]/30 animate-pulse">
                          <td className="py-4 px-6 font-bold text-black border-l-4 border-l-yellow-500">#{myRank + 1}</td>
                          <td className="py-4 px-6 font-bold text-[#0D0D0D] flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#FFB6C1] rounded-full flex items-center justify-center text-xs">{leaderboard[myRank].name[0]}</div>
                            {leaderboard[myRank].name} (You)
                          </td>
                          <td className="py-4 px-6"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${BADGE_COLORS[leaderboard[myRank].rank || 'Rookie']}`}>{leaderboard[myRank].rank}</span></td>
                          <td className="py-4 px-6 font-bold text-[#555]">{leaderboard[myRank].level}</td>
                          <td className="py-4 px-6 font-bold text-orange-500 flex items-center gap-1"><Flame size={14}/>{leaderboard[myRank].streak}</td>
                          <td className="py-4 px-6 font-display font-extrabold text-right text-black">{leaderboard[myRank].xp}</td>
                        </tr>
                     </>
                   )}
                </tbody>
             </table>
          </div>
        </div>
      </div>
    </div>
  );
}
