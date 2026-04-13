require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testPro() {
    try {
        console.log('--- TESTANDO GEMINI PRO (LEGACY) ---');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent("Test");
        console.log('PRO STATUS: OK ✅');
        console.log('Output:', result.response.text());
    } catch (e) {
        console.error('PRO STATUS: ERRO ❌', e.message);
    }
}

testPro();
