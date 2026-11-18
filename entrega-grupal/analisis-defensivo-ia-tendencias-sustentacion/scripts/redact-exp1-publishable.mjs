#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'evidencias', 'exp1-aws-jarrison');

function load(p) {
  let t = readFileSync(p, 'utf8');
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return JSON.parse(t);
}

function redact(obj) {
  const s = JSON.stringify(obj)
    .replace(/10\.\d+\.\d+\.\d+/g, '[REDACTED_CLUSTERIP]')
    .replace(/sgr-[0-9a-f]+/gi, '[REDACTED_SGR]')
    .replace(/127\.0\.0\.1:\d+/g, '[REDACTED_LOCAL_TUNNEL]');
  return JSON.parse(s);
}

const extract = redact(load(join(root, 'FINAL-EXTRACT.sanitized.json')));
const cmp = redact(load(join(root, 'fuentes-aws/comparison-r0-r1.sanitized.json')));
const min = load(join(root, 'extractos/honeytoken-aws.min.json'));
extract.comparison = cmp;
extract.publicationNote =
  'Derivado sanitizado para cine_dvps. Originales en repo privado JarrisonLopez/defensa-profundidad-caos-2026@1cad076. No republicar r0/r1 completos sin autorizacion expresa adicional.';

writeFileSync(join(root, 'FINAL-EXTRACT.sanitized.json'), `${JSON.stringify(extract, null, 2)}\n`);
writeFileSync(join(root, 'fuentes-aws/comparison-r0-r1.sanitized.json'), `${JSON.stringify(cmp, null, 2)}\n`);
writeFileSync(join(root, 'extractos/honeytoken-aws.min.json'), `${JSON.stringify(min, null, 2)}\n`);

const blob = JSON.stringify(extract) + JSON.stringify(cmp);
console.log(
  JSON.stringify({
    hasClusterIpOrSgr: /10\.\d+\.\d+\.\d+|sgr-[0-9a-f]+/i.test(blob),
    hasJwt: /eyJ[a-zA-Z0-9_-]{20,}\./.test(blob),
  }),
);
