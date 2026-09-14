// v3.71: المسافات فالتكتيك الحي (upd) — بلا تنقية؛ التنقية غير فالإضافة/الاستيراد
const __pvClean=o=>{if(!o||typeof o!="object")return o;const r={...o};for(const k of ["produit","ville","nom","agent","telephone","adresse","idCmd"])if(typeof r[k]=="string")r[k]=r[k].replace(/\s+/g," ").trim();return r};
let pass=0,fail=0;const T=(n,c)=>{c?(pass++,console.log(' ✓',n)):(fail++,console.log(' ✗ FAIL',n))};
let row={adresse:''};
const upd=A=>{Object.assign(row,A)};  // بلا __pvClean
upd({adresse:'مراكش'});upd({adresse:'مراكش '});upd({adresse:'مراكش جليز '});upd({adresse:'مراكش جليز حي النخيل '});
T('الادريس كيتكتب مفصولا بالملايص', row.adresse==='مراكش جليز حي النخيل ');
T('add كينقي', __pvClean({nom:'  علي  الفاسي  '}).nom==='علي الفاسي');
console.log(`==== ${pass} passed, ${fail} failed ====`);
process.exit(fail?1:0);
