// v3.70: الجديدة بلا تاريخ فوق + زر الرسائل يمين
const cmp=(x,y)=>(String(y.dateCreation||"")||"9999-99-99").localeCompare(String(x.dateCreation||"")||"9999-99-99")||(Number(y.id)||0)-(Number(x.id)||0);
const sortList=a=>a.filter(o=>!o._del).sort(cmp);
let pass=0,fail=0;
const T=(n,c,x='')=>{c?(pass++,console.log(' ✓',n)):(fail++,console.log(' ✗ FAIL',n,x))};
let rows=[{id:100,dateCreation:'2026-09-14'},{id:99,dateCreation:'2026-08-01'},{id:101,dateCreation:''}];
let out=sortList(rows);
T('الجديدة بلا تاريخ (jj/mm/aaaa) فوق', out[0].id===101);
rows[2].dateCreation='2026-08-01';
out=sortList(rows);
T('بعد اختيار 01/08: مشات تحت 14/09 وفوق 01/08 القديمة (أحدث إنشاء)', out.map(o=>o.id).join(',')==='100,101,99');
T('الأقدم تحتها بالتسلسل', out[2].id===99);
out=sortList([{id:5,dateCreation:''},{id:6,dateCreation:''}]);
T('جوج بلا تاريخ: الأحدث إنشاء فوق', out[0].id===6);
console.log(`==== ${pass} passed, ${fail} failed ====`);
process.exit(fail?1:0);
