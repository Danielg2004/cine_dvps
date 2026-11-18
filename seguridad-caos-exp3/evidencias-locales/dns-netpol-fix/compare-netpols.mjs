import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const localPath = 'seguridad-caos-exp3/evidencias-locales/dns-netpol-fix/local-netpols-only.yaml';
const outPath = 'seguridad-caos-exp3/evidencias-locales/dns-netpol-fix/netpol-compare.json';

const live = JSON.parse(
  execSync('kubectl -n cine-seguridad-exp3 get networkpolicy -o json', { encoding: 'utf8' }),
);
const liveMap = Object.fromEntries(live.items.map((i) => [i.metadata.name, i.spec]));

const desiredRaw = execSync(
  `kubectl apply --dry-run=client -f "${localPath}" -o json`,
  { encoding: 'utf8' },
);

let desiredItems = [];
try {
  const j = JSON.parse(desiredRaw);
  if (j.kind === 'List') desiredItems = j.items;
  else if (Array.isArray(j)) desiredItems = j;
  else desiredItems = [j];
} catch {
  desiredItems = desiredRaw
    .trim()
    .split(/\n(?=\{)/)
    .map((s) => JSON.parse(s));
}

const desiredMap = Object.fromEntries(desiredItems.map((i) => [i.metadata.name, i.spec]));
const names = [...new Set([...Object.keys(liveMap), ...Object.keys(desiredMap)])].sort();
const changed = [];
const unchanged = [];

for (const name of names) {
  const a = JSON.stringify(desiredMap[name] ?? null);
  const b = JSON.stringify(liveMap[name] ?? null);
  if (a === b) {
    unchanged.push(name);
    console.log('UNCHANGED', name);
  } else {
    changed.push(name);
    console.log('CHANGED', name);
    console.log('  desired', a.slice(0, 1000));
    console.log('  live   ', b.slice(0, 1000));
  }
}

console.log('SUMMARY_CHANGED', JSON.stringify(changed));
console.log('SUMMARY_UNCHANGED', JSON.stringify(unchanged));
writeFileSync(outPath, JSON.stringify({ changed, unchanged, desiredMap, liveMap }, null, 2));
