import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Cari .env dari current working directory ke atas sampai ketemu
const findEnvFile = (): string => {
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
        const envPath = path.join(dir, '.env');
        if (fs.existsSync(envPath)) return envPath;
        dir = path.dirname(dir);
    }
    return path.resolve(process.cwd(), '.env');
};

const envPath = findEnvFile();
dotenv.config({ path: envPath });
console.log(`📄 Loaded .env from: ${envPath}`);
console.log(`🔑 GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Tersedia' : '❌ KOSONG - Cek .env kamu!'}`);

import express from 'express';
import { connectToWhatsApp } from './whatsapp/connection';

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Backend API running on port ${port}`);
  
  // Jalankan WhatsApp Bot
  connectToWhatsApp().catch(err => console.error("Error starting WhatsApp bot:", err));
});

