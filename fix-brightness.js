const fs = require('fs');

// Fix globals.css - brighter base colors
let g = fs.readFileSync('src/app/globals.css', 'utf8');
g = g.replace('--terminal-muted: #888;', '--terminal-muted: #b0b0b8;');
g = g.replace('--terminal-dim: #444;', '--terminal-dim: #888;');
g = g.replace('--terminal-text: #e8e4d8;', '--terminal-text: #f5f2ec;');
g = g.replace('--terminal-border: #1e1e30;', '--terminal-border: #2a2a40;');
fs.writeFileSync('src/app/globals.css', g);
console.log('globals.css updated');

// Fix TopBar - bigger RALLYIQ title, brighter everything
let t = fs.readFileSync('src/components/layout/TopBar.tsx', 'utf8');

// RALLYIQ title - bigger and white
t = t.replace(
  'font-mono font-bold text-base text-white tracking-wide',
  'font-mono font-bold text-lg text-white tracking-wide'
);
// Also catch original size if not yet updated
t = t.replace(
  'font-mono font-bold text-sm text-terminal-text tracking-wide',
  'font-mono font-bold text-lg text-white tracking-wide'
);

// Dashboard page title - bigger and white
t = t.replace(
  'text-sm text-white font-mono uppercase tracking-widest hidden sm:block',
  'text-sm text-white/90 font-mono uppercase tracking-widest hidden sm:block'
);
t = t.replace(
  'text-xs text-terminal-muted font-mono uppercase tracking-widest hidden sm:block',
  'text-sm text-white/90 font-mono uppercase tracking-widest hidden sm:block'
);

// Match count + time - bright white
t = t.replace(
  'font-mono text-xs text-white hidden',
  'font-mono text-xs text-white/90 hidden'
);
t = t.replace(
  'font-mono text-2xs text-terminal-dim hidden',
  'font-mono text-xs text-white/80 hidden'
);

// Date - bright
t = t.replace(
  'font-mono text-xs text-white hidden lg:block',
  'font-mono text-xs text-white/80 hidden lg:block'
);
t = t.replace(
  'font-mono text-2xs text-terminal-dim hidden lg:block',
  'font-mono text-xs text-white/80 hidden lg:block'
);

// Separator brighter
t = t.replace(
  'text-terminal-border">|</span>',
  'text-terminal-muted">|</span>'
);

fs.writeFileSync('src/components/layout/TopBar.tsx', t);
console.log('TopBar.tsx updated');
console.log('RALLYIQ title check:', t.includes('text-lg text-white'));
