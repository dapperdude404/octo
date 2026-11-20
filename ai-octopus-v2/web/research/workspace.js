import {suggestAcademicEdits,applyAcademicDecisions} from './engine/revisions.js';
import {assessAcademicDraft} from './engine/quality.js';
import {reviewCitations} from './engine/citations.js';
const $=id=>document.getElementById(id);
let snapshot=null,decisions={};
const message=s=>$('status').textContent=s;
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function render(){
 const list=$('suggestions');list.replaceChildren();
 if(!snapshot){list.append(el('p','No suggestions yet. Enter text and select Generate suggestions.'));return;}
 $('revised').value=applyAcademicDecisions(snapshot.source,snapshot.suggestions,decisions);
 const accepted=Object.values(decisions).filter(x=>x==='accept').length;
 $('decision-count').textContent=`${accepted} accepted · ${snapshot.suggestions.length-Object.keys(decisions).length} pending · ${Object.values(decisions).filter(x=>x==='reject').length} rejected`;
 if(!snapshot.suggestions.length)list.append(el('p','No supported wording patterns found. This does not imply the manuscript is error-free.'));
 for(const s of snapshot.suggestions){
  const article=el('article',undefined,'suggestion');
  const title=el('h3',`Suggestion ${s.id} — ${decisions[s.id]||'pending'}`);
  const original=el('blockquote',`Original: ${s.original}`);
  const replacement=el('blockquote',`Proposed: ${s.replacement||'(remove phrase)'}`);
  const reason=el('p',s.reason);
  const actions=el('div',undefined,'actions');
  for(const [choice,label] of [['accept','Accept'],['reject','Reject'],['pending','Restore pending']]){
   const button=el('button',label,choice==='accept'?'':'secondary');button.type='button';
   button.setAttribute('aria-label',`${label} suggestion ${s.id}`);
   button.setAttribute('aria-pressed',String((decisions[s.id]||'pending')===choice));
   button.onclick=()=>{if(choice==='pending')delete decisions[s.id];else decisions[s.id]=choice;render();message(`Suggestion ${s.id}: ${choice}.`);};
   actions.append(button);
  }
  article.append(title,original,replacement,reason,actions);list.append(article);
 }
}
function renderEvidence(){
 const box=$('evidence');box.replaceChildren();
 const quality=assessAcademicDraft(snapshot.source,{style:snapshot.style});
 const citations=reviewCitations(snapshot.source,{style:snapshot.style});
 const data=[
  ['Partial quality signals',`${quality.score.observed} / ${quality.score.assessedMax} assessed heuristic points. ${quality.score.unassessedMax} points unassessed; no total grade.`],
  ['Reference inventory',`${citations.citationCount} numbered citations; ${citations.referenceCount} numbered references. Structural check only.`],
  ['Missing references',citations.missingReferences.length?citations.missingReferences.map(n=>`[${n}]`).join(', '):'None detected by local parser.'],
  ['Unused references',citations.unusedReferences.length?citations.unusedReferences.map(n=>`[${n}]`).join(', '):'None detected by local parser.'],
  ['Duplicate reference numbers',citations.duplicateReferenceNumbers.length?citations.duplicateReferenceNumbers.join(', '):'None detected by local parser.']
 ];
 for(const [heading,description] of data){const a=el('article');a.append(el('strong',heading),el('p',description));box.append(a);}
}
$('source').addEventListener('input',()=>{
 $('source-count').textContent=`${$('source').value.length} characters`;
 if(snapshot){snapshot=null;decisions={};$('revised').value='';$('decision-count').textContent='Source changed; regenerate suggestions.';$('evidence').replaceChildren(el('p','Source changed; regenerate evidence review.'));render();message('Source changed. Previous suggestion offsets have been discarded.');}
});
$('analyze').onclick=()=>{
 try{snapshot=suggestAcademicEdits($('source').value,{style:$('style').value});decisions={};render();renderEvidence();message(`${snapshot.suggestions.length} local suggestions generated. Review each change.`);}
 catch(e){message(e.message);}
};
$('style').addEventListener('change',()=>{if(snapshot){snapshot=null;decisions={};$('revised').value='';$('evidence').replaceChildren(el('p','Writing preset changed; regenerate suggestions.'));render();message('Writing preset changed. Regenerate suggestions.');}});
$('restore').onclick=()=>{if(!snapshot){message('Generate suggestions first.');return;}decisions={};render();message('All decisions restored to pending. Original source preserved.');};
$('copy').onclick=async()=>{if(!snapshot){message('Generate suggestions first.');return;}try{await navigator.clipboard.writeText($('revised').value);message('Revised text copied.');}catch{message('Clipboard unavailable; select and copy revised text manually.');}};
