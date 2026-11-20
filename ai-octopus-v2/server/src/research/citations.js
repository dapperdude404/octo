export function reviewCitations(text,{style='ieee'}={}){
 if(typeof text!=='string'||text.length>200000)throw new TypeError('Expected text up to 200,000 characters.');
 if(!['ieee','apa','general'].includes(style))throw new TypeError('Unknown citation style.');
 const heading=/^\s*(?:references|bibliography)\s*$/im.exec(text);
 const body=heading?text.slice(0,heading.index):text;
 const references=heading?text.slice(heading.index+heading[0].length):'';
 const used=[...body.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));
 const declared=[...references.matchAll(/^\s*\[(\d+)\]\s+(.+)$/gm)].map(m=>({number:Number(m[1]),entry:m[2]}));
 const usedSet=new Set(used),declaredSet=new Set(declared.map(r=>r.number));
 const missingReferences=[...usedSet].filter(n=>!declaredSet.has(n)).sort((a,b)=>a-b);
 const unusedReferences=[...declaredSet].filter(n=>!usedSet.has(n)).sort((a,b)=>a-b);
 const duplicateReferenceNumbers=[...declaredSet].filter(n=>declared.filter(r=>r.number===n).length>1);
 return {status:'LOCAL_STRUCTURE_ONLY',style,referenceSectionPresent:!!heading,citationCount:used.length,referenceCount:declared.length,missingReferences,unusedReferences,duplicateReferenceNumbers,sourceExistenceVerified:false,doiVerified:false,warnings:[...(heading?[]:['References section not detected.']),...missingReferences.map(n=>`Citation [${n}] has no matching numbered reference.`),...unusedReferences.map(n=>`Reference [${n}] is not cited in the body.`)],limitations:['IEEE-style numeric reference inventory only; APA citations are not verified.','Source titles, authors, DOI and publication metadata are not externally checked.']};
}
