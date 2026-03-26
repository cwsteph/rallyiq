const fs=require("fs");

// Fix TopBar - brighter everything
let t=fs.readFileSync("src/components/layout/TopBar.tsx","utf8");
// RALLYIQ title bigger and brighter
t=t.replace("font-mono font-bold text-sm text-terminal-text tracking-wide","font-mono font-bold text-base text-white tracking-wide");
// Dashboard page title brighter and bigger
t=t.replace("text-xs text-terminal-text font-mono uppercase tracking-widest","text-sm text-white font-mono uppercase tracking-widest");
// Match count brighter
t=t.replace("font-mono text-xs text-terminal-text hidden","font-mono text-xs text-white hidden");
t=t.replace("text-terminal-muted\">","text-terminal-text\">");
// Date brighter
t=t.replace("font-mono text-xs text-terminal-muted hidden lg:block","font-mono text-xs text-white hidden lg:block");
fs.writeFileSync("src/components/layout/TopBar.tsx",t);
console.log("TopBar updated");

// Find and fix stat card labels - they are in the page components
// Check globals.css for muted color overrides
let g=fs.readFileSync("src/app/globals.css","utf8");
// Make --terminal-muted brighter
g=g.replace("--terminal-muted: #888;","--terminal-muted: #aaa;");
g=g.replace("--terminal-dim: #444;","--terminal-dim: #777;");
g=g.replace("--terminal-text: #e8e4d8;","--terminal-text: #f0ece4;");
fs.writeFileSync("src/app/globals.css",g);
console.log("globals.css updated");
