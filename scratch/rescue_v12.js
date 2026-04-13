const fs = require('fs');
const path = require('path');

function processFilesPure(projectId, text, projectTitle = '') {
    const fileRegex = /(?:\[FILE:\s*|```(?:html|javascript|css|js)?\s*\n?\s*\[?FILE:\s*)(.+?)\]?([\s\S]+?)(?:\[\/FILE\]|```)/g;
    let match;
    let count = 0;
    
    let isMeta = projectTitle.toUpperCase().includes('DIYAPP');
    let projectPath = path.join(__dirname, '../data/staging', projectId.toString());
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });

    while ((match = fileRegex.exec(text)) !== null) {
        let rawFileName = match[1].trim();
        rawFileName = rawFileName.replace(/\*|`|\[|\]/g, '');
        
        const filePath = path.join(projectPath, rawFileName);
        const content = match[2].trim();
        
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        
        fs.writeFileSync(filePath, content);
        console.log(`[SISTEMA] Arquivo resgatado: ${rawFileName} em ${projectPath}`);
        count++;
    }
    return count;
}

const doc10 = fs.readFileSync(path.join(__dirname, '../data/docs/10.md'), 'utf8');
processFilesPure(10, doc10, 'DIYAPP Evolution');
console.log('[FIM] Resgate concluído pelo motor da fábrica.');
