// Local plagiarism review is not a Turnitin scan and has no external corpus access.
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const split=s=>String(s||'').split(/(?<=[.!?])\s+|\n+/u).map(x=>x.trim()).filter(x=>x.length>=25);
export function reviewLocalSimilarity(text,referenceTexts=[]){
  if(typeof text!=='string'||!Array.isArray(referenceTexts)||referenceTexts.length>20)throw new TypeError('Expected text and up to 20 reference documents.');
  if(text.length>150000||referenceTexts.some(x=>typeof x!=='string'||x.length>150000))throw new RangeError('Document too large.');
  const refs=referenceTexts.map((content,index)=>({referenceIndex:index,passages:new Set(split(content).map(normalize))}));
  const seen=new Map(),matches=[];
  for(const passage of split(text)){
    const key=normalize(passage);
    const local=seen.get(key);
    if(local!==undefined)matches.push({type:'within_document_duplicate',passage,firstPassageIndex:local});
    else seen.set(key,seen.size);
    for(const ref of refs)if(ref.passages.has(key))matches.push({type:'exact_reference_match',passage,referenceIndex:ref.referenceIndex});
  }
  return {
    status:'LOCAL_ONLY',provider:'OCTO local duplicate review',checkedAt:new Date().toISOString(),
    externalDatabaseChecked:false,turnitinScan:false,plagiarismPercentage:null,
    matches,referenceCount:refs.length,
    limitations:['Exact normalized sentence matching only; paraphrases may not match.','No web, journal, student-paper, or Turnitin corpus queried.','Matches are review signals, not proof of plagiarism.']
  };
}
export function turnitinAvailability({authorized=false}={}){
  return {provider:'Turnitin',status:authorized?'INTEGRATION_REQUIRES_VERIFICATION':'NOT_CONFIGURED',scanAvailable:false,score:null,reason:'Official institutional or partner authorization and approved API integration are required.'};
}
