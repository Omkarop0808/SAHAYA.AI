const fs = require('fs');
const path = 'd:/Sahaya.ai/frontend/src/pages/career/InterviewLab.jsx';
let content = fs.readFileSync(path, 'utf8');

// Colors
content = content.replace(/bg-\[#1e1e1e\]/g, 'bg-[var(--career-surface)]');
content = content.replace(/bg-\[#1a1a24\]/g, 'bg-[var(--career-surface)]');
content = content.replace(/bg-\[#2d2d2d\]/g, 'bg-[var(--career-surface)]');
content = content.replace(/text-\[#d4d4d4\]/g, 'text-[var(--career-text)]');

// Common strings
const replacements = {
  'text-white/90': 'text-[var(--career-text)] text-opacity-90',
  'text-white/80': 'text-[var(--career-text)] text-opacity-80',
  'text-white/75': 'text-[var(--career-muted)]',
  'text-white/70': 'text-[var(--career-muted)]',
  'text-white/65': 'text-[var(--career-muted)]',
  'text-white/60': 'text-[var(--career-muted)]',
  'text-white/55': 'text-[var(--career-muted)]',
  'text-white/50': 'text-[var(--career-muted)]',
  'text-white/45': 'text-[var(--career-muted)]',
  'text-white/40': 'text-[var(--career-muted)] shrink-0 opacity-80', // Avoids literal classes breaking
  'text-white/30': 'text-[var(--career-text)] text-opacity-30',
  'text-white/25': 'text-[var(--career-text)] text-opacity-25',
  'text-white/20': 'text-[var(--career-text)] text-opacity-20',
  
  'bg-white/\\[0\\.03\\]': 'bg-[var(--career-surface)]',
  'bg-white/\\[0\\.04\\]': 'bg-[var(--career-surface)]',
  'bg-white/\\[0\\.05\\]': 'bg-[var(--career-surface)]',
  'bg-white/\\[0\\.06\\]': 'bg-[var(--career-surface)]',
  'bg-white/\\[0\\.08\\]': 'bg-[var(--career-surface)]',
  'hover:bg-white/\\[0\\.06\\]': 'hover:bg-[var(--career-border)] hover:bg-opacity-20',
  'hover:bg-white/\\[0\\.1\\]': 'hover:bg-[var(--career-border)] hover:bg-opacity-40',
  'bg-white/10': 'bg-[var(--career-border)] bg-opacity-50',
  
  'bg-black/40': 'bg-[var(--career-surface)]',
  'bg-black/30': 'bg-[var(--career-surface)]',
  
  'border-white/10': 'border-[var(--career-border)]',
  'border-white/15': 'border-[var(--career-border)]',
  'hover:border-white/30': 'hover:border-[var(--career-border)] border-opacity-80',
  'border-white/20': 'border-[var(--career-border)]'
};

for (const [key, val] of Object.entries(replacements)) {
  const regex = new RegExp(key, 'g');
  content = content.replace(regex, val);
}

// Special case: `text-white` to `text-[var(--career-text)]` where it is a full word
content = content.replace(/\btext-white\b(?!\/)/g, 'text-[var(--career-text)]');

fs.writeFileSync(path, content, 'utf8');
console.log('Replacements done in InterviewLab.jsx');
