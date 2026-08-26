import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env
const findEnvFile = (): string => {
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
        const envPath = path.join(dir, '.env');
        if (fs.existsSync(envPath)) return envPath;
        dir = path.dirname(dir);
    }
    return path.resolve(process.cwd(), '.env');
};
dotenv.config({ path: findEnvFile() });

const { GoogleGenAI } = require('@google/genai');

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('\n=== GEMINI API DIAGNOSTIC ===');
    console.log(`API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : '❌ TIDAK ADA!'}`);
    console.log(`API Key Length: ${apiKey?.length || 0} karakter`);

    if (!apiKey) {
        console.error('\n❌ GEMINI_API_KEY tidak ditemukan di .env!');
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Test berbagai nama model
    const modelsToTest = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-pro',
    ];

    for (const modelName of modelsToTest) {
        process.stdout.write(`\nTesting model "${modelName}"... `);
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: 'Balas dengan kata "OK" saja.',
            });
            const text = response.text ?? '';
            console.log(`✅ BERHASIL! Respons: "${text.trim()}"`);
        } catch (err: any) {
            const status = err?.status || err?.statusCode || '?';
            const msg = err?.message?.split('\n')[0] || String(err);
            console.log(`❌ GAGAL (${status}): ${msg.substring(0, 120)}`);
        }
        // Tunggu 2 detik antar request
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n=== SELESAI ===');
    process.exit(0);
}

testGemini().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
