// v3.72: union-merge ديال الرسائل — الرسالة غير المصيفة ما كتضيعش + read كيربح
function chatUnion(loc, srv){
  const m=new Map(loc.map(x=>[x.id,x]));
  srv.forEach(x=>{const o=m.get(x.id);m.set(x.id,{...x,read:!!(x.read||(o&&o.read))})});
  return [...m.values()].sort((a,b)=>(Number(a.id)||0)-(Number(b.id)||0));
}
let pass=0,fail=0;const T=(n,c,x='')=>{c?(pass++,console.log(' ✓',n)):(fail++,console.log(' ✗ FAIL',n,x))};
// الجهاز A صيفط رسالة، الرفع كيفشل، جات رسالة من جهاز B فالسيرفر
const local=[{id:1,from:'a',text:'مرحبا',at:'2026-09-14T10:00',read:false},{id:2,from:'a',text:'رسالة غير مصيفة (فشل الرفع)',at:'2026-09-14T10:01',read:false}];
const server=[{id:1,from:'a',text:'مرحبا',at:'2026-09-14T10:00',read:true},{id:3,from:'b',text:'من جهاز آخر',at:'2026-09-14T10:02',read:false}];
const out=chatUnion(local,server);
T('3 رسائل كاملين موجودين', out.length===3, JSON.stringify(out.map(m=>m.id)));
T('الرسالة غير المصيفة رجعت', out.some(m=>m.id===2));
T('read:true كتربح', out.find(m=>m.id===1).read===true);
T('مرتبين بالـ id', out.map(m=>m.id).join(',')==='1,2,3');
console.log(`==== ${pass} passed, ${fail} failed ====`);
process.exit(fail?1:0);
