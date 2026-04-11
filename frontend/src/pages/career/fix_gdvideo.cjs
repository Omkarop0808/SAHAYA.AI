const fs = require('fs');
const path = 'd:/Sahaya.ai/frontend/src/pages/career/components/GDVideoRoom.jsx';
let content = fs.readFileSync(path, 'utf8');

const replacements = {
  'bg-gray-950': 'bg-[var(--career-surface)]',
  'border-gray-800': 'border-[var(--career-border)]',
  'bg-gray-900': 'bg-[var(--career-surface)]',
  'bg-gray-800/80': 'bg-[var(--career-surface)] bg-opacity-80',
  'border-gray-700': 'border-[var(--career-border)]',
  'text-gray-400': 'text-[var(--career-muted)]',
  'bg-gray-800': 'bg-[var(--career-surface)]',
  
  'text-white/60': 'text-[var(--career-muted)]',
  'border-white/20': 'border-[var(--career-border)]',
  'bg-white/\\[0\\.02\\]': 'bg-[var(--career-surface)]',
  'bg-white/10': 'bg-[var(--career-surface)]',
  'hover:bg-white/20': 'hover:bg-[var(--career-border)] hover:bg-opacity-30'
};

for (const [key, val] of Object.entries(replacements)) {
  const regex = new RegExp(key, 'g');
  content = content.replace(regex, val);
}

// Full word replacements
content = content.replace(/\btext-white\b(?!\/)/g, 'text-[var(--career-text)]');
content = content.replace(/\bbg-black\b(?!\/)/g, 'bg-transparent'); // Zego controls need transparency

fs.writeFileSync(path, content, 'utf8');
console.log('Replacements done in GDVideoRoom.jsx');
