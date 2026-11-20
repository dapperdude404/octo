import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from './config.js';
import { prisma } from './db.js';
import { signToken } from './auth.js';

export const oauthRouter=Router();
const FRONTEND=new URL(env.APP_ORIGIN);
const BASE=new URL(env.PUBLIC_API_URL);
const providers={
 google:{id:env.GOOGLE_CLIENT_ID,secret:env.GOOGLE_CLIENT_SECRET,auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'openid email profile'},
 github:{id:env.GITHUB_CLIENT_ID,secret:env.GITHUB_CLIENT_SECRET,auth:'https://github.com/login/oauth/authorize',token:'https://github.com/login/oauth/access_token',scope:'read:user user:email'}
};
const hash=s=>createHash('sha256').update(s).digest('hex');
const callback=p=>new URL('/api/auth/oauth/'+p+'/callback',BASE).toString();
function allowed(p){return ['google','github'].includes(p)&&Boolean(providers[p].id&&providers[p].secret);}
function redirect(res,error){const url=new URL(FRONTEND);url.hash='octo_oauth_error='+encodeURIComponent(error);res.redirect(303,url.toString());}
async function requestJSON(url,options={}){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);try{
 const response=await fetch(url,{...options,signal:controller.signal,headers:{Accept:'application/json',...(options.headers||{})}});
 if(!response.ok)throw Error('Provider request failed');
 return await response.json();
}finally{clearTimeout(timeout);}}
export function validProviderProfile(p,data){if(!data||!data.id||!data.email||!data.emailVerified)throw Error('A verified email address is required.');return {provider:p,providerUserId:String(data.id),email:String(data.email).trim().toLowerCase(),displayName:String(data.name||'').slice(0,80)||null};}
oauthRouter.get('/oauth/status',(_req,res)=>res.json({google:allowed('google'),github:allowed('github')}));
oauthRouter.get('/oauth/:provider/start',(req,res)=>{
 const p=req.params.provider;if(!allowed(p))return res.status(503).json({error:'This sign-in provider is not configured.'});
 if(BASE.protocol!=='https:'&&env.NODE_ENV==='production')return res.status(503).json({error:'HTTPS backend required.'});
 const nonce=randomBytes(24).toString('hex');
 const state=jwt.sign({provider:p,nonce},env.JWT_SECRET,{expiresIn:'5m',issuer:'octo-oauth'});
 res.cookie('octo_oauth_state',state,{httpOnly:true,secure:BASE.protocol==='https:',sameSite:'lax',path:'/api/auth/oauth',maxAge:300000});
 const u=new URL(providers[p].auth);u.searchParams.set('client_id',providers[p].id);u.searchParams.set('redirect_uri',callback(p));u.searchParams.set('response_type','code');u.searchParams.set('scope',providers[p].scope);u.searchParams.set('state',nonce);
 if(p==='google')u.searchParams.set('access_type','online');
 res.redirect(302,u.toString());
});
oauthRouter.get('/oauth/:provider/callback',async(req,res)=>{
 const p=req.params.provider;const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('octo_oauth_state='));
 res.clearCookie('octo_oauth_state',{path:'/api/auth/oauth',sameSite:'lax',secure:BASE.protocol==='https:'});
 try{
  if(!allowed(p)||typeof req.query.code!=='string'||typeof req.query.state!=='string'||!cookie)throw Error('Invalid OAuth response');
  const payload=jwt.verify(decodeURIComponent(cookie.split('=').slice(1).join('=')),env.JWT_SECRET,{issuer:'octo-oauth'});
  if(payload.provider!==p||payload.nonce!==req.query.state)throw Error('OAuth state mismatch');
  const params=new URLSearchParams({client_id:providers[p].id,client_secret:providers[p].secret,code:req.query.code,redirect_uri:callback(p),grant_type:'authorization_code'});
  const token=await requestJSON(providers[p].token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params});
  if(!token.access_token)throw Error('Missing access token');
  let profile;
  if(p==='google'){
   const g=await requestJSON('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token}});
   profile=validProviderProfile(p,{id:g.sub,email:g.email,emailVerified:g.email_verified,name:g.name});
  }else{
   const headers={Authorization:'Bearer '+token.access_token,'User-Agent':'octo-ai-oauth'};
   const [g,emails]=await Promise.all([requestJSON('https://api.github.com/user',{headers}),requestJSON('https://api.github.com/user/emails',{headers})]);
   const email=Array.isArray(emails)?emails.find(x=>x.primary&&x.verified)||emails.find(x=>x.verified):null;
   profile=validProviderProfile(p,{id:g.id,email:email?.email,emailVerified:email?.verified,name:g.name||g.login});
  }
  let account=await prisma.oAuthAccount.findUnique({where:{provider_providerUserId:{provider:p,providerUserId:profile.providerUserId}},include:{user:true}});
  let user=account?.user;
  if(!user){
   const existing=await prisma.user.findUnique({where:{email:profile.email}});
   if(existing)return redirect(res,'account_exists'); // Never silently link identities by matching email.
   user=await prisma.user.create({data:{email:profile.email,displayName:profile.displayName,oauthAccounts:{create:{provider:p,providerUserId:profile.providerUserId}}}});
  }
  const code=randomBytes(32).toString('base64url');
  await prisma.oAuthTicket.create({data:{codeHash:hash(code),userId:user.id,expiresAt:new Date(Date.now()+60000)}});
  const url=new URL(FRONTEND);url.hash='octo_oauth_code='+encodeURIComponent(code);
  res.set('Cache-Control','no-store');res.redirect(303,url.toString());
 }catch{redirect(res,'oauth_failed');}
});
oauthRouter.post('/oauth/exchange',async(req,res,next)=>{
 try{
  const code=req.body?.code;
  if(typeof code!=='string'||code.length<32||code.length>128)return res.status(400).json({error:'Invalid sign-in code.'});
  const ticket=await prisma.oAuthTicket.findUnique({where:{codeHash:hash(code)}});
  if(!ticket||ticket.expiresAt<=new Date())return res.status(401).json({error:'Sign-in code expired or already used.'});
  const consumed=await prisma.oAuthTicket.deleteMany({where:{id:ticket.id,codeHash:hash(code),expiresAt:{gt:new Date()}}});
  if(consumed.count!==1)return res.status(401).json({error:'Sign-in code already used.'});
  const user=await prisma.user.findUnique({where:{id:ticket.userId}});
  if(!user)return res.status(401).json({error:'Account no longer exists.'});
  res.set('Cache-Control','no-store');res.json({token:signToken(user),user:{id:user.id,email:user.email,displayName:user.displayName}});
 }catch(e){next(e);}
});
