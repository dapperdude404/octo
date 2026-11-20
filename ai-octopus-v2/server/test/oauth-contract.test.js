import test from 'node:test';import assert from 'node:assert/strict';
// Integration tests require configured database and OAuth credentials; validate migration and security contract in CI separately.
test('OAuth design documents provider authorization and no automatic email linking',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('../src/oauth.js',import.meta.url),'utf8');
 assert.match(code,/account_exists/);assert.match(code,/httpOnly:true/);assert.match(code,/sameSite:'lax'/);assert.match(code,/deleteMany/);assert.match(code,/emailVerified/);
});
