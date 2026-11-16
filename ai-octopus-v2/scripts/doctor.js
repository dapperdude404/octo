import 'dotenv/config';
const required = ['JWT_SECRET', 'DATABASE_URL'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment values: ${missing.join(', ')}. Copy .env.example to .env and edit it.`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters.');
  process.exit(1);
}
console.log('Environment looks structurally valid. Provider API keys are optional until you enable those services.');
