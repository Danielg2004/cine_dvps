import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const ns = 'cine-seguridad-exp3';
const ev = 'seguridad-caos-exp3/evidencias-locales/dns-netpol-fix';
const ts = () => new Date().toISOString();

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function kubectlJson(args) {
  return JSON.parse(sh(`kubectl ${args}`));
}

function execNode(pod, code) {
  // Write script via stdin using node -e is painful on Windows quoting;
  // use base64 transport.
  const b64 = Buffer.from(code, 'utf8').toString('base64');
  const wrapper = `node -e "eval(Buffer.from('${b64}','base64').toString('utf8'))"`;
  return sh(`kubectl -n ${ns} exec ${pod} -- sh -c ${JSON.stringify(wrapper)}`);
}

const pods = kubectlJson(`-n ${ns} get pods -o json`).items;
const ea = pods.find((p) => p.metadata.labels?.instance === 'emitter-a')?.metadata.name;
const eb = pods.find((p) => p.metadata.labels?.instance === 'emitter-b')?.metadata.name;
const rx = pods.find((p) => p.metadata.labels?.['cine.security.chaos/role'] === 'otlp-receiver')
  ?.metadata.name;
if (!ea || !eb || !rx) throw new Error(`missing pods ea=${ea} eb=${eb} rx=${rx}`);

const dnsCode = `
const dns=require('dns');
const targets=['cine-exp3-otlp-receiver','cine-exp3-otlp-receiver.cine-seguridad-exp3.svc.cluster.local'];
(async()=>{
  const results=[];
  for (const t of targets){
    try{const a=await dns.promises.lookup(t); results.push({target:t,ok:true,address:a.address});}
    catch(e){results.push({target:t,ok:false,code:e.code,message:e.message});}
  }
  console.log(JSON.stringify({results}));
})();
`;

const otlpCode = `
const net=require('net'); const dns=require('dns'); const http=require('http');
(async()=>{
  const host='cine-exp3-otlp-receiver.cine-seguridad-exp3.svc.cluster.local';
  let address; try{address=(await dns.promises.lookup(host)).address;}catch(e){
    console.log(JSON.stringify({dnsOk:false,code:e.code})); return;
  }
  const tcp=await new Promise(r=>{const s=net.connect(4319,host,()=>{s.destroy();r({ok:true});});
    s.setTimeout(5000,()=>{s.destroy();r({ok:false,err:'TIMEOUT'});});
    s.on('error',e=>r({ok:false,err:e.message}));});
  const health=await new Promise(r=>{const req=http.get({host,port:4319,path:'/healthz',timeout:5000},res=>{
    let b=''; res.on('data',d=>b+=d); res.on('end',()=>r({ok:true,status:res.statusCode,body:b}));});
    req.on('error',e=>r({ok:false,err:e.message}));
    req.on('timeout',()=>{req.destroy();r({ok:false,err:'TIMEOUT'});});});
  console.log(JSON.stringify({dnsOk:true,address,tcp4319:tcp,health}));
})();
`;

const dnsTcpCode = `
const net=require('net');
(async()=>{
  const r=await new Promise(res=>{const s=net.connect(53,'169.254.20.10',()=>{s.destroy();res({ok:true});});
    s.setTimeout(3000,()=>{s.destroy();res({ok:false,err:'TIMEOUT'});});
    s.on('error',e=>res({ok:false,err:e.message}));});
  console.log(JSON.stringify({target:'169.254.20.10:53',tcp:r}));
})();
`;

// Isolation negatives: try TCP to cine-api ClusterIP, known SQL proxy port pattern, and a fake OCI collector IP if configured
const isolationCode = `
const net=require('net');
async function probe(host,port,label){
  return await new Promise(res=>{
    const s=net.connect(port,host,()=>{s.destroy();res({label,host,port,ok:true,blocked:false});});
    s.setTimeout(3000,()=>{s.destroy();res({label,host,port,ok:false,blocked:true,err:'TIMEOUT'});});
    s.on('error',e=>res({label,host,port,ok:false,blocked:true,err:e.message}));
  });
}
(async()=>{
  const targets=[
    {label:'cine-caos-svc', host:process.env.CINE_API_CIP, port:80},
    {label:'cine-caos-pod', host:process.env.CINE_API_POD, port:8080},
    {label:'cloudsql-proxy-like', host:process.env.CINE_API_POD, port:5432},
    {label:'oci-collector-ip', host:'129.146.0.1', port:4318}
  ];
  const out=[];
  for (const t of targets){
    if(!t.host){ out.push({...t, skipped:true}); continue; }
    out.push(await probe(t.host,t.port,t.label));
  }
  console.log(JSON.stringify({probes:out}));
})();
`;

const startUtc = ts();
const dnsA = JSON.parse(execNode(ea, dnsCode));
const dnsB = JSON.parse(execNode(eb, dnsCode));
const dnsTcpA = JSON.parse(execNode(ea, dnsTcpCode));
const otlpA = JSON.parse(execNode(ea, otlpCode));
const otlpB = JSON.parse(execNode(eb, otlpCode));

// Wait up to ~45s for samples if needed
let samples = null;
for (let i = 0; i < 9; i++) {
  const body = execNode(
    rx,
    `fetch('http://127.0.0.1:4319/detector-samples').then(r=>r.text()).then(t=>console.log(t)).catch(e=>console.log(JSON.stringify({error:String(e)})))`,
  );
  try {
    samples = JSON.parse(body);
  } catch {
    samples = { raw: body };
  }
  const items = samples?.samples || samples?.items || [];
  const hasA = JSON.stringify(samples).includes('emitter-a') || JSON.stringify(samples).includes('"a"');
  const hasB = JSON.stringify(samples).includes('emitter-b') || JSON.stringify(samples).includes('"b"');
  if (Array.isArray(items) ? items.length > 0 : hasA || hasB || (samples?.count > 0)) {
    // continue checking for both instances if structure known
  }
  writeFileSync(`${ev}/detector-samples-attempt-${i}.json`, JSON.stringify({ utc: ts(), samples }, null, 2));
  const text = JSON.stringify(samples);
  if (text.includes('emitter-a') && text.includes('emitter-b')) break;
  if (samples?.byInstance?.['emitter-a'] && samples?.byInstance?.['emitter-b']) break;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
}

// Isolation: get cine-api CIP and a pod IP (read-only)
const cineSvc = kubectlJson(`-n cine-caos get svc cine-api -o json`);
const cinePods = kubectlJson(`-n cine-caos get pods -l app=cine-api -o json`);
const cineApiCip = cineSvc.spec.clusterIP;
const cineApiPod = cinePods.items[0]?.status?.podIP || '';

function execNodeEnv(pod, code, env) {
  const envExports = Object.entries(env)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');
  const b64 = Buffer.from(code, 'utf8').toString('base64');
  const wrapper = `${envExports} node -e "eval(Buffer.from('${b64}','base64').toString('utf8'))"`;
  return sh(`kubectl -n ${ns} exec ${pod} -- sh -c ${JSON.stringify(wrapper)}`);
}

const isolation = JSON.parse(
  execNodeEnv(ea, isolationCode, { CINE_API_CIP: cineApiCip, CINE_API_POD: cineApiPod }),
);

const devopsDeploy = kubectlJson(`-n cine-caos get deploy cine-api -o json`);
const devopsSvc = kubectlJson(`-n cine-caos get svc cine-api -o json`);
const lbIp = devopsSvc.status?.loadBalancer?.ingress?.[0]?.ip || null;

const report = {
  startUtc,
  endUtc: ts(),
  pods: { ea, eb, rx },
  dns: { emitterA: dnsA, emitterB: dnsB, nodeLocalDnsTcp: dnsTcpA },
  otlp: { emitterA: otlpA, emitterB: otlpB },
  samples,
  isolation,
  devops: {
    readyReplicas: devopsDeploy.status?.readyReplicas,
    availableReplicas: devopsDeploy.status?.availableReplicas,
    lbIp,
    type: devopsSvc.spec?.type,
  },
};

writeFileSync(`${ev}/verify-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
