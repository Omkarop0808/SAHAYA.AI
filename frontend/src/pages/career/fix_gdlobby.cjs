const fs = require('fs');
const path = 'd:/Sahaya.ai/frontend/src/pages/career/components/GDLobby.jsx';
let content = fs.readFileSync(path, 'utf8');

const replacements = {
  'text-white/90': 'text-[var(--career-text)] text-opacity-90',
  'text-white/70': 'text-[var(--career-muted)]',
  'text-white/50': 'text-[var(--career-muted)]',
  'text-white/40': 'text-[var(--career-muted)]',
  'text-white/30': 'text-[var(--career-muted)]',
  'text-white/20': 'text-[var(--career-muted)] opacity-50',
  
  'bg-white/\\[0\\.01\\]': 'bg-[var(--career-surface)]',
  'bg-white/\\[0\\.02\\]': 'bg-[var(--career-surface)]',
  'bg-white/\\[0\\.04\\]': 'bg-[var(--career-surface)]',
  'bg-white/\\[0\\.05\\]': 'bg-[var(--career-surface)]',
  'bg-white/5': 'bg-[var(--career-surface)]',
  'bg-gray-800': 'bg-[var(--career-surface)]',
  'border-gray-700': 'border-[var(--career-border)]',
  'text-gray-300': 'text-[var(--career-text)]',
  
  'border-white/10': 'border-[var(--career-border)]',
  'border-white/\\[0\\.05\\]': 'border-[var(--career-border)]'
};

for (const [key, val] of Object.entries(replacements)) {
  const regex = new RegExp(key, 'g');
  content = content.replace(regex, val);
}

// Full word replacement for text-white
content = content.replace(/\btext-white\b(?!\/)/g, 'text-[var(--career-text)]');

fs.writeFileSync(path, content, 'utf8');
console.log('Replacements done in GDLobby.jsx');
