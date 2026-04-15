const { Anthropic } = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Mistral } = require('@mistralai/mistralai');
const Groq = require('groq-sdk');
const { loadSystemPrompt } = require('../utils/prompt_loader');

// ── Prioridade de providers ────────────────────────────────
const PRIORITY_LIST = ['cloudflare', 'groq', 'mistral', 'deepseek', 'gemini', 'openai', 'anthropic'];

// ── Rate-limit tracker (em memória) ───────────────────────
// Estrutura: { [provider]: timestamp_bloqueio }
const rateLimitedAt = {};
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

function isBlocked(provider) {
    const blockedAt = rateLimitedAt[provider];
    if (!blockedAt) return false;
    if (Date.now() - blockedAt >= BLOCK_DURATION_MS) {
        delete rateLimitedAt[provider];
        console.log(`[AI SERVICE] ${provider} desbloqueado após 24h.`);
        return false;
    }
    const remainingMin = Math.ceil((BLOCK_DURATION_MS - (Date.now() - blockedAt)) / 60000);
    console.warn(`[AI SERVICE] ${provider} bloqueado por limite diário. Libera em ~${remainingMin} min.`);
    return true;
}

function isRateLimitError(e) {
    const msg = (e.message || '').toLowerCase();
    const status = e.status || e.statusCode || (e.response && e.response.status);
    return status === 429 || msg.includes('rate limit') || msg.includes('quota') || msg.includes('limit exceeded') || msg.includes('too many requests');
}

// ── Lazy clients ───────────────────────────────────────────
let clients = null;
function getClients() {
    if (clients) return clients;
    clients = {
        anthropic: process.env.ANTHROPIC_API_KEY
            ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null,
        openai: process.env.OPENAI_API_KEY
            ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null,
        gemini: process.env.GEMINI_API_KEY
            ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null,
        mistral: process.env.MISTRAL_API_KEY
            ? new Mistral({ apiKey: process.env.MISTRAL_API_KEY }) : null,
        deepseek: process.env.DEEPSEEK_API_KEY
            ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' }) : null,
        groq: process.env.GROQ_API_KEY
            ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null,
        // Cloudflare usa axios diretamente (sem SDK oficial universal)
        cloudflare: (process.env.CLOUDFLARE_API_KEY && process.env.CLOUDFLARE_ACCOUNT_ID) ? {
            apiKey: process.env.CLOUDFLARE_API_KEY,
            accountId: process.env.CLOUDFLARE_ACCOUNT_ID
        } : null,
    };
    return clients;
}

// ── Chamadas por provider ──────────────────────────────────
async function callProvider(provider, { systemPrompt, history, message }) {
    const c = getClients();

    if (provider === 'cloudflare' && c.cloudflare) {
        const axios = require('axios');
        const res = await axios.post(
            `https://api.cloudflare.com/client/v4/accounts/${c.cloudflare.accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
            { messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }] },
            { headers: { Authorization: `Bearer ${c.cloudflare.apiKey}` } }
        );
        return res.data.result.response;
    }

    if (provider === 'groq' && c.groq) {
        const res = await c.groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }]
        });
        return res.choices[0].message.content;
    }

    if (provider === 'mistral' && c.mistral) {
        const res = await c.mistral.chat.complete({
            model: 'mistral-large-latest',
            messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }]
        });
        return res.choices[0].message.content;
    }

    if (provider === 'deepseek' && c.deepseek) {
        const res = await c.deepseek.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }]
        });
        return res.choices[0].message.content;
    }

    if (provider === 'gemini' && c.gemini) {
        const model = c.gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        const fullPrompt = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${message}`;
        const result = await model.generateContent(fullPrompt);
        return result.response.text();
    }

    if (provider === 'openai' && c.openai) {
        const res = await c.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }]
        });
        return res.choices[0].message.content;
    }

    if (provider === 'anthropic' && c.anthropic) {
        const res = await c.anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [...history, { role: 'user', content: message }]
        });
        return res.content[0].text;
    }

    return null; // provider sem chave configurada
}

// ── Função principal ───────────────────────────────────────
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

    for (const provider of PRIORITY_LIST) {
        if (isBlocked(provider)) continue;

        try {
            console.log(`[AI SERVICE] Tentando ${provider} para o papel ${role}...`);
            const reply = await callProvider(provider, { systemPrompt, history, message });
            if (reply) {
                console.log(`[AI SERVICE] Resposta obtida via ${provider}.`);
                return { reply, provider };
            }
        } catch (e) {
            if (isRateLimitError(e)) {
                rateLimitedAt[provider] = Date.now();
                console.warn(`[AI SERVICE] ${provider} atingiu limite diário. Bloqueado por 24h.`);
            } else {
                console.error(`[AI SERVICE] Falha em ${provider}:`, e.message);
            }
        }
    }

    // ── Mock Mode: todos os providers falharam ou sem chaves ──
    console.warn('[AI SERVICE] Ativando Simulação Soberana (sem providers disponíveis).');
    const mockResponses = {
        'Product Manager': "Entendido. Como seu PM, registrei os detalhes e as referências anexadas. Para prosseguir com essa evolução, o que você espera alcançar como resultado final dessa mudança?",
        'Product Owner': "Especificações técnicas captadas. Já analisei os arquivos e estou pronto para disparar a Sprint. Confirma o início da codificação pela squad?",
        'Squad Leader': "Equipe notificada. Estamos analisando o impacto dessa melhoria no núcleo do sistema."
    };

    return {
        reply: mockResponses[role] || "Entendi sua solicitação. A Squad está analisando os detalhes para garantir a melhor implementação possível. Podemos prosseguir?",
        provider: 'mock'
    };
}

module.exports = { getSmartResponse };
