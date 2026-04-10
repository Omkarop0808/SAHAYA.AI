import { getSupabase } from './supabaseClient.js';
import { callGemini } from './gemini.js';
import { readDB } from '../middleware/db.js';

export const WORLDS = {
  study: 'study',
  career: 'career',
};

function nowIso() {
  return new Date().toISOString();
}

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

export function computeLevel(xp) {
  let remaining = Number(xp) || 0;
  let level = 1;
  while (true) {
    let req = 500;
    if (level >= 11 && level <= 25) req = 1000;
    else if (level >= 26 && level <= 50) req = 2000;
    else if (level > 50) req = 5000;

    if (remaining >= req) {
      remaining -= req;
      level++;
    } else {
      break;
    }
  }
  return level;
}

export function getRankName(xp) {
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

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export async function getOrCreateGamification(userId) {
  const supabase = getSupabase();
  if (!supabase) return { userId, xp: 0, level: 1, streak: 0, badges: [] };

  const { data: profile } = await supabase
    .from('gamification_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profile) {
    return {
      userId: profile.user_id,
      xp: parseInt(profile.xp),
      level: profile.level,
      streak: profile.streak,
      lastStreakDate: profile.last_streak_date,
      badges: [] // will fetch from user_badges
    };
  }

  const newProfile = {
    user_id: userId,
    xp: 0,
    level: 1,
    streak: 0,
    last_streak_date: null,
    updated_at: nowIso(),
    created_at: nowIso()
  };

  await supabase.from('gamification_profiles').insert(newProfile);
  await updateLeaderboard(userId, 0);

  return {
    userId,
    xp: 0,
    level: 1,
    streak: 0,
    lastStreakDate: null,
    badges: []
  };
}

async function updateLeaderboard(userId, xp) {
  const supabase = getSupabase();
  if (!supabase) return;
  const rank_name = getRankName(xp);
  
  await supabase.from('leaderboard').upsert({
    user_id: userId,
    xp_total: xp,
    rank_name,
    updated_at: nowIso()
  });
}

export async function awardXp(userId, amount, reason = 'xp_awarded', opts = {}) {
  const delta = Number(amount) || 0;
  if (delta <= 0) return getOrCreateGamification(userId);

  const supabase = getSupabase();
  if (!supabase) return { userId, xp: 0, level: 1, streak: 0 };

  const profile = await getOrCreateGamification(userId);
  let newStreak = profile.streak;
  let lastDate = profile.lastStreakDate;
  
  const d = todayUTC();
  if (lastDate !== d) {
    if (!lastDate) {
      newStreak = 1;
    } else {
      const prev = new Date(`${lastDate}T12:00:00Z`);
      const cur = new Date(`${d}T12:00:00Z`);
      const diffDays = Math.round((cur - prev) / (24 * 3600 * 1000));
      
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        // check streak shields
        const { data: shieldData } = await supabase.from('streak_shields').select('shields_remaining').eq('user_id', userId).single();
        if (shieldData && shieldData.shields_remaining > 0) {
           await supabase.from('streak_shields').update({ shields_remaining: shieldData.shields_remaining - 1, updated_at: nowIso() }).eq('user_id', userId);
           newStreak += 1; // Used shield!
        } else {
           newStreak = 1; // Streak broken
        }
      }
    }
    lastDate = d;
  }

  const newXp = profile.xp + delta;
  const newLevel = computeLevel(newXp);

  await supabase.from('gamification_profiles').update({
    xp: newXp,
    level: newLevel,
    streak: newStreak,
    last_streak_date: lastDate,
    updated_at: nowIso()
  }).eq('user_id', userId);

  await updateLeaderboard(userId, newXp);

  // Auto-progress quests that loosely match the reason
  if (reason) {
    const rL = reason.toLowerCase();
    // Guess world from reason
    const w = rL.includes('career') || rL.includes('interview') || rL.includes('arena') ? 'career' : 'study';
    await incrementQuest(userId, w, rL, 1).catch(()=>null);
  }

  return {
    userId,
    xp: newXp,
    level: newLevel,
    streak: newStreak,
    lastStreakDate: lastDate
  };
}

export function xpFromQuizScore(scorePercent, totalQuestions) {
  const base = Math.round((scorePercent / 100) * (totalQuestions || 10) * 2);
  return clamp(base + 10, 5, 200);
}

// Generate lazy quests using AI
async function generateAiQuests(userId, category) {
  const prompt = `You are the Game Master of SAHAYA.AI. Generate 3 engaging daily quests for a user in the '${category}' world. 
  1 easy (+50 XP), 1 medium (+100 XP), 1 hard (+150 XP). 
  Return ONLY a valid JSON array of objects with these exact keys:
  - "title": short catchy title
  - "description": 1 sentence what to do
  - "xpReward": integer (50, 100, or 150)
  - "target": integer (e.g. 10 for 'do 10 flashcards', 1 for 'complete 1 session')
  - "slug": short snake_case identifier (e.g. 'study_flashcard_10')`;

  try {
     const text = await callGemini(prompt, 'Create 3 daily quests');
     const jsonMatch = text.match(/\[[\s\S]*\]/);
     if (jsonMatch) {
       return JSON.parse(jsonMatch[0]).slice(0, 3);
     }
  } catch (e) {
     console.error('Quest AI gen err:', e);
  }
  
  // fallback if AI fails
  if (category === WORLDS.career) {
    return [
      { slug: 'career_socratic_turns', title: 'Socratic Sprint', description: 'Complete 3 Socratic chat turns', target: 3, xpReward: 50 },
      { slug: 'career_attempts', title: 'Arena Momentum', description: 'Submit 2 problem attempts', target: 2, xpReward: 100 },
      { slug: 'career_interview_lab', title: 'Mock Master', description: 'Complete 1 Mock Interview session', target: 1, xpReward: 150 },
    ];
  }
  return [
    { slug: 'study_flashcard_weak', title: 'Memory Builder', description: 'Complete 10 flashcards', target: 10, xpReward: 50 },
    { slug: 'study_adaptive_quiz', title: 'Quiz Whiz', description: 'Pass 1 adaptive quiz', target: 1, xpReward: 100 },
    { slug: 'study_roadmap_node', title: 'Progression', description: 'Complete 1 roadmap node', target: 1, xpReward: 150 },
  ];
}

export async function getOrCreateDailyQuests(userId, world) {
  const supabase = getSupabase();
  if (!supabase) return [];

  const dateStr = todayUTC();
  // Fetch existing quests that haven't expired
  const { data: existing } = await supabase
    .from('daily_quests')
    .select('*')
    .eq('user_id', userId)
    .eq('category', world || 'global')
    .gt('expires_at', nowIso());

  if (existing && existing.length >= 3) {
    return existing;
  }

  // Need to generate new quests!
  // clear old pendings just in case
  await supabase.from('daily_quests').delete().eq('user_id', userId).eq('category', world);

  const expires_at = new Date();
  expires_at.setUTCHours(23, 59, 59, 999);
  
  const generated = await generateAiQuests(userId, world || 'global');
  
  const toInsert = generated.map(q => ({
    user_id: userId,
    title: q.title,
    description: q.description,
    xp_reward: q.xpReward,
    category: world || 'global',
    status: 'pending',
    progress: 0,
    target: q.target || 1,
    slug: q.slug,
    expires_at: expires_at.toISOString(),
  }));

  const { data: inserted, error } = await supabase
    .from('daily_quests')
    .insert(toInsert)
    .select('*');

  if (error) {
    console.error('[GAMIFICATION] Error inserting quests:', error);
  }

  return inserted || [];
}

export async function incrementQuest(userId, world, slugMatch, inc = 1) {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: quests } = await supabase
    .from('daily_quests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (!quests) return;

  // We find any quest whose slug partially matches or we apply wildcard increments like "any study session"
  for (const q of quests) {
    if (q.slug && q.slug.includes(slugMatch)) {
       const cur = clamp(q.progress + inc, 0, q.target);
       let status = 'pending';
       if (cur >= q.target) {
          status = 'completed'; // completed but not claimed yet
       }
       await supabase.from('daily_quests').update({ progress: cur, status, updated_at: nowIso() }).eq('id', q.id);
    }
  }
}

export async function claimQuest(userId, questId) {
   const supabase = getSupabase();
   if (!supabase) return { error: 'No DB' };

   const { data: q } = await supabase.from('daily_quests').select('*').eq('id', questId).single();
   if (!q) return { error: 'Quest not found' };
   if (q.status === 'claimed') return { error: 'Already claimed' };
   if (q.status !== 'completed' && q.progress < q.target) return { error: 'Quest not finished' };

   // Mark claimed
   await supabase.from('daily_quests').update({ status: 'claimed' }).eq('id', q.id);

   // Award XP
   await awardXp(userId, q.xp_reward, 'Quest Claim');

   // Check if all 3 are claimed today
   const { data: todayQuests } = await supabase.from('daily_quests').select('*').eq('user_id', userId).eq('category', q.category).gt('expires_at', nowIso());
   
   if (todayQuests) {
      const allClaimed = todayQuests.every(x => x.status === 'claimed');
      if (allClaimed && todayQuests.length >= 3) {
         // Daily complete bonus
         await awardXp(userId, 50, 'Daily Quests Complete Bonus');
         // Grant a streak shield
         const { data: shieldData } = await supabase.from('streak_shields').select('shields_remaining').eq('user_id', userId).single();
         const count = shieldData ? shieldData.shields_remaining : 0;
         await supabase.from('streak_shields').upsert({ user_id: userId, shields_remaining: count + 1, updated_at: nowIso() });
         return { success: true, bonusTriggered: true, xpDelta: q.xp_reward + 50, shieldAwarded: true };
      }
   }

   return { success: true, bonusTriggered: false, xpDelta: q.xp_reward };
}

export async function listLeaderboard(limit = 100) {
  const supabase = getSupabase();
  const users = await readDB('users'); // keep legacy username read

  if (!supabase) return [];
  const { data: lb } = await supabase
    .from('leaderboard')
    .select('*')
    .order('xp_total', { ascending: false })
    .limit(limit);

  if (!lb) return [];

  // get levels/streaks
  const { data: profs } = await supabase.from('gamification_profiles').select('*');

  return lb.map(entry => {
    const u = users.find(x => x.id === entry.user_id);
    const p = profs?.find(x => x.user_id === entry.user_id);
    let fallbackName = 'Student';
    // If the user_id is the mock name (e.g. "Omkar"), use it!
    if (entry.user_id && !entry.user_id.includes('-') && entry.user_id !== 'dummy_user') {
       fallbackName = entry.user_id;
    }
    return {
      userId: entry.user_id,
      name: u?.name || fallbackName,
      xp: entry.xp_total,
      level: p?.level || 1,
      streak: p?.streak || 0,
      rank: entry.rank_name,
    };
  });
}
