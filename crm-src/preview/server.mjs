// Paraveda CRM — preview server (faithful port of api.php v3.72 + recover.php)
// شغّل:  node preview/server.mjs 8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET = '8c907fc0f4ffe0b9775a6b7c3c0fc7700e5724c0d78343df';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, '..', 'public_html');
const DATA_DIR = path.join(HERE, 'data');
const DATA_FILE = DATA_DIR + '/crm_data.json';
const BACKUP_DIR = DATA_DIR + '/backups';
const AUDIT_FILE = DATA_DIR + '/audit.log';
const JOURNAL = DATA_DIR + '/journal.log';
const DATE_FIELDS = ['dateCreation','dateConfirmation','dateExp','dateLiv'];
const ALLOWED = new Set(['paraveda_users_v1','paraveda_orders_v5','paraveda_agent_names_v1','paraveda_chat_v1',
 'paraveda_worktimes_v1','paraveda_remarques_v1','paraveda_avances_v1','paraveda_adspend_v1',
 'paraveda_perfrows_v1','paraveda_livraison_v1','paraveda_history_v1','paraveda_villes_v2',
 'paraveda_catalog_v1','sheet_pièce','paraveda_team_photos_v1','tabs_list_v1',
 'custom_sheets_v1','paraveda_period_v1','paraveda_period_v2',
 'paraveda_backup_v1','paraveda_backup_v1_agents']);

const audit = (l) => fs.appendFileSync(AUDIT_FILE, new Date().toISOString().slice(0,19).replace('T',' ') + ' | preview | ' + l + '\n');
const unwrap = (v) => { let g=0; while (v && typeof v==='object' && !Array.isArray(v) && typeof v.t==='number' && 'd' in v && Object.keys(v).length<=2 && g++<5) v=v.d; return v; };
function journalReplay(data){
  for (const jf of [JOURNAL+'.1', JOURNAL]) {
    if (!fs.existsSync(jf)) continue;
    for (const line of fs.readFileSync(jf,'utf-8').split('\n')) {
      if (!line.trim()) continue;
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (!e || !e.k || !e.t || typeof e.d!=='object') continue;
      if (!data[e.k] || typeof data[e.k]!=='object' || (data[e.k].t||0) < e.t) data[e.k] = {t:e.t, d:e.d};
    }
  }
  return data;
}
function readRaw(){ let j=null; try{ j=JSON.parse(fs.readFileSync(DATA_FILE,'utf-8')); }catch{} if(!j||typeof j!=='object') j={}; return journalReplay(j); }
function writeData(data){ fs.writeFileSync(DATA_FILE+'.tmp', JSON.stringify(data)); fs.renameSync(DATA_FILE+'.tmp', DATA_FILE); }
function backup(){
  if (!fs.existsSync(DATA_FILE)) return;
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR,{recursive:true});
  const n=Date.now();
  fs.copyFileSync(DATA_FILE, `${BACKUP_DIR}/b-${new Date(n).toISOString().replace(/[-:T]/g,'').slice(0,14)}-${String(n%1000).padStart(3,'0')}.json`);
  const daily = `${BACKUP_DIR}/d-${new Date(n).toISOString().slice(0,10).replace(/-/g,'')}.json`;
  if (!fs.existsSync(daily)) fs.copyFileSync(DATA_FILE, daily);
  const bs=fs.readdirSync(BACKUP_DIR).filter(f=>f.startsWith('b-')).sort();
  while (bs.length>30) fs.unlinkSync(BACKUP_DIR+'/'+bs.shift());
}
function journalAppend(k,t,d){ fs.appendFileSync(JOURNAL, JSON.stringify({k,t,d})+'\n'); if (fs.statSync(JOURNAL).size>8*1024*1024) fs.unlinkSync(JOURNAL); }
function mergeRow(a,b){
  const ua=a._u??0, ub=b._u??0;
  let base=ub>=ua?b:a, oth=ub>=ua?a:b;
  if (base._del||oth._del) return base;
  const bf=(base._f&&typeof base._f==='object')?{...base._f}:{}, of=(oth._f&&typeof oth._f==='object')?oth._f:{};
  for (const k of Object.keys(of)){ const to=Number(of[k])||0, tb=Number(bf[k])||0;
    if (to>tb && k in oth && String(oth[k]??"")!==String(base[k]??"")) { base[k]=oth[k]; bf[k]=to; } }
  if (Object.keys(bf).length) base._f=bf;
  for (const dk of DATE_FIELDS){
    if (!(dk in a)) continue;
    const av=String(a[dk]); const bv=dk in b?String(b[dk]):'';
    if (av===bv) continue;
    const ta=Number(a._f?.[dk])||0, tb=Number(b._f?.[dk])||0;
    if (tb<=ta){ base[dk]=av; if (ta>0) base._f={...(base._f||{}),[dk]:ta}; }
  }
  return base;
}
function mergeOrders(cur,inp,reset,rs){
  const nowms=Date.now(); const byId=new Map(), order=[];
  for (const o of cur){ if(!o||o.id===undefined)continue; byId.set(String(o.id),o); order.push(String(o.id)); }
  const AWARE = reset>0 && rs>=reset; const changes=[];
  for (let o of inp){
    if (!o||o.id===undefined) continue;
    if (Number(o._u)>nowms) o={...o,_u:nowms};
    if (o._f&&typeof o._f==='object'){const f={...o._f};for(const k in f){if(Number(f[k])>nowms)f[k]=nowms}o={...o,_f:f};}
    const id=String(o.id);
    const before=byId.has(id)?String(byId.get(id).dateCreation??''):'';
    if (!byId.has(id)){ if (reset>0 && !AWARE && (Number(o._u)||0)<reset) continue; byId.set(id,o); order.push(id); continue; }
    const m=mergeRow(byId.get(id),o); byId.set(id,m);
    const after=String(m.dateCreation??'');
    if (before!==''&&after!==before) changes.push(`date-change | id=${id} | dateCreation: ${before} → ${after}`);
  }
  changes.forEach(audit);
  return [...new Set(order)].map(id=>byId.get(id)).sort((x,y)=>((Number(y.id)||0)-(Number(x.id)||0)));
}
function stats(orders){
  let total=0, byMonth={}, minD='', maxD='', lastU=0;
  for (const o of orders){ if(!o||o._del)continue; total++;
    const dc=String(o.dateCreation||'').slice(0,7); if(dc) byMonth[dc]=(byMonth[dc]||0)+1;
    const d10=String(o.dateCreation||'').slice(0,10); if(d10){ if(!minD||d10<minD)minD=d10; if(!maxD||d10>maxD)maxD=d10; }
    const u=Number(o._u)||0; if(u>lastU)lastU=u; }
  return {total, byMonth, minDate:minD, maxDate:maxD, lastActivity:lastU?new Date(lastU).toISOString().slice(0,16).replace('T',' '):''};
}
function missing(curOrders, srcOrders){
  const have=new Set(curOrders.filter(o=>o&&o.id!==undefined).map(o=>String(o.id)));
  const seen=new Set(); const out=[];
  for (const o of srcOrders){ if(!o||o.id===undefined)continue; const id=String(o.id);
    if(have.has(id)||seen.has(id)||o._del)continue; seen.add(id); out.push(o); }
  return out;
}
function restoreMissing(srcOrders, label){
  const data=readRaw(); const cur=Array.isArray(data.paraveda_orders_v5?.d)?data.paraveda_orders_v5.d:[];
  const add=missing(cur,srcOrders);
  const alive=cur.filter(o=>o&&!o._del).length;
  if (!add.length) return {added:0, total:alive};
  const now=Date.now(); let i=0;
  for (const o of add){ i++;
    const r={...o}; r._u=now+i;
    const f=(r._f&&typeof r._f==='object')?{...r._f}:{};
    for (const dk of DATE_FIELDS) if (r[dk]) f[dk]=now+i;
    if (Object.keys(f).length) r._f=f;
    delete r._d; cur.push(r);
  }
  cur.sort((x,y)=>((Number(y.id)||0)-(Number(x.id)||0)));
  data.paraveda_orders_v5={t:now,d:cur};
  writeData(data); journalAppend('paraveda_orders_v5',now,cur);
  audit(`restore-additive | ${label} | added=${add.length}`);
  return {added:add.length, total:cur.filter(o=>o&&!o._del).length};
}
const json=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-cache'});res.end(JSON.stringify(obj));};
const tokenOf=(req,url)=>req.headers['x-sync-token']||new URL(url,'http://x').searchParams.get('token')||'';
const bodyOf=(req)=>new Promise(r=>{let b='';req.on('data',c=>{b+=c;if(b.length>24*1024*1024)req.destroy()});req.on('end',()=>r(b));});

const server = http.createServer(async (req,res)=>{
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/api.php') {
    if (tokenOf(req,req.url) !== SECRET) return json(res,403,{ok:false,err:'token'});
    if (req.method === 'GET') {
      const data = readRaw();
      for (const k of Object.keys(data)) if (data[k]&&typeof data[k]==='object'&&'d' in data[k]) data[k]={...data[k],d:unwrap(data[k].d)};
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-cache'});
      return res.end(JSON.stringify(data));
    }
    if (req.method === 'POST') {
      const b = JSON.parse((await bodyOf(req))||'{}');
      if (b.action === 'ping') return json(res,200,{ok:true,v:'3.78'});
      const k0=String(b.key||''); const k=k0.startsWith('afrizon_')?'paraveda_'+k0.slice(8):k0;
      if (!ALLOWED.has(k)) { audit(`reject | key=${k}`); return json(res,400,{ok:false,err:'key-not-allowed'}); }
      let d = unwrap(b.d);
      let t = Number.isFinite(+b.t)&&b.t!==undefined ? Math.floor(+b.t) : Date.now();
      const now = Date.now(); if (t > now+60000) t = now;
      const cur0 = readRaw();
      const RESET_T = cur0.paraveda_reset_v1?.t ? +cur0.paraveda_reset_v1.t : 0;
      const RS = +b.rs || 0;
      const AWARE = RESET_T>0 && RS>=RESET_T;
      const RESET_KEYS=['paraveda_catalog_v1','sheet_pièce','paraveda_history_v1','paraveda_adspend_v1','paraveda_perfrows_v1','paraveda_backup_v1'];
      if (RESET_T>0 && !AWARE && RESET_KEYS.includes(k) && t<RESET_T) return json(res,200,{ok:true,noop:'reset-stale',reset:RESET_T});
      if (k==='paraveda_orders_v5' && RESET_T>0 && !AWARE && Array.isArray(d)) d=d.filter(o=>o&&Number(o._u||0)>=RESET_T);
      if (['paraveda_orders_v5','paraveda_users_v1','paraveda_villes_v2','paraveda_chat_v1','paraveda_catalog_v1','paraveda_backup_v1','paraveda_backup_v1_agents'].includes(k) && Array.isArray(d) && d.length===0) {
        const cd=cur0[k]?.d; if (Array.isArray(cd)&&cd.length) { audit(`ghost | key=${k} | empty write blocked`); return json(res,200,{ok:true,noop:'ghost'}); }
      }
      const data = readRaw();
      const prevT = data[k]?.t ? +data[k].t : 0;
      const NOMERGE=new Set(['paraveda_orders_v5','paraveda_chat_v1','paraveda_users_v1','paraveda_agent_names_v1','paraveda_villes_v2','paraveda_worktimes_v1','paraveda_remarques_v1','paraveda_avances_v1','paraveda_adspend_v1','paraveda_perfrows_v1','paraveda_livraison_v1','paraveda_history_v1','paraveda_catalog_v1','tabs_list_v1','sheet_pièce']);
      if (t < prevT && !NOMERGE.has(k)) { audit(`stale | key=${k}`); return json(res,200,{ok:true,noop:'stale',t:prevT}); }
      const prevJson=JSON.stringify(data[k]?.d??null), newJson=JSON.stringify(d);
      if (prevJson===newJson) { data[k]={...(data[k]||{}),t}; writeData(data); return json(res,200,{ok:true,noop:'same'}); }
      backup();
      if (k==='paraveda_orders_v5' && Array.isArray(d) && Array.isArray(data[k]?.d)) d = mergeOrders(data[k].d, d, RESET_T, RS);
      if (k==='paraveda_chat_v1' && Array.isArray(d) && Array.isArray(data[k]?.d)) {
        const byId=new Map(data[k].d.filter(m=>m&&m.id!==undefined).map(m=>[String(m.id),m]));
        for (const m of d){ if(!m||m.id===undefined)continue; const id0=String(m.id);
          if (byId.has(id0)) byId.get(id0).read = !!(byId.get(id0).read||m.read); else byId.set(id0,m); }
        d = [...byId.values()].sort((a,b)=>(Number(a.id)||0)-(Number(b.id)||0));
      }
      // v3.78: دمج موحد — اليوزرز/الوكلاء/المدن/غيرهم
      if (NOMERGE.has(k) && k!=='paraveda_orders_v5' && k!=='paraveda_chat_v1' && Array.isArray(d) && Array.isArray(data[k]?.d)) {
        const rowKey=r=>{ if(r&&typeof r==='object'&&r.id!==undefined)return 'i:'+String(r.id); if(r===null||typeof r!=='object')return 's:'+String(r); return 'j:'+JSON.stringify(r); };
        if (t >= prevT) d = d;
        else { const have=new Set(data[k].d.map(rowKey)); for (const r of d){ const kk=rowKey(r); if(!have.has(kk)){ data[k].d.push(r); have.add(kk); } } d = data[k].d; }
      }
      data[k]={t,d};
      writeData(data); journalAppend(k,t,d);
      audit(`write | ${k} | t=${t} | bytes=${newJson.length}`);
      return json(res,200,{ok:true});
    }
    return json(res,405,{ok:false,err:'method-not-allowed'});
  }
  if (p === '/recover.php') {
    if (tokenOf(req,req.url) !== SECRET) {
      res.writeHead(403,{'Content-Type':'text/html; charset=utf-8'});
      return res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding:40px">🔒 زيد ?token=...</body></html>');
    }
    if (req.method==='GET' && u.searchParams.get('download')) {
      const f=path.basename(u.searchParams.get('download'));
      if (!/^[bd]-[\w.-]+\.json$/.test(f)) return json(res,400,{ok:false,err:'bad-name'});
      const fp=BACKUP_DIR+'/'+f;
      if (!fs.existsSync(fp)) return json(res,404,{ok:false,err:'not-found'});
      res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':`attachment; filename="${f}"`});
      return res.end(fs.readFileSync(fp));
    }
    if (req.method==='POST') {
      const b = JSON.parse((await bodyOf(req))||'{}');
      if (b.action==='stats') {
        const data=readRaw();
        const cur=Array.isArray(data.paraveda_orders_v5?.d)?data.paraveda_orders_v5.d:[];
        const backups=[];
        if (fs.existsSync(BACKUP_DIR)) {
          const files=fs.readdirSync(BACKUP_DIR).filter(f=>/^[bd]-/.test(f)).sort().reverse().slice(0,40);
          for (const f of files) {
            let o=[]; try{ const j=JSON.parse(fs.readFileSync(BACKUP_DIR+'/'+f,'utf-8')); o=Array.isArray(j.paraveda_orders_v5?.d)?j.paraveda_orders_v5.d:[]; }catch{}
            const st=stats(o);
            backups.push({file:f, orders:st.total, range:(st.minDate&&st.maxDate)?`${st.minDate} → ${st.maxDate}`:'', mtime:fs.statSync(BACKUP_DIR+'/'+f).mtime.toISOString().slice(0,16).replace('T',' '), size:fs.statSync(BACKUP_DIR+'/'+f).size});
          }
        }
        return json(res,200,{ok:true, stats:stats(cur), backups, primary:'preview-data'});
      }
      if (b.action==='restore' && b.file) {
        const f=path.basename(String(b.file));
        if (!/^[bd]-[\w.-]+\.json$/.test(f)) return json(res,400,{ok:false,err:'bad-name'});
        const fp=BACKUP_DIR+'/'+f;
        if (!fs.existsSync(fp)) return json(res,404,{ok:false,err:'not-found'});
        let src=[]; try{ const j=JSON.parse(fs.readFileSync(fp,'utf-8')); src=Array.isArray(j.paraveda_orders_v5?.d)?j.paraveda_orders_v5.d:[]; }catch{}
        return json(res,200,{ok:true, ...restoreMissing(src,'backup:'+f)});
      }
      if (b.action==='device-push' && Array.isArray(b.orders)) return json(res,200,{ok:true, ...restoreMissing(b.orders,'device')});
      return json(res,400,{ok:false,err:'unknown-action'});
    }
    const src = fs.readFileSync(PUB+'/recover.php','utf-8');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    return res.end(src.slice(src.indexOf('?>')+2));
  }
  if (p.startsWith('/download/')) {
    const f = path.basename(p);
    const zp = path.join(HERE, '..', '..', f);
    if (!f.endsWith('.zip') || !fs.existsSync(zp)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {'Content-Type':'application/zip', 'Content-Disposition':`attachment; filename="${f}"`, 'Content-Length': fs.statSync(zp).size});
    return res.end(fs.readFileSync(zp));
  }
  if (p === '/') p = '/index.html';
  if (p === '/import.php') {
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    return res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding:40px">هاد الصفحة ديال الهوست فقط — فالمعاينة البيانات كاينة ديجا ✅</body></html>');
  }
  const fp = path.join(PUB, path.normalize(p).replace(/^(\.\.[/\\])+/,''));
  if (!fp.startsWith(PUB) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) { res.writeHead(404); return res.end('not found'); }
  const ext=path.extname(fp).toLowerCase();
  const mime={'.html':'text/html; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json'}[ext]||'text/plain; charset=utf-8';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache'});
  res.end(fs.readFileSync(fp));
});
const PORT = +(process.argv[2]||8080);
server.listen(PORT,'0.0.0.0',()=>console.log('Paraveda preview on http://0.0.0.0:'+PORT));
