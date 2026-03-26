const fs = require('fs');

// Fix globals.css - replace whatever dim/muted values exist with bright ones
let g = fs.readFileSync('src/app/globals.css', 'utf8');

// Print current values for debugging
const dimMatch = g.match(/--terminal-dim:\s*([^;]+)/);
const mutedMatch = g.match(/--terminal-muted:\s*([^;]+)/);
const textMatch = g.match(/--terminal-text:\s*([^;]+)/);
console.log('Current dim:', dimMatch?.[1]);
console.log('Current muted:', mutedMatch?.[1]);
console.log('Current text:', textMatch?.[1]);

// Replace with bright readable values
g = g.replace(/--terminal-dim:\s*[^;]+;/, '--terminal-dim: #8899aa;');
g = g.replace(/--terminal-muted:\s*[^;]+;/, '--terminal-muted: #aab8c8;');
g = g.replace(/--terminal-text:\s*[^;]+;/, '--terminal-text: #f0ece4;');

fs.writeFileSync('src/app/globals.css', g);

// Verify
const g2 = fs.readFileSync('src/app/globals.css', 'utf8');
console.log('New dim:', g2.match(/--terminal-dim:\s*([^;]+)/)?.[1]);
console.log('New muted:', g2.match(/--terminal-muted:\s*([^;]+)/)?.[1]);
console.log('New text:', g2.match(/--terminal-text:\s*([^;]+)/)?.[1]);
console.log('Done!');
