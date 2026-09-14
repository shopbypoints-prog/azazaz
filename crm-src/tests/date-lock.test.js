// ==== 1:1 port of the PATCHED server merge (api.php v3.66) ====
const DATE_FIELDS = ['dateCreation','dateConfirmation','dateExp','dateLiv'];
function crm_merge_row(a, b) {
  const ua = a._u ?? 0, ub = b._u ?? 0;
  let base = ub >= ua ? b : a, oth = ub >= ua ? a : b;
  if (base._del || oth._del) return base;
  const bf = (base._f && typeof base._f==='object') ? base._f : {};
  const of = (oth._f && typeof oth._f==='object') ? oth._f : {};
  Object.keys(of).forEach(k=>{const to=Number(of[k])||0,tb=Number(bf[k])||0;
    if(to>tb && k in oth && String(oth[k]??"")!==String(base[k]??"")){base[k]=oth[k];bf[k]=to}});
  if (Object.keys(bf).length) base._f = bf;
  // v3.66 date lock
  for (const dk of DATE_FIELDS) {
    if (!(dk in a)) continue;
    const av = String(a[dk]); const bv = dk in b ? String(b[dk]) : '';
    if (av === bv) continue;
    const ta = Number(a._f?.[dk]) || 0, tb = Number(b._f?.[dk]) || 0;
    if (tb <= ta) { base[dk] = av; if (ta>0) base._f = {...(base._f||{}), [dk]: ta}; }
  }
  return base;
}
function crm_merge_orders(cur, inp, reset=0, nowms=Date.now(), audit=[]) {
  const byId = new Map(); const order = [];
  for (const o of cur) { if (!o || o.id===undefined) continue; byId.set(String(o.id), o); order.push(String(o.id)); }
  for (let o of inp) {
    if (!o || o.id===undefined) continue;
    if (Number(o._u) > nowms) o = {...o, _u: nowms};
    if (o._f && typeof o._f==='object'){ const f={...o._f}; for(const k in f){ if(Number(f[k])>nowms) f[k]=nowms; } o={...o,_f:f}; }
    const id = String(o.id);
    const before = byId.has(id) ? String(byId.get(id).dateCreation ?? '') : '';
    if (!byId.has(id)) {
      const u = Number(o._u)||0;
      if (reset>0 && u<reset) continue;
      byId.set(id, o); order.push(id); continue;
    }
    const merged = crm_merge_row(byId.get(id), o);
    byId.set(id, merged);
    const after = String(merged.dateCreation ?? '');
    if (before !== '' && after !== before) audit.push(`date-change id=${id}: ${before} -> ${after}`);
  }
  return [...new Set(order)].map(id=>byId.get(id)).sort((x,y)=>(Number(y.id)||0)-(Number(x.id)||0));
}

// ==== 1:1 port of the PATCHED client helpers ====
function __pvStampDates(o,now){const f={...(o._f||{})};DATE_FIELDS.forEach(q=>{o[q]&&(f[q]=now)});return{...o,_f:f}}
function __pvMergeRow(a,b){
  const ua=Number(a._u)||0,ub=Number(b._u)||0;let base=ub>ua?b:a,oth=ub>ua?a:b;
  if(base._del||oth._del)return base;
  const bf=base._f||{},of=oth._f||{};let out=base,ch=!1;
  Object.keys(of).forEach(k=>{const to=Number(of[k])||0,tb=Number(bf[k])||0;
    if(to>tb&&k in oth&&String(oth[k]??"")!==String(base[k]??"")){ch||(out={...base,_f:{...bf}},ch=!0);out[k]=oth[k];out._f[k]=to}});
  __pvDateFieldsLock(a,b,()=>({get:()=>out,set:v=>out=v,chg:()=>{if(!ch){out={...base,_f:{...(base._f||{})}};ch=!0}}}),chRef=>{});
  return out;
}
// (simpler: replicate the exact patched client fn)
function clientMergeRow(a,b){
  const ua=Number(a._u)||0,ub=Number(b._u)||0;let base=ub>ua?b:a,oth=ub>ua?a:b;
  if(base._del||oth._del)return base;
  const bf=base._f||{},of=oth._f||{};let out=base,ch=!1;
  Object.keys(of).forEach(k=>{const to=Number(of[k])||0,tb=Number(bf[k])||0;
    if(to>tb&&k in oth&&String(oth[k]??"")!==String(base[k]??"")){ch||(out={...base,_f:{...bf}},ch=!0);out[k]=oth[k];out._f[k]=to}});
  DATE_FIELDS.forEach(k=>{if(k in a&&k in b&&String(a[k]??"")!==String(b[k]??"")){
    const ta=Number((a._f||{})[k])||0,tb=Number((b._f||{})[k])||0;
    if(!(tb>ta)){ch||(out={...base,_f:{...(base._f||{})}},ch=!0);out[k]=a[k];ta>0&&(out._f[k]=ta)}}});
  return out;
}
// Ms(qu) patched callback core: merge incoming into local state
function msMerge(T, D){ if(JSON.stringify(T)===JSON.stringify(D)) return T;
  const map=new Map(D.map(o=>[String(o.id),o]));
  const out=T.map(o=>{const inc=map.get(String(o.id));return inc?clientMergeRow(o,inc):o});
  const ids=new Set(T.map(o=>String(o.id)));
  D.forEach(o=>{ids.has(String(o.id))||out.push(o)});
  out.sort((x,y)=>(Number(y.id)||0)-(Number(x.id)||0));
  return out;
}

// ================= TESTS =================
let pass=0, fail=0;
function T(name, cond, extra=''){ cond? (pass++, console.log('  ✓', name)) : (fail++, console.log('  ✗ FAIL', name, extra)); }
const NOW = 1789500000000; // fixed "server now"
const D_SEP='2026-09-14', D_AUG='2026-08-01';

console.log('1) عدل الأدمين التاريخ لـ 01/08 — متصفح قديم كيدفع نسخة قديمة كاملة (بلا أختام): التاريخ خاصو يبقى 01/08');
{
  const stored = {id:100, dateCreation:D_AUG, statut:'Confirmé', _u:NOW-86400000, _f:{dateCreation:NOW-86400000}};
  const stalePush = {id:100, dateCreation:D_SEP, statut:'Confirmé', _u:NOW-1000}; // no _f, newer _u
  const out = crm_merge_orders([stored],[stalePush],0,NOW);
  T('date stays 2026-08-01', out[0].dateCreation===D_AUG, out[0].dateCreation);
}

console.log('2) السطرين بلا أختام (legacy) — الدفع القديم ما يقدرش يحرك التاريخ');
{
  const stored = {id:101, dateCreation:D_AUG, _u:NOW-900000};          // no _f
  const incoming = {id:101, dateCreation:D_SEP, _u:NOW-1000};          // no _f, newer
  const out = crm_merge_orders([stored],[incoming],0,NOW);
  T('date stays stored 2026-08-01', out[0].dateCreation===D_AUG, out[0].dateCreation);
}

console.log('3) تعديل شرعي جديد (ختم أحدث) كيبدل التاريخ عادي');
{
  const stored = {id:102, dateCreation:D_AUG, _u:NOW-900000, _f:{dateCreation:NOW-900000}};
  const edit = {id:102, dateCreation:'2026-09-20', _u:NOW-1000, _f:{dateCreation:NOW-1000}};
  const out = crm_merge_orders([stored],[edit],0,NOW);
  T('date becomes 2026-09-20', out[0].dateCreation==='2026-09-20', out[0].dateCreation);
}

console.log('4a) نسخة قديمة (stamps قديمة) من جهاز ساعته متقدمة — ما كتغلبش');
{
  const stored = {id:103, dateCreation:D_AUG, _u:NOW-900000, _f:{dateCreation:NOW-900000}};
  const staleSkewed = {id:103, dateCreation:D_SEP, _u:NOW-2*86400000, _f:{dateCreation:NOW-2*86400000}}; // edit 2 days old
  const out = crm_merge_orders([stored],[staleSkewed],0,NOW);
  T('date stays 2026-08-01', out[0].dateCreation===D_AUG, out[0].dateCreation);
}
console.log('4b) ختم مستقبلي (ساعة متقدمة) ما يقدرش يظل يغلب التعديلات الشرعية بعدها — clamp');
{
  // skewed device set date to Sep14 with a FUTURE stamp; admin later REALLY edits back to Aug1
  const cur = [{id:103, dateCreation:D_SEP, _u:NOW, _f:{dateCreation:NOW+2*86400000}}]; // arrives with future stamp
  const mergedOnce = crm_merge_orders([cur[0]], [cur[0]], 0, NOW); // clamp at write time
  T('future stamp clamped to server now', Number(mergedOnce[0]._f.dateCreation)<=NOW, String(mergedOnce[0]._f.dateCreation));
  const adminEdit = {id:103, dateCreation:D_AUG, _u:NOW+3600000, _f:{dateCreation:NOW+3600000}}; // 1h later, genuine
  const out = crm_merge_orders(mergedOnce, [adminEdit], 0, NOW+3600000);
  T('genuine later edit wins: 2026-08-01', out[0].dateCreation===D_AUG, out[0].dateCreation);
}

console.log('5) استرجاع باكاب (ختم جديد) كيرجع تاريخ قديم 05/07 — كيربح الأختام القديمة');
{
  const stored = {id:104, dateCreation:D_SEP, _u:NOW-900000, _f:{dateCreation:NOW-900000}};
  const restored = __pvStampDates({id:104, dateCreation:'2026-07-05'}, NOW-500);
  const out = crm_merge_orders([stored],[restored],0,NOW);
  T('date becomes 2026-07-05', out[0].dateCreation==='2026-07-05', out[0].dateCreation);
}

console.log('6) سيناريو React race: state فيه تعديل طاز (01/08 + statut أحدث)، pull جاي بقيم قديمة — التعديل ما كيضيعش');
{
  const localEdited = {id:105, dateCreation:D_AUG, statut:'Confirmé', _u:NOW-2000, _f:{dateCreation:NOW-2000, statut:NOW-2000}};
  const incomingFromLS = {id:105, dateCreation:D_SEP, statut:'Rappel', _u:NOW-60000, _f:{dateCreation:NOW-60000, statut:NOW-60000}};
  const out = msMerge([localEdited],[incomingFromLS]);
  T('date stays 01/08', out[0].dateCreation===D_AUG, out[0].dateCreation);
  T('statut keeps locally newer edit (Confirmé)', out[0].statut==='Confirmé', out[0].statut);
}

console.log('7) صف جديد من جهاز آخر كيتزاد فالحالة (merge callback)');
{
  const T_local=[{id:1,dateCreation:D_AUG,_u:1}];
  const D_in=[{id:1,dateCreation:D_AUG,_u:1},{id:2,dateCreation:D_SEP,_u:NOW-100}];
  const out = msMerge(T_local,D_in);
  T('new row id=2 added', out.length===2 && out[0].id===2);
}

console.log('8) طلبية جديدة (add) كتاخد ختم تاريخ من ولادتها');
{
  const v = {dateCreation:D_SEP, nom:'test'};
  const stamped = __pvStampDates(v, NOW);
  T('_f.dateCreation stamped at creation', Number(stamped._f.dateCreation)===NOW);
  T('row without dateConfirmation gets no stamp for it', !('dateConfirmation' in stamped._f));
}

console.log('9) audit: تبديل تاريخ عبر ختم أحدث كيتسجل');
{
  const stored = {id:106, dateCreation:D_AUG, _u:NOW-900000, _f:{dateCreation:NOW-900000}};
  const edit = {id:106, dateCreation:'2026-09-20', _u:NOW-10, _f:{dateCreation:NOW-10}};
  const audit=[];
  crm_merge_orders([stored],[edit],0,NOW,audit);
  T('audit has date-change line', audit.length===1 && /date-change/.test(audit[0]), JSON.stringify(audit));
}

console.log('10) مسح (_del) بقا خدام بحال قبل');
{
  const stored = {id:107, dateCreation:D_AUG, _u:NOW-900000};
  const del = {id:107, dateCreation:D_AUG, _del:1, _u:NOW-10};
  const out = crm_merge_orders([stored],[del],0,NOW);
  T('row deleted', out[0]._del===1);
}

console.log('11) عمود dateConfirmation محمي حتى هو');
{
  const stored = {id:108, dateCreation:D_AUG, dateConfirmation:D_AUG, _u:NOW-900000, _f:{dateCreation:NOW-900000,dateConfirmation:NOW-900000}};
  const stale = {id:108, dateCreation:D_AUG, dateConfirmation:D_SEP, _u:NOW-10}; // no _f
  const out = crm_merge_orders([stored],[stale],0,NOW);
  T('dateConfirmation stays', out[0].dateConfirmation===D_AUG, out[0].dateConfirmation);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail?1:0);
