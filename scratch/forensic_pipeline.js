/**
 * FORENSIC PIPELINE TEST
 * Testa o fluxo COMPLETO: prompt → IA → regex → escrita de arquivo.
 * Identifica exatamente ONDE a cadeia quebra.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const aiService = require('../services/ai_service');
const path = require('path');
const fs = require('fs');

// Replica a regex exata do orchestrator.js
const fileRegex = /(?:\[FILE:\s*|```(?:html|javascript|css|js)?\s*\n?\s*\[?FILE:\s*)(.+?)\]?([\s\S]+?)(?:\[\/FILE\]|```)/g;

async function main() {
    console.log('=== FORENSIC PIPELINE: INÍCIO ===\n');

    // STEP 1: Load system prompt (same as ai_service does)
    const { loadSystemPrompt } = require('../utils/prompt_loader');
    const systemPrompt = loadSystemPrompt('dev_frontend_instruction.html');
    console.log(`[STEP 1] System prompt carregado: ${systemPrompt.length} caracteres`);
    
    // Check if the FORMAT OUTPUT section survived the cheerio extraction
    const hasFileFormat = systemPrompt.includes('[FILE:') || systemPrompt.includes('FORMATO DE SAÍDA');
    console.log(`[STEP 1] Contém instrução de formato [FILE:]? ${hasFileFormat ? '✅ SIM' : '❌ NÃO — AQUI ESTÁ O BUG!'}\n`);

    // STEP 2: Simulate the exact prompt the orchestrator sends
    const testMessage = `PROJETO: "DIYAPP — Teste Forense"
TAREFA ESPECÍFICA: Adicionar ao style.css na raiz uma regra que torne o botão #nav-docs com fundo verde (#10B981) e texto branco (#FFFFFF).

[AVISO DE ESTRUTURA]: Você está editando o SISTEMA CORE. 
Alvo: 'index.html' e 'style.css' na raiz. 
Exemplo de seletor: #nav-docs { background: green; color: white; }. 
NÃO use React.
Foque apenas na sua tarefa e retorne o código completo.`;

    console.log(`[STEP 2] Enviando prompt para a IA...\n`);

    try {
        const result = await aiService.getSmartResponse({
            role: 'Frontend',
            roleFile: 'dev_frontend_instruction.html',
            message: testMessage,
            history: []
        });

        console.log(`[STEP 3] Resposta recebida de: ${result.provider}`);
        console.log(`[STEP 3] Tamanho da resposta: ${result.reply.length} caracteres\n`);
        
        // Show first 1500 chars of the reply
        console.log(`--- RESPOSTA DA IA (primeiros 1500 chars) ---`);
        console.log(result.reply.substring(0, 1500));
        console.log(`--- FIM DA AMOSTRA ---\n`);

        // STEP 4: Test the regex
        console.log(`[STEP 4] Testando regex de extração de arquivos...`);
        let match;
        let fileCount = 0;
        const regexCopy = new RegExp(fileRegex.source, fileRegex.flags);
        
        while ((match = regexCopy.exec(result.reply)) !== null) {
            fileCount++;
            console.log(`  ✅ Arquivo detectado: "${match[1].trim()}"`);
            console.log(`     Conteúdo (primeiros 200 chars): ${match[2].trim().substring(0, 200)}`);
        }

        if (fileCount === 0) {
            console.log(`  ❌ ZERO ARQUIVOS DETECTADOS pela regex!`);
            console.log(`\n  [DIAGNÓSTICO] Procurando padrões na resposta...`);
            
            // Check for common patterns the AI might use instead
            const patterns = [
                { name: '```css', regex: /```css/g },
                { name: '```html', regex: /```html/g },
                { name: '```javascript', regex: /```javascript/g },
                { name: '[FILE:', regex: /\[FILE:/g },
                { name: '[/FILE]', regex: /\[\/FILE\]/g },
                { name: 'style.css', regex: /style\.css/g },
                { name: 'index.html', regex: /index\.html/g },
            ];

            patterns.forEach(p => {
                const matches = result.reply.match(p.regex);
                console.log(`    ${p.name}: ${matches ? matches.length + ' ocorrências' : 'NÃO encontrado'}`);
            });
        }

        console.log(`\n[RESULTADO FINAL] Arquivos extraídos: ${fileCount}`);
        if (fileCount === 0) {
            console.log(`\n⚠️  CAUSA RAIZ PROVÁVEL:`);
            console.log(`   A IA NÃO está usando o formato [FILE: nome] ... [/FILE] na resposta.`);
            console.log(`   Isso significa que a instrução de formato NÃO está chegando até o modelo.`);
            console.log(`   POSSÍVEL CULPADO: prompt_loader.js usa cheerio que REMOVE o conteúdo`);
            console.log(`   dentro de tags <code> onde o FORMATO DE SAÍDA foi adicionado.`);
        }

    } catch (e) {
        console.error(`[ERRO] Falha na chamada AI:`, e.message);
    }

    console.log('\n=== FORENSIC PIPELINE: FIM ===');
}

main();
