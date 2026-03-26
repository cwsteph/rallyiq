const fs=require("fs");

// Fix TopBar.tsx
let t=fs.readFileSync("src/components/layout/TopBar.tsx","utf8");
// Bigger, brighter refresh button
t=t.replace("flex items-center gap-1.5 font-mono text-2xs px-2 py-1\n            border border-terminal-border rounded\n            transition-colors\n            ${refreshing\n              ? " + " + text-terminal-dimcursor-wait + " + "\n              : " + " + text-terminal-mutedhover:text-greenhover:border-green/40cursor-pointer + ",
            "flex items-center gap-1.5 font-mono text-xs px-3 py-1.5\n            border border-amber/50 rounded\n            transition-colors\n            ${refreshing\n              ? " + " + text-terminal-mutedcursor-wait + " + "\n              : " + " + text-amberhover:text-greenhover:border-green/60cursor-pointer + ");
// Bigger refresh icon
t=t.replace("size={11}","size={13}");
// Brighter match count
t=t.replace("font-mono text-2xs text-terminal-dim hidden","font-mono text-xs text-terminal-text hidden");
t=t.replace("text-terminal-border/60","text-terminal-muted");
// Brighter date
t=t.replace("font-mono text-2xs text-terminal-dim hidden lg:block","font-mono text-xs text-terminal-muted hidden lg:block");
// Brighter page title
t=t.replace("text-xs text-terminal-muted font-mono","text-xs text-terminal-text font-mono");
fs.writeFileSync("src/components/layout/TopBar.tsx",t);
console.log("TopBar fixed");

// Fix Sidebar.tsx
let s=fs.readFileSync("src/components/layout/Sidebar.tsx","utf8");
// Bigger icons
s=s.replace(/size={16}/g,"size={20}");
// Brighter inactive nav items
s=s.replace("text-terminal-muted hover:text-amber hover:bg-terminal-border","text-terminal-text hover:text-amber hover:bg-terminal-border/60");
// Brighter RQ logo
s=s.replace("font-mono font-bold text-sm text-green tracking-widest","font-mono font-bold text-base text-green tracking-widest");
// Bigger nav item containers
s=s.replace(/w-11 h-11/g,"w-12 h-12");
// Brighter settings icon
s=s.replace("w-11 h-11 flex items-center justify-center rounded text-terminal-muted hover:text-amber","w-12 h-12 flex items-center justify-center rounded text-terminal-text hover:text-amber");
fs.writeFileSync("src/components/layout/Sidebar.tsx",s);
console.log("Sidebar fixed");
