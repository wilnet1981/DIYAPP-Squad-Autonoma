require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGemini() {
    try {
        console.log('--- TESTANDO GEMINI 1.5 PRO ---');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const result = await model.generateContent("Olá Gemini, você está funcional?");
        console.log('Resposta:', result.response.text());
        console.log('STATUS: OK ✅');
    } catch (e) {
        console.error('STATUS: ERRO ❌');
        console.error('Mensagem:', e.message);
    }
}

testGemini();
