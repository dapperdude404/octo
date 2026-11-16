import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { env } from './config.js';
import { prisma } from './db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from './auth.js';
import { ProviderError } from './errors.js';
import { scanGPTZero } from './providers/gptzero.js';
import { scanWinston, getWinstonScan } from './providers/winston.js';
import { submitCopyleaks, copyleaksWebhook } from './providers/copyleaks.js';
import { localAnalyze, improveClarity, grammarReview } from './analysis.js';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import {makeDocx,safeDocumentName} from './documents.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'", 'https:', 'http:'], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"] } } }));
app.use(cors({ origin: [env.APP_ORIGIN, 'capacitor://localhost', 'http://localhost', 'https://localhost'], credentials: false }));
app.use(express.json({ limit: '2mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' } });
const uploadLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ['.pdf', '.docx', '.txt'].includes(ext));
} });

const registerSchema = z.object({ email: z.string().email().max(254), password: z.string().min(10).max(128), displayName: z.string().trim().max(80).optional() });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) });
const scanSchema = z.object({ text: z.string().min(40).max(150000), title: z.string().trim().max(160).optional(), providers: z.array(z.enum(['gptzero','winston','copyleaks'])).min(1).max(3), kind: z.enum(['ai','plagiarism']).default('ai') });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'octo-ai-api', version: '2.5.0' }));
app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });
    const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(input.password), displayName: input.displayName || null } });
    res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (error) { next(error); }
});
app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    res.json({ token: signToken(user), user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (error) { next(error); }
});
app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try { const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, displayName: true, createdAt: true } }); res.json({ user }); }
  catch (error) { next(error); }
});

app.post('/api/documents/extract', uploadLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF, DOCX or TXT file.' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === '.pdf' && !req.file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) return res.status(415).json({ error: 'File contents do not match a PDF.' });
    if (ext === '.docx' && !req.file.buffer.subarray(0, 2).equals(Buffer.from('PK'))) return res.status(415).json({ error: 'File contents do not match a DOCX.' });
    let text = '';
    if (ext === '.txt') text = req.file.buffer.toString('utf8');
    if (ext === '.docx') text = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
    if (ext === '.pdf') text = (await pdfParse(req.file.buffer)).text;
    if (!text.trim()) return res.status(422).json({ error: 'No selectable text was found. Scanned PDFs need OCR before analysis.' });
    res.json({ filename: req.file.originalname, text: text.slice(0, 150000), truncated: text.length > 150000 });
  } catch (error) { next(error); }
});

const documentExportSchema = z.object({ text: z.string().min(1).max(150000), filename: z.string().max(70).optional() });
const exportLimiter = rateLimit({windowMs:60_000,limit:12,standardHeaders:'draft-8',legacyHeaders:false});
app.post('/api/documents/export/docx', exportLimiter, async (req,res,next)=>{
  try {
    const {text,filename}=documentExportSchema.parse(req.body);
    const buffer=await makeDocx(text);
    res.set('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition',`attachment; filename="${safeDocumentName(filename)}.docx"`);
    res.set('Cache-Control','no-store');
    res.send(buffer);
  }catch(error){next(error);}
});

app.post('/api/scans', requireAuth, async (req, res, next) => {
  try {
    const input = scanSchema.parse(req.body);
    if (input.kind === 'plagiarism' && input.providers.includes('gptzero')) return res.status(400).json({ error: 'GPTZero is an AI detector, not a plagiarism checker. Choose Winston and/or Copyleaks for plagiarism.' });
    const wordCount = (input.text.match(/\b[\p{L}\p{N}'’-]+\b/gu) || []).length;
    const local = input.kind === 'ai' ? localAnalyze(input.text) : null;
    const tasks = input.providers.map(async provider => {
      try {
        let output;
        if (provider === 'gptzero') output = input.kind === 'ai' ? await scanGPTZero(input.text) : null;
        if (provider === 'winston') output = await scanWinston(input.text, input.kind);
        if (provider === 'copyleaks') output = await submitCopyleaks(input.text, input.kind, input.title || 'Octo AI scan');
        if (!output) throw new ProviderError(provider, 'This provider does not support this scan type.', 400);
        const scan = await prisma.scan.create({ data: {
          userId: req.userId, provider, kind: input.kind, status: output.status, title: input.title || null,
          wordCount, providerId: output.providerId || null, result: output.result ?? null, rawResult: output.raw ?? null
        } });
        return { id: scan.id, provider, status: scan.status, providerId: scan.providerId, result: output.result };
      } catch (error) {
        const message = error instanceof ProviderError ? error.message : 'Provider request failed.';
        const scan = await prisma.scan.create({ data: { userId: req.userId, provider, kind: input.kind, status: 'error', title: input.title || null, wordCount, error: message } });
        return { id: scan.id, provider, status: 'error', error: message };
      }
    });
    const results = await Promise.all(tasks);
    res.status(201).json({ local, results, notice: 'Provider scores are independent outputs and must not be averaged into an authorship verdict.' });
  } catch (error) { next(error); }
});

app.get('/api/scans', requireAuth, async (req, res, next) => {
  try {
    const scans = await prisma.scan.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, provider: true, kind: true, status: true, title: true, wordCount: true, result: true, error: true, providerId: true, createdAt: true, updatedAt: true } });
    res.json({ scans });
  } catch (error) { next(error); }
});
app.get('/api/scans/:id', requireAuth, async (req, res, next) => {
  try {
    const scan = await prisma.scan.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!scan) return res.status(404).json({ error: 'Scan not found.' });
    if (scan.provider === 'winston' && scan.status === 'queued' && scan.providerId) {
      try {
        const fresh = await getWinstonScan(scan.providerId);
        const status = fresh.status === 'completed' || fresh.status === 'complete' ? 'completed' : fresh.status || scan.status;
        const updated = await prisma.scan.update({ where: { id: scan.id }, data: { status, result: fresh, rawResult: fresh } });
        return res.json({ scan: updated });
      } catch { /* retain last-known queued state */ }
    }
    res.json({ scan });
  } catch (error) { next(error); }
});

app.post('/api/editor/clarity', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 150000) : '';
  res.json({ text: improveClarity(text) });
});
app.post('/api/editor/analyze', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 150000) : '';
  res.json({ analysis: localAnalyze(text) });
});

app.post('/api/editor/grammar', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 150000) : '';
  res.json({ review: grammarReview(text) });
});

// Copyleaks calls this URL after the scan completes. Configure a public HTTPS URL and enable the webhook in .env.
app.post('/api/webhooks/copyleaks/:status', async (req, res, next) => {
  try {
    if (env.COPYLEAKS_WEBHOOK_ENABLED !== 'true' || !env.COPYLEAKS_WEBHOOK_SECRET) return res.status(404).json({ error: 'Webhook disabled.' });
    const supplied = typeof req.query.token === 'string' ? req.query.token : '';
    const expected = Buffer.from(env.COPYLEAKS_WEBHOOK_SECRET);
    const actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Webhook authentication failed.' });
    const { scanId, body } = await copyleaksWebhook(req.body || {});
    if (scanId) {
      const scan = await prisma.scan.findFirst({ where: { provider: 'copyleaks', providerId: scanId } });
      if (scan) await prisma.scan.update({ where: { id: scan.id }, data: { status: req.params.status === 'completed' ? 'completed' : req.params.status, rawResult: body, result: body } });
    }
    res.status(200).json({ received: true });
  } catch (error) { next(error); }
});

app.use('/assets', express.static(path.join(publicDir, 'assets'), { maxAge: '1h' }));
app.use(express.static(publicDir));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.message });
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? 'Unexpected server error.' : error.message || 'Request failed.' });
});

app.listen(env.PORT, () => console.log(`Octo AI API listening on http://localhost:${env.PORT}`));
