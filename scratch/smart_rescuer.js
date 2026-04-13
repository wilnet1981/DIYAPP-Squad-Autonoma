const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '../data/docs/10.md');
const content = fs.readFileSync(docPath, 'utf8');

// Regex para capturar o título do código e o bloco markdown seguinte
const regex = /#### \*\*Código: `(.+?)`[\s\S]*?```(?:html|javascript|js|css)?\n([\s\S]+?)```/g;

let match;
let foundCount = 0;

console.log('--- INICIANDO VARREDURA DE ALTA PRECISÃO NO RELATÓRIO V10 ---');

while ((match = regex.exec(content)) !== null) {
    const fileName = match[1].trim();
    const code = match[2].trim();
    
    // Criar caminho no staging
    const stagingPath = path.join(__dirname, '../data/staging/rescue_v12');
    if (!fs.existsSync(stagingPath)) fs.mkdirSync(stagingPath, { recursive: true });
    
    const filePath = path.join(stagingPath, path.basename(fileName));
    fs.writeFileSync(filePath, code);
    
    console.log(`[SUCESSO] Arquivo resgatado: ${fileName} -> ${filePath}`);
    foundCount++;
}

console.log(`--- VARREDURA CONCLUÍDA: ${foundCount} ARQUIVOS RECUPERADOS ---`);
