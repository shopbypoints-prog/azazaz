// v3.78: اليوزر ما كيتمسحش — crm_merge_list (نفس منطق api.php)
function crm_row_key(row){ if(row&&typeof row==='object'&&row.id!==undefined)return 'i:'+String(row.id); if(row===null||typeof row!=='object')return 's:'+String(row); return 'j:'+JSON.stringify(row); }
function crm_merge_list(cur,inp,tCur,tIn){
  if(tIn>=tCur)return inp;
  const have=new Set(cur.map(crm_row_key));
  for(const r of inp){const k=crm_row_key(r);if(!have.has(k)){cur.push(r);have.add(k)}}
  return cur;
}
let pass=0,fail=0;const T=(n,c,x='')=>{c?(pass++,console.log(' ✓',n)):(fail++,console.log(' ✗ FAIL',n,x))};
const admin={id:1,username:'admin@paraveda.ma',role:'admin'};

console.log('— سيناريو اليوزر المفقود —');
console.log('1) جهاز ساعته متأخرة زاد يوزر (t قديمة): كيتزاد وما كيمسح والو');
{
  const cur=[admin]; const tCur=2000;
  const push=[admin,{id:99,username:'bent1',role:'user',agent:'Meryam'}]; const tIn=1000; // أقدم
  const out=crm_merge_list(cur,push,tCur,tIn);
  T('اليوزر الجديد كيتزاد', out.some(u=>u.id===99));
  T('الأدمين باق', out.some(u=>u.id===1));
}
console.log('2) النسخة القديمة ناقصة يوزرين — ما كتمسحهمش من السيرفر');
{
  const cur=[admin,{id:99,username:'bent1'},{id:100,username:'bent2'}]; const tCur=2000;
  const push=[admin]; const tIn=1000; // قديمة
  const out=crm_merge_list(cur,push,tCur,tIn);
  T('bent1 و bent2 باقين', out.some(u=>u.id===99)&&out.some(u=>u.id===100), JSON.stringify(out.map(u=>u.id)));
}
console.log('3) حذف شرعي (t أحدث بلا اليوزر) → كيتحيد');
{
  const cur=[admin,{id:99,username:'bent1'}]; const tCur=1000;
  const push=[admin]; const tIn=3000; // أحدث
  const out=crm_merge_list(cur,push,tCur,tIn);
  T('bent1 تحيدت (حذف شرعي)', !out.some(u=>u.id===99), JSON.stringify(out.map(u=>u.id)));
  T('الأدمين باق', out.some(u=>u.id===1));
}
console.log('4) جوج أجهزة زادو فنفس الوقت → بجوج كيدوزو');
{
  let cur=[admin]; const t0=1000;
  cur=crm_merge_list(cur,[admin,{id:99,username:'A'}],t0,900);
  cur=crm_merge_list(cur,[admin,{id:100,username:'B'}],1000,950);
  T('A و B بجوج', cur.some(u=>u.id===99)&&cur.some(u=>u.id===100));
}
console.log('5) نفس الـ id بمحتوى قديم → ما كاين تكرار وما كاين رجوع للخلف');
{
  const cur=[admin,{id:99,username:'bent1-جديد'}]; const tCur=2000;
  const push=[admin,{id:99,username:'bent1-قديم'}]; const tIn=1000;
  const out=crm_merge_list(cur,push,tCur,tIn);
  T('بلا تكرار', out.filter(u=>u.id===99).length===1, JSON.stringify(out));
  T('الجديد باق', out.find(u=>u.id===99).username==='bent1-جديد');
}
console.log('6) وكلاء (strings) — نفس الدمج');
{
  const cur=['Meryam','imane']; const tCur=2000;
  const out=crm_merge_list(cur,['Meryam','AYA'],tCur,1000);
  T('AYA تزادت والموجودين باقين', out.join(',')==='Meryam,imane,AYA', out.join(','));
}
console.log(`==== ${pass} passed, ${fail} failed ====`);
process.exit(fail?1:0);
