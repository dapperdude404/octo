const safe=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const div=(a,b)=>b===0?null:a/b;
export function validateConfusionMatrix(matrix,labels=null){
 if(!Array.isArray(matrix)||matrix.length<2||matrix.length>100||!matrix.every(r=>Array.isArray(r)&&r.length===matrix.length&&r.every(safe)))return {status:'INCONSISTENT',metrics:null,errors:['Expected a square 2–100 class confusion matrix with nonnegative safe integer counts.']};
 const n=matrix.length;
 if(labels!==null&&(!Array.isArray(labels)||labels.length!==n||labels.some(x=>typeof x!=='string')||new Set(labels).size!==n))return {status:'INCONSISTENT',metrics:null,errors:['Class labels must be unique strings matching the matrix dimensions.']};
 const total=matrix.flat().reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(total)||total===0)return {status:'MISSING',metrics:null,errors:['No valid evaluated observations.']};
 const perClass=matrix.map((row,i)=>{
  const tp=matrix[i][i],support=row.reduce((a,b)=>a+b,0),predicted=matrix.reduce((a,r)=>a+r[i],0);
  const precision=div(tp,predicted),recall=div(tp,support);
  const f1=precision===null||recall===null||precision+recall===0?null:2*precision*recall/(precision+recall);
  return {label:labels?.[i]??String(i),support,precision,recall,f1};
 });
 const macro=key=>{const values=perClass.map(x=>x[key]).filter(x=>x!==null);return values.length===n?values.reduce((a,b)=>a+b,0)/n:null;};
 const correct=matrix.reduce((a,row,i)=>a+row[i],0);
 return {status:'VERIFIED',provenance:'Recomputed from supplied confusion matrix; dataset provenance and model execution not independently verified.',observations:total,metrics:{accuracy:correct/total,macroPrecision:macro('precision'),macroRecall:macro('recall'),macroF1:macro('f1'),perClass},errors:[]};
}
