// Academic Research Studio V5: explainable local writing signals, not scientific fact checking.
export const ACADEMIC_CRITERIA = Object.freeze([
  {id:'expression',label:'Natural academic expression',max:20},
  {id:'accuracy',label:'Scientific accuracy',max:20},
  {id:'clarity',label:'Clarity and readability',max:15},
  {id:'organization',label:'Research organization',max:15},
  {id:'citations',label:'Citation quality',max:10},
  {id:'originality',label:'Originality of explanation',max:10},
  {id:'grammar',label:'Grammar',max:5},
  {id:'ieee',label:'IEEE formatting',max:5}
]);
const tokens=s=>String(s||'').match(/\b[\p{L}\p{N}][\p{L}\p{N}'-]*\b/gu)||[];
const sentences=s=>String(s||'').split(/[.!?]+(?:\s+|$)/).map(x=>x.trim()).filter(Boolean);
const clamp=(n,max)=>Math.max(0,Math.min(max,Math.round(n)));
export function assessAcademicDraft(input,{style='ieee'}={}){
  const text=String(input||'');
  const words=tokens(text),n=words.length;
  const paras=text.split(/\n\s*\n/).filter(x=>x.trim());
  const sents=sentences(text);
  const avg=sents.length?n/sents.length:0;
  const lower=words.map(x=>x.toLowerCase());
  const uniq=n?new Set(lower).size/n:0;
  const refs=(text.match(/\[\d+\]|\([^()]+,\s*\d{4}\)/g)||[]).length;
  const sections=(text.match(/^(?:abstract|introduction|method(?:s|ology)?|results|discussion|conclusion|references)\b/gim)||[]).length;
  const repeated=(text.match(/\b(?:in conclusion|it is important to note|delve into|in today's rapidly evolving)\b/gi)||[]).length;
  const long=sents.filter(s=>tokens(s).length>40).length;
  const score={
    expression:clamp(10+uniq*10-repeated*2,20),
    accuracy:0, // scientific accuracy cannot be inferred from prose alone
    clarity:clamp(15-long*3-Math.max(0,avg-25)*.3,15),
    organization:clamp(5+sections*2+Math.min(3,paras.length),15),
    citations:clamp(Math.min(refs,5)*2,10),
    originality:0, // originality requires verified comparison with source corpus
    grammar:0, // full grammar assessment requires a validated grammar engine
    ieee:style==='ieee'?clamp((/\babstract\b/i.test(text)?2:0)+(/\breferences\b/i.test(text)?2:0)+(/\[\d+\]/.test(text)?1:0),5):0
  };
  const criteria=ACADEMIC_CRITERIA.map(c=>{
    const evidence=c.id==='accuracy'||c.id==='originality'||c.id==='grammar'?'not_assessed':'heuristic';
    const note={
      expression:'Vocabulary variety and formulaic phrase signals; not a human-authorship judgment.',
      accuracy:'Requires checking scientific claims, calculations, datasets and cited evidence.',
      clarity:'Sentence-length indicators only; manually inspect readability.',
      organization:'Detects common section labels and paragraph separation.',
      citations:'Counts citation-like markers; does not verify reference existence or accuracy.',
      originality:'Requires authorized source comparison; no similarity percentage inferred.',
      grammar:'Requires a validated grammar checker; no grammar correctness claim made.',
      ieee:'Checks a few section markers only; not IEEE template compliance.'
    }[c.id];
    return {...c,score:score[c.id],evidence,note};
  });
  const assessed=criteria.filter(c=>c.evidence==='heuristic');
  const assessedMax=assessed.reduce((a,c)=>a+c.max,0);
  const observed=assessed.reduce((a,c)=>a+c.score,0);
  return {
    schemaVersion:'v5-alpha',
    style,wordCount:n,
    score:{observed,assessedMax,unassessedMax:100-assessedMax,totalOutOf100:null,complete:false},
    criteria,
    warnings:['This is a partial, explainable draft assessment, not a validated 100-point academic-quality grade.','Scientific accuracy, originality and grammar remain unassessed until evidence-based checks are available.']
  };
}
