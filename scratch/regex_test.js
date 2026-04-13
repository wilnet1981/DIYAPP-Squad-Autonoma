/**
 * TESTE DE REGEX ISOLADO — Identifica o bug na expressão regular
 */

// Regex do orchestrator.js (EXATA)
const fileRegex = /(?:\[FILE:\s*|```(?:html|javascript|css|js)?\s*\n?\s*\[?FILE:\s*)(.+?)\]?([\s\S]+?)(?:\[\/FILE\]|```)/g;

// Resposta real vinda do DeepSeek
const testInput = `[FILE: style.css]
/* Regra para o botão #nav-docs */
#nav-docs {
    background-color: #10B981;
    color: #FFFFFF;
}
[/FILE]`;

console.log('=== TESTE DE REGEX ===\n');
console.log('Input:', JSON.stringify(testInput.substring(0, 100)));

let match;
while ((match = fileRegex.exec(testInput)) !== null) {
    console.log('\nMatch encontrado:');
    console.log('  Grupo 1 (filename):', JSON.stringify(match[1]));
    console.log('  Grupo 2 (content, primeiros 100):', JSON.stringify(match[2].substring(0, 100)));
}

// O problema: na regex, (.+?) captura "s" e depois \]? come "tyle.css]"
// Porque o \]? é opcional e (.+?) é lazy, ele para no PRIMEIRO caractere antes de "]"
// Solução: o nome do arquivo precisa capturar até o "]" de fechamento da tag

console.log('\n--- REGEX CORRIGIDA ---');
const fixedRegex = /\[FILE:\s*([^\]]+)\]([\s\S]+?)\[\/FILE\]/g;

while ((match = fixedRegex.exec(testInput)) !== null) {
    console.log('\nMatch encontrado:');
    console.log('  Grupo 1 (filename):', JSON.stringify(match[1].trim()));
    console.log('  Grupo 2 (content, primeiros 100):', JSON.stringify(match[2].trim().substring(0, 100)));
}

console.log('\n=== FIM ===');
