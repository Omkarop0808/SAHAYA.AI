const fs = require('fs');
const path = require('path');

const dir = 'd:/Sahaya.ai/frontend/src/features/career-roadmap/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx')).map(f => path.join(dir, f));

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
  'text-white/40': 'text-[var(--career-muted)]',
  'text-white/30': 'text-[var(--career-muted)]',
  'text-white/20': 'text-[var(--career-muted)] opacity-50',
  
  'bg-white/\\[0\\.03\\]': 'bg-[var(--career-surface)]',
  'bg-white/\\[0\\.04\\]': 'bg-[var(--career-surface)]',
  'bg-white/\\[0\\.05\\]': 'bg-[var(--career-surface)]',
  'bg-white/5': 'bg-[var(--career-surface)]',
  'bg-white/10': 'bg-[var(--career-surface)] border border-[var(--career-border)]',
  'hover:bg-white/10': 'hover:bg-[var(--career-border)] hover:bg-opacity-30',
  'hover:bg-white/20': 'hover:bg-[var(--career-border)] hover:bg-opacity-50',
  'hover:bg-white/\\[0\\.1\\]': 'hover:bg-[var(--career-border)] hover:bg-opacity-30',
  'hover:bg-white/\\[0\\.05\\]': 'hover:bg-[var(--career-surface)]',
  
  'border-white/10': 'border-[var(--career-border)]',
  'border-white/20': 'border-[var(--career-border)]',
  'border-white/\\[0\\.05\\]': 'border-[var(--career-border)]',
  'border-white/\\[0\\.1\\]': 'border-[var(--career-border)]',

  'bg-black/30': 'bg-[var(--career-surface)]',
  'bg-black/40': 'bg-[var(--career-surface)]',
  'bg-\\[#111118\\]': 'bg-[var(--career-surface)]',
  'bg-\\[#1a1a24\\]': 'bg-[var(--career-surface)]',
  
  'rgba\\(139,92,246,0\\.25\\)': 'var(--career-border)',
  'rgba\\(139,92,246,0\\.05\\)': 'var(--career-surface)',
  'rgba\\(139,92,246,0\\.1\\)': 'var(--career-surface)'
};

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  for (const [key, val] of Object.entries(replacements)) {
    const regex = new RegExp(key, 'g');
    content = content.replace(regex, val);
  }
  content = content.replace(/\btext-white\b(?!\/)/g, 'text-[var(--career-text)]');
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
}
