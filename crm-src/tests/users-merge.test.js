// v3.79: اليوزر ما كيتمسحش — دمج بالصفوف (_u/_del) + الدمج الموحد للوكلاء
function crm_row_key(row){ if(row&&typeof row==='object'&&row.id!==undefined)return 'i:'+String(row.id); if(row===null||typeof row!=='object')return 's:'+String(row); return 'j:'+JSON.stringify(row); }
function crm_merge_list(cur,inp,tCur,tIn){
  if(tIn>=tCur)return inp;
  const have=new Set(cur.map(crm_row_key));
  for(const r of inp){const k=crm_row_key(r);if(!have.has(k)){cur.push(r);have.add(k)}}
  return cur;
}
function usersMerge(cur,inp,nowms){ // نفس api.php v3.79
  const byId=new Map(cur.filter(u=>u&&u.id!==undefined).map(u=>[String(u.id),u]));
  for(let u of inp){ if(!u||u.id===undefined)continue;
    if(Number(u._u)>nowms)u={...u,_u:nowms};
    const id=String(u.id);
    if(!byId.has(id)){byId.set(id,u);continue}
    const cu=Number(byId.get(id)._u)||0, nu=Number(u._u)||0;
    if(nu>cu)byId.set(id,u);
  }
  return [...byId.values()];
}
const visible=list=>list.filter(u=>!u._del);
let pass=0,fail=0;const T=(n,c,x='')=>{c?(pass++,console.log(' ✓',n)):(fail++,console.log(' ✗ FAIL',n,x))};
const admin={id:1,username:'admin@paraveda.ma',role:'admin',_u:100};
const NOW=999999;

console.log('— اليوزر الجديد (المشكل لي كيطرا عندك) —');
console.log('1) جهاز ساعتها غالطة زادت يوزر: كيتسجل ديما');
{
  const cur=[admin];
  const out=usersMerge(cur,[admin,{id:99,username:'bent1',role:'user',_u:50}],NOW); // _u قديمة
  T('bent1 موجودة', visible(out).some(u=>u.id===99), JSON.stringify(visible(out)));
}
console.log('2) دفع قديم كامل بلا bent1 (أي t): ما كيمسحهاش');
{
  const cur=[admin,{id:99,username:'bent1',_u:50}];
  const out=usersMerge(cur,[admin],NOW);
  T('bent1 مازالة', visible(out).some(u=>u.id===99), JSON.stringify(visible(out)));
}
console.log('3) دفع بنسخة قديمة ديال bent1: الجديدة كتربح، بلا تكرار');
{
  const cur=[{id:99,username:'bent1-جديد',_u:800}];
  const out=usersMerge(cur,[{id:99,username:'bent1-قديم',_u:100}],NOW);
  T('وحدة برك', out.filter(u=>u.id===99).length===1);
  T('الاسم الجديد', out[0].username==='bent1-جديد');
}
console.log('4) حذف شرعي: tombstone أحدث كيربح');
{
  const cur=[admin,{id:99,username:'bent1',_u:100}];
  const out=usersMerge(cur,[admin,{id:99,username:'bent1',_del:1,_u:NOW}],NOW);
  T('bent1 ماحيدة من العرض', !visible(out).some(u=>u.id===99));
  T('مازال موجود كـ tombstone فالسيرفر (حماية)', out.some(u=>u.id===99&&u._del));
}
console.log('5) محاولة إحياء محذوف بنسخة قديمة: كتفشل');
{
  const cur=[admin,{id:99,username:'bent1',_del:1,_u:NOW}];
  const out=usersMerge(cur,[admin,{id:99,username:'bent1',_u:50}],NOW); // نسخة قديمة بلا _del
  T('ما رجعتش', !visible(out).some(u=>u.id===99), JSON.stringify(visible(out)));
}
console.log('6) ختم مستقبلي (ساعة متقدمة): كيتقص لوقت السيرفر');
{
  const cur=[admin];
  const out=usersMerge(cur,[admin,{id:100,username:'x',_u:NOW+86400000}],NOW);
  const u=out.find(x=>x.id===100);
  T('الختم مقصوص', Number(u._u)<=NOW);
}
console.log('— الوكلاء/المدن (الدمج الموحد v3.78) —');
{
  const out=crm_merge_list(['Meryam','imane'],['Meryam','AYA'],2000,1000);
  T('AYA تزادت بلا مسح', out.join(',')==='Meryam,imane,AYA', out.join(','));
  const out2=crm_merge_list([admin,{id:99,_u:1}],[admin],1000,3000);  // t أحدث = حذف شرعي
  T('حذف شرعي للوكلاء-كائنات كيربح (t أحدث)', out2.length===1);
}
console.log(`==== ${pass} passed, ${fail} failed ====`);
process.exit(fail?1:0);
