import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const src = 'seguridad-caos-exp3/evidencias-locales/dns-netpol-fix/local-netpols-only.yaml';
const out = 'seguridad-caos-exp3/evidencias-locales/dns-netpol-fix/changed-netpols-only.yaml';
const wanted = new Set(['cine-exp3-allow-dns', 'cine-exp3-allow-receiver-ingress']);

const desiredRaw = execSync(`kubectl apply --dry-run=client -f "${src}" -o json`, {
  encoding: 'utf8',
});
const j = JSON.parse(desiredRaw);
const items = j.kind === 'List' ? j.items : Array.isArray(j) ? j : [j];
const kept = items.filter((i) => wanted.has(i.metadata.name));
if (kept.length !== 2) {
  console.error('EXPECTED 2 CHANGED NETPOLS, GOT', kept.length, kept.map((i) => i.metadata.name));
  process.exit(1);
}

// Strip server-managed fields for a clean apply payload
const cleaned = kept.map((i) => ({
  apiVersion: i.apiVersion,
  kind: i.kind,
  metadata: {
    name: i.metadata.name,
    namespace: i.metadata.namespace,
    labels: i.metadata.labels,
  },
  spec: i.spec,
}));

const list = { apiVersion: 'v1', kind: 'List', items: cleaned };
writeFileSync(out, JSON.stringify(list, null, 2));
console.log(
  'WROTE',
  out,
  'names=',
  cleaned.map((i) => i.metadata.name).join(','),
);
