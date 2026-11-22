/** Transparent, rules-based writing utilities shared by the browser and Node API.
 * Do not market heuristic output as calibrated AI-authorship probabilities.
 */
const STOCK = ['delve','tapestry','landscape','realm','multifaceted','robust','seamless','leverage','utilize','utilise','paradigm','foster','moreover','furthermore','in conclusion','it is important to note','it is worth noting','in today’s world','plays a crucial role','a wide range of','at the end of the day','needless to say','in the ever-evolving','cutting-edge','game-changer','unlock the potential','shed light on','navigate the complexities','in summary','to sum up','first and foremost','not only that','serves as a testament','pivotal role','underscore','holistic approach','additionally','consequently','thus','hence','ultimately','in essence','delving into'];
const OPENERS = ['Moreover','Furthermore','Additionally','Consequently','In conclusion','In summary','Therefore','Thus'];
export const countWords = text => (String(text || '').match(/\b[\p{L}\p{N}_’'-]+\b/gu) || []).length;
export const getSentences = text => (String(text || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(s => s.trim()).filter(Boolean);
const clamp = (x,min,max) => Math.max(min,Math.min(max,x));

export function localAnalyze(text) {
  text = String(text || '');
  const W = countWords(text), sents = getSentences(text), S = sents.length;
  if (W < 40) return {available:false,wordCount:W,sentenceCount:S,note:'Enter at least 40 words for a meaningful surface-pattern estimate.'};
  const lower = text.toLocaleLowerCase('en');
  const hits = STOCK.filter(p => lower.includes(p));
  const dashCount = (text.match(/—/g) || []).length;
  const formalCount = sents.filter(s => OPENERS.some(o => new RegExp(`^${o}\\b`,'i').test(s))).length;
  const lens = sents.map(countWords), mean = W / (S || 1);
  const sd = Math.sqrt(lens.reduce((a,b) => a + (b-mean)**2,0)/(S||1));
  const cv = mean ? sd/mean : 0;
  const components = {
    stockPhrases:Math.min(45,900*hits.length/W),
    evenSentenceLength:S >= 4 ? 25*clamp((.55-cv)/.55,0,1) : 0,
    noContractions:W >= 60 && !/\b\w+['’](t|re|ve|ll|d|m|s)\b/i.test(text) ? 10 : 0,
    emDashes:Math.min(10,4*dashCount),
    formalOpeners:Math.min(10,4*formalCount)
  };
  const score = clamp(Math.round(Object.values(components).reduce((a,b)=>a+b,0)),0,100);
  const syllables = (text.replace(/[^\p{L}]/gu,' ').toLowerCase().match(/[aeiouy]+/g) || []).length;
  const readability = S && W ? 206.835 - 1.015*(W/S) - 84.6*(syllables/W) : null;
  return {available:true,score,wordCount:W,sentenceCount:S,readability:Number.isFinite(readability)?Math.round(readability):null,
    label:score<30?'Few selected surface patterns':score<60?'Mixed surface-pattern signals':'Several selected surface patterns',
    components,matches:hits,warning:'Rule-based surface-pattern score only; this is not a validated probability of AI authorship.'};
}
export function improveClarity(text) {
  let out = String(text || '');
  // Simple replacements only. Do not guess author identity or alter evidence.
  const replacements = [
    [/\butili[sz]e\b/gi,'use'],[/\bleverage\b/gi,'use'],[/\bin order to\b/gi,'to'],
    [/\bdue to the fact that\b/gi,'because'],[/\bat this point in time\b/gi,'now'],
    [/\bwith regard to\b/gi,'about'],[/\bin the event that\b/gi,'if'],
    [/\ba large number of\b/gi,'many'],[/\bhas the ability to\b/gi,'can']
  ];
  for (const [pattern,replacement] of replacements) out = out.replace(pattern,replacement);
  // When removing an introductory phrase at a sentence boundary, preserve
  // capitalization of the following word (e.g. ". It is important ... no" -> ". No").
  // Limit this to known phrases, rather than automatically rewriting acronyms,
  // equations, figure labels, DOI identifiers, or arbitrary sentence contents.
  out = out.replace(/\b(?:it is important to note that|it should be noted that)\s+([\p{L}])/giu,
    (matched, initial, offset, whole) => {
      const before = whole.slice(0, offset);
      const beginsSentence = /(?:^|[.!?][ \t]+|\n[ \t]*)$/u.test(before);
      return beginsSentence ? initial.toLocaleUpperCase('en') : initial;
    });
  return out.replace(/[ \t]+([,.;!?])/g,'$1').replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();
}
export function grammarReview(text){
  text=String(text || '');
  const issues=[];
  function push(type,match,detail,at){if(issues.length<25)issues.push({type,match:String(match).slice(0,70),detail,position:at});}
  const patterns=[
    {type:'Repeated word',pattern:/\b([\p{L}]+)[ \t]+\1\b/giu,detail:'The same word appears twice in a row.'},
    {type:'Spacing',pattern:/[ \t]+[,;!?]/g,detail:'Remove the space before this punctuation mark.'},
    {type:'Punctuation',pattern:/[!?]{2,}/g,detail:'Consider using one punctuation mark in formal writing.'},
    {type:'Capitalization',pattern:/\bi\b/g,detail:'Use a capital “I” when writing the first-person pronoun.'},
    {type:'Spacing',pattern:/[ \t]{2,}/g,detail:'Replace multiple consecutive spaces with one.'}
  ];
  for(const {type,pattern,detail} of patterns){for(const m of text.matchAll(pattern)){push(type,m[0],detail,m.index);if(issues.length>=25)break;}}
  const sentences=getSentences(text);
  for(const s of sentences){if(countWords(s)>39)push('Long sentence',s.slice(0,70)+'…','This sentence is long. Consider splitting it for clarity.',text.indexOf(s));}
  return {issueCount:issues.length,issues:issues.sort((a,b)=>a.position-b.position),wordCount:countWords(text),sentenceCount:sentences.length,
    note:'Selected mechanical and readability checks, not a comprehensive grammar engine.'};
}

/** Word-level LCS diff, deliberately capped so untrusted large input cannot freeze a phone. */
export function compareDrafts(before,after){
  const a=String(before||'').trim().split(/\s+/).filter(Boolean),b=String(after||'').trim().split(/\s+/).filter(Boolean);
  if(!a.length||!b.length)return {error:'Enter both your original text and your revised text.'};
  if(a.length>350||b.length>350)return {error:'For a quick comparison, keep each draft to 350 words or fewer.'};
  const n=a.length,m=b.length;
  const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
  let i=0,j=0,added=0,removed=0;const parts=[];
  while(i<n||j<m){
    if(i<n&&j<m&&a[i]===b[j]){parts.push({kind:'same',word:a[i]});i++;j++;}
    else if(j<m&&(i===n||dp[i][j+1]>=dp[i+1][j])){parts.push({kind:'added',word:b[j++]});added++;}
    else{parts.push({kind:'removed',word:a[i++]});removed++;}
  }
  return {added,removed,parts};
}
