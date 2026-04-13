require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        // The SDK doesn't always have listModels exposed easily.
        // Let's try to just test 1.5 Flash.
        console.log('--- TESTANDO GEMINI 1.5 FLASH ---');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent("Test");
        console.log('FLASH STATUS: OK ✅');
    } catch (e) {
        console.error('FLASH STATUS: ERRO ❌', e.message);
    }
}

listModels();
