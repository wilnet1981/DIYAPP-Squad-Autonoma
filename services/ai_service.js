const { Anthropic } = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Mistral } = require('@mistralai/mistralai');
const { loadSystemPrompt } = require('../utils/prompt_loader');

// Lazy Clients to avoid environment boot crashes
let clients = null;
function getClients() {
    if (clients) return clients;
    require('dotenv').config();
    clients = {
        anthropic: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
        openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
        genAI: new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy'),
        mistral: new Mistral({ apiKey: process.env.MISTRAL_API_KEY }),
        deepseek: new OpenAI({
            apiKey: process.env.DEEPSEEK_API_KEY,
            baseURL: 'https://api.deepseek.com'
        })
    };
    return clients;
}

const PRIORITY_LIST = ['deepseek', 'mistral', 'gemini', 'openai', 'claude'];

async function getSmartResponse({ role, roleFile, message, history = [] }) {
    const systemPromptOrigin = loadSystemPrompt(roleFile);
    const globalMandate = `
--- 
MANDATO DE EXECUÇÃO SÊNIOR (SQUAD INTEGRADA):
1. PROIBIÇÃO DE PLACEHOLDERS: Escreva código funcional.
2. PONTO DE ENTRADA OBRIGATÓRIO: Todo projeto DEVE conter um "index.html".
3. DESENVOLVIMENTO RECURSIVO (META): Trate o repositório DIYAPP com cuidado.
---
`;
    const systemPrompt = systemPromptOrigin + globalMandate;
    const { openai, deepseek, mistral, genAI, anthropic } = getClients();

    for (const provider of PRIORITY_LIST) {
        try {
            console.log(`[AI SERVICE] Tentando ${provider} para o papel ${role}...`);
            if (provider === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
                const res = await deepseek.chat.completions.create({
                    model: 'deepseek-chat',
                    messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }]
                });
                return { reply: res.choices[0].message.content, provider: 'deepseek' };
            }

            if (provider === 'openai' && process.env.OPENAI_API_KEY) {
                const res = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }]
                });
                return { reply: res.choices[0].message.content, provider: 'openai' };
            }

            if (provider === 'mistral' && process.env.MISTRAL_API_KEY) {
                const res = await mistral.chat.complete({
                    model: 'mistral-large-latest',
                    messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }]
                });
                return { reply: res.choices[0].message.content, provider: 'mistral' };
            }

            if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
                const fullPrompt = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${message}`;
                const result = await model.generateContent(fullPrompt);
                return { reply: result.response.text(), provider: 'gemini' };
            }

            if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) {
                const res = await anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [...history, { role: 'user', content: message }]
                });
                return { reply: res.content[0].text, provider: 'claude' };
            }
        } catch (e) {
            console.error(`[AI SERVICE] Falha em ${provider}:`, e.message);
        }
    }
    return { reply: '[ERRO] Nenhuma IA disponível.', provider: 'none' };
}

module.exports = { getSmartResponse };
