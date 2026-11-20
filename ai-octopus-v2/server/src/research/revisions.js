const PATTERNS=[{id:'wordiness-1',pattern:/\bin order to\b/gi,replacement:'to',reason:'Reduce wordiness without changing the purpose clause.'},{id:'wordiness-2',pattern:/\bdue to the fact that\b/gi,replacement:'because',reason:'Use a more direct causal expression.'},{id:'wordiness-3',pattern:/\bat this point in time\b/gi,replacement:'currently',reason:'Remove a redundant time expression.'},{id:'wordiness-4',pattern:/\ba large number of\b/gi,replacement:'many',reason:'Use a concise quantifier; verify nuance before accepting.'},{id:'wordiness-5',pattern:/\bit is important to note that\s*/gi,replacement:'',reason:'Remove an unnecessary introductory phrase.'}];
export function suggestAcademicEdits(source,{style='general'}={}){
 if(typeof source!=='string'||source.length>200000)throw new TypeError('Expected source text up to 200,000 characters.');
 if(!['general','ieee','apa'].includes(style))throw new TypeError('Unknown writing style.');
 const suggestions=[];
 for(const rule of PATTERNS)for(const match of source.matchAll(rule.pattern))suggestions.push({id:`${rule.id}-${match.index}`,start:match.index,end:match.index+match[0].length,original:match[0],replacement:rule.replacement,reason:rule.reason,status:'pending',style});
 suggestions.sort((a,b)=>a.start-b.start||a.end-b.end);
 return {source,style,suggestions,revised:source,method:'deterministic_local_suggestions',limitations:['Suggestions are not a scientific accuracy review.','Each change requires explicit acceptance.']};
}
export function applyAcademicDecisions(source,suggestions,decisions={}){
 if(typeof source!=='string'||!Array.isArray(suggestions)||!decisions||typeof decisions!=='object')throw new TypeError('Invalid revision input.');
 let cursor=0,output='';
 for(const s of [...suggestions].sort((a,b)=>a.start-b.start)){
  if(!Number.isSafeInteger(s.start)||!Number.isSafeInteger(s.end)||s.start<cursor||s.end>source.length||s.end<=s.start||source.slice(s.start,s.end)!==s.original)throw new Error('Invalid or stale suggestion span.');
  const choice=decisions[s.id]||'pending';
  if(!['pending','accept','reject'].includes(choice))throw new Error('Invalid suggestion decision.');
  output+=source.slice(cursor,s.start)+(choice==='accept'?s.replacement:s.original);
  cursor=s.end;
 }
 return output+source.slice(cursor);
}
