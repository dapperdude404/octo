import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewLocalSimilarity,turnitinAvailability} from '../src/research/similarity.js';
const sentence='The experiment evaluated five models using a reproducible held out test dataset.';
test('detects local duplicates without inventing plagiarism scores',()=>{
 const r=reviewLocalSimilarity(sentence+'\n'+sentence,[sentence]);
 assert.ok(r.matches.some(x=>x.type==='within_document_duplicate'));
 assert.ok(r.matches.some(x=>x.type==='exact_reference_match'));
 assert.equal(r.plagiarismPercentage,null);
 assert.equal(r.turnitinScan,false);
 assert.equal(r.externalDatabaseChecked,false);
});
test('does not claim access to Turnitin',()=>{
 const r=turnitinAvailability();
 assert.equal(r.scanAvailable,false);
 assert.equal(r.score,null);
});
test('rejects excessive reference uploads',()=>{
 assert.throws(()=>reviewLocalSimilarity('a',Array(21).fill('b')),TypeError);
});
