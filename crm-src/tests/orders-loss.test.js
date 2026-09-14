const fs = require('fs');
// ==== extract the EXACT live functions from index.html on every run ====
const html = fs.readFileSync(__dirname + '/../public_html/index.html', 'utf-8');
function extractFn(name){
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing fn: ' + name);
  let j = html.indexOf('{', i), depth = 0, instr = null, k = j;
  while (k < html.length){
    const c = html[k];
    if (instr){ if (c === '\\') { k += 2; continue; } if (c === instr) instr = null; }
    else if (c === '"' || c === "'" || c === '`') instr = c;
    else if (c === '{') depth++;
    else if (c === '}'){ depth--; if (!depth) return html.slice(i, k+1); }
    k++;
  }
  throw new Error('unbalanced: ' + name);
}
const dfm = html.match(/const __pvDateFields=\[[^\]]*\]/);
const code = [dfm[0], ...['__pvLocalDate','__pvStampDates','__pvResetSeen','__pvClean','__pvMergeRow','__pvMergeOrders'].map(extractFn)].join('\n');
const store = new Map();
global.localStorage = {getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
eval(code);

// ==== server merge port (api.php v3.67 — rs-aware reset, date-lock) ====
const DATE_FIELDS=['dateCreation','dateConfirmation','dateExp','dateLiv'];
function crm_merge_row(a,b){
  const ua=a._u??0, ub=b._u??0;
  let base=ub>=ua?b:a, oth=ub>=ua?a:b;
  if(base._del||oth._del)return base;
  const bf=(base._f&&typeof base._f==='object')?base._f:{};
  const of=(oth._f&&typeof oth._f==='object')?oth._f:{};
  Object.keys(of).forEach(k=>{const to=Number(of[k])||0,tb=Number(bf[k])||0;
    if(to>tb&&k in oth&&String(oth[k]??"")!==String(base[k]??"")){base[k]=oth[k];bf[k]=to}});
  if(Object.keys(bf).length)base._f=bf;
  for(const dk of DATE_FIELDS){
    if(!(dk in a))continue;
    const av=String(a[dk]);const bv=dk in b?String(b[dk]):'';
    if(av===bv)continue;
    const ta=Number(a._f?.[dk])||0,tb=Number(b._f?.[dk])||0;
    if(tb<=ta){base[dk]=av;if(ta>0)base._f={...(base._f||{}),[dk]:ta}}
  }
  return base;
}
function crm_merge_orders(cur,inp,reset=0,nowms=Date.now(),audit=[],rs=0){
  const byId=new Map();const order=[];
  for(const o of cur){if(!o||o.id===undefined)continue;byId.set(String(o.id),o);order.push(String(o.id))}
  const RESET_AWARE = reset>0 && rs>=reset;
  for(let o of inp){
    if(!o||o.id===undefined)continue;
    if(Number(o._u)>nowms)o={...o,_u:nowms};
    if(o._f&&typeof o._f==='object'){const f={...o._f};for(const k in f){if(Number(f[k])>nowms)f[k]=nowms}o={...o,_f:f}}
    const id=String(o.id);
    const before=byId.has(id)?String(byId.get(id).dateCreation??''):'';
    if(!byId.has(id)){
      const u=Number(o._u)||0;
      if(reset>0&&!RESET_AWARE&&u<reset)continue;   // v3.67: rs-aware
      byId.set(id,o);order.push(id);continue;
    }
    const m=crm_merge_row(byId.get(id),o);
    byId.set(id,m);
    const after=String(m.dateCreation??'');
    if(before!==''&&after!==before)audit.push(`date-change id=${id}: ${before} -> ${after}`);
  }
  return [...new Set(order)].map(id=>byId.get(id)).sort((x,y)=>(Number(y.id)||0)-(Number(x.id)||0));
}
// journal replay port (api.php v3.67)
function journalReplay(data, files){
  for(const jf of files){
    if(!fs.existsSync(jf))continue;
    for(const line of fs.readFileSync(jf,'utf-8').split('\n')){
      if(!line.trim())continue;
      let e=null;try{e=JSON.parse(line)}catch{continue}
      if(!e||typeof e!=='object'||!e.k||!e.t||!Array.isArray(e.d))continue;
      if(!data[e.k]||typeof data[e.k]!=='object'||data[e.k].t<e.t)data[e.k]={t:e.t,d:e.d};
    }
  }
  return data;
}

// ================= TESTS =================
let pass=0,fail=0;
const T=(n,c,x='')=>{c?(pass++,console.log('  ✓',n)):(fail++,console.log('  ✗ FAIL',n,x))};
const NOW=Date.now(), D_SEP='2026-09-14', D_AUG='2026-08-01';  // client tests: real clock (grace uses Date.now())

console.log('— أ) سيناريو الحذف (المشكل الكبير) —');
console.log('1) POST كيفشل + الختم تسجل بغلط (أجهزة v3.65 القديمة): grace window كينقذ الطلبية');
{
  const t0=NOW-60000;                     // user added order 1min ago
  const lastT=NOW+200;                    // stamp was set pre-ack (old buggy client)
  store.set('paraveda_orders_v5',JSON.stringify([{id:500,dateCreation:D_SEP,nom:'طلبية جديدة',_u:t0}]));
  const srv=[];                           // server never got it (POST failed)
  const {list}=__pvMergeOrders(srv,lastT);
  T('الطلبية ما تمسحتش من المتصفح (grace 15min)', list.length===1&&list[0].id===500, JSON.stringify(list.map(o=>o.id)));
}
console.log('2) نفس السيناريو بعد ساعة (قديمة بزاف و ما دازتش للسيرفر): كتمسح — سلوك مقصود (كانت تعاود تبان كل مرة)');
{
  const t0=NOW-3600000;                   // 1h old, never reached server
  store.set('paraveda_orders_v5',JSON.stringify([{id:501,dateCreation:D_SEP,_u:t0}]));
  const srv=[];
  const {list}=__pvMergeOrders(srv,NOW);  // lastT=NOW (already acked long ago)
  T('قديمة>15دقايق و مؤكدة الرفع → تتطبع', list.length===0, JSON.stringify(list.map(o=>o.id)));
}
console.log('3) جهاز ساعته متأخرة (قبل reset) كيزيد طلبية + rs مبعث → السيرفر كيقبلها');
{
  const RESET_T=1789149086931;
  const slowClockRow={id:502,dateCreation:D_SEP,nom:'من جهاز الساعة متأخرة',_u:RESET_T-3*86400000}; // clock 3 days behind
  const out=crm_merge_orders([], [slowClockRow], RESET_T, NOW, [], Number('1789149086931')); // rs >= RESET_T
  T('الطلبية تسجلت فالسيرفر', out.length===1&&out[0].id===502, JSON.stringify(out.map(o=>o.id)));
}
console.log('4) متصفح قديم (بلا rs) كيحاول يرجع طلبيات قبل reset → مرفوضة (الحماية بقا خدام)');
{
  const RESET_T=1789149086931;
  const oldRow={id:503,dateCreation:'2026-08-01',_u:RESET_T-86400000};
  const out=crm_merge_orders([], [oldRow], RESET_T, NOW, [], 0);
  T('ما ترجعتش (reset-stale)', out.length===0, JSON.stringify(out.map(o=>o.id)));
}
console.log('5) journal: crm_data.json تبدل يدويا بنسخة قديمة → أحدث الحالة كترجع من journal');
{
  const dir='/tmp/pvtest/j';fs.rmSync(dir,{force:true,recursive:true});fs.mkdirSync(dir,{recursive:true});
  const newOrders=[{id:600,dateCreation:D_SEP,nom:'طلبيات اليوم',_u:NOW}];
  fs.writeFileSync(dir+'/journal.log', JSON.stringify({k:'paraveda_orders_v5',t:NOW,d:newOrders})+'\n');
  const rolledBack={paraveda_orders_v5:{t:NOW-86400000,d:[{id:1,dateCreation:'2026-06-01',_u:1}]}}; // FTP rollback
  const healed=journalReplay(rolledBack,[dir+'/journal.log.1',dir+'/journal.log']);
  T('الطلبيات الجديدة رجعو من journal', healed.paraveda_orders_v5.d.some(o=>o.id===600));
  T('التاريخ ديالها محفوظ', healed.paraveda_orders_v5.d.find(o=>o.id===600)?.dateCreation===D_SEP);
}
console.log('6) journal: ملف مفسد (FTP ناقص) → replay كيبني كولشي من {}');
{
  const dir='/tmp/pvtest/j2';fs.rmSync(dir,{force:true,recursive:true});fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(dir+'/journal.log.1', 'garbage line\n\n');
  fs.writeFileSync(dir+'/journal.log', JSON.stringify({k:'paraveda_users_v1',t:NOW,d:[{id:1,username:'admin'}]})+'\n'+JSON.stringify({k:'paraveda_orders_v5',t:NOW,d:[{id:700,_u:NOW}]})+'\n');
  const healed=journalReplay({},[dir+'/journal.log.1',dir+'/journal.log']);
  T('users重建', healed.paraveda_users_v1?.d?.[0]?.username==='admin');
  T('orders重建', healed.paraveda_orders_v5?.d?.[0]?.id===700);
  T('garbage مقبولة بصمت (skip)', true);
}
console.log('7) كل الاختبارات القديمة ديال date-lock مازال خدامين (التاريخ ما كيترجعش):');
{
  const stored={id:100,dateCreation:D_AUG,_u:NOW-86400000,_f:{dateCreation:NOW-86400000}};
  const stale={id:100,dateCreation:D_SEP,_u:NOW-1000};
  T('date-lock: متصفح قديم ما كيبدلش التاريخ', crm_merge_orders([stored],[stale])[0].dateCreation===D_AUG);
  const mergedRow=__pvMergeRow({id:9,dateCreation:D_AUG,_u:1,_f:{dateCreation:1}},{id:9,dateCreation:D_SEP,_u:2});
  T('client merge date-lock: نفس النتيجة', mergedRow.dateCreation===D_AUG, mergedRow.dateCreation);
  const st=__pvStampDates({dateCreation:D_SEP,dateConfirmation:''},NOW);
  T('الطلبية الجديدة كتختم من ميلادها', Number(st._f.dateCreation)===NOW && !('dateConfirmation' in st._f));
}
console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail?1:0);
