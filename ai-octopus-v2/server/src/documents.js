import { Document, Packer, Paragraph, TextRun } from 'docx';
export function safeDocumentName(value='ai-octopus-document'){
  return String(value||'ai-octopus-document').replace(/[^A-Za-z0-9._-]/g,'-').replace(/^\.+/,'').slice(0,64)||'ai-octopus-document';
}
export async function makeDocx(text){
  const paragraphs=String(text).replace(/\r\n?/g,'\n').split('\n').map(line=>new Paragraph({children:[new TextRun(line)],spacing:{after:120}}));
  return Packer.toBuffer(new Document({creator:'AI Octopus Document Studio',title:'Exported writing',sections:[{properties:{},children:paragraphs}]}));
}
