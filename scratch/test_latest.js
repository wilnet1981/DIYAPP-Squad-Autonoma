require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        console.log('--- TESTANDO GEMINI 1.5 PRO LATEST ---');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
        const result = await model.generateContent("Test");
        console.log('PRO LATEST STATUS: OK ✅');
    } catch (e) {
        console.error('PRO LATEST STATUS: ERRO ❌', e.message);
    }
}

listModels();
