// v3.68: قائمة الطلبيات مرتبة بالتاريخ (متتابعة) — وبعد أي تعديل للتاريخ السطر يتحرك لبلاصتو
const cmp=(x,y)=>String(y.dateCreation||"").localeCompare(String(x.dateCreation||""))||(Number(y.id)||0)-(Number(x.id)||0);
const sortList=a=>a.filter(o=>!o._del).sort(cmp);
let pass=0,fail=0;
const T=(n,c,x='')=>{c?(pass++,console.log(' ✓',n)):(fail++,console.log(' ✗ FAIL',n,x))};
const rows=[
  {id:3,dateCreation:'2026-09-14'},{id:9,dateCreation:'2026-08-10'},
  {id:1,dateCreation:'2026-09-12'},{id:7,dateCreation:'2026-08-01'},{id:5,dateCreation:''}];
let out=sortList(rows);
T('الأحدث فوق', out[0].dateCreation==='2026-09-14');
T('متتابع تنازليا', out.slice(0,4).every((d,i,ar)=>i===0||ar[i-1].dateCreation>=d.dateCreation));
T('بلا تاريخ فاللخر', out[4].dateCreation==='');
mut=[{id:3,dateCreation:'2026-09-14'},{id:1,dateCreation:'2026-09-12'},{id:9,dateCreation:'2026-08-10'}];
mut[0].dateCreation='2026-09-10';
out=sortList(mut);
T('بعد تعديل التاريخ: السطر تحرك لبلاصتو', out[0].id===1&&out[1].id===3&&out[2].id===9);
T('المسحوب ما كيبانش', sortList([{id:2,_del:1},{id:4,dateCreation:'2026-09-13'}]).length===1);
console.log(`==== ${pass} passed, ${fail} failed ====`);
process.exit(fail?1:0);
