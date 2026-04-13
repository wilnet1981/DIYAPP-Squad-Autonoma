const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_FILES = ['index.html', 'app.js', 'style.css', 'server.js'];
const DB_PATH = path.join(__dirname, '../data/local_db.json');

console.log('--- INICIANDO MONITOR DE IMPLANTAÇÃO REAL ---');
console.log('Alvo: Projetos DIYAPP e Arquivos Core do Sistema.');

const getHashes = () => {
    const hashes = {};
    ROOT_FILES.forEach(f => {
        const p = path.join(__dirname, '..', f);
        if (fs.existsSync(p)) {
            const content = fs.readFileSync(p);
            hashes[f] = crypto.createHash('md5').update(content).digest('hex');
        }
    });
    return hashes;
};

let previousHashes = getHashes();

setInterval(() => {
    const currentHashes = getHashes();
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const pending = db.list.filter(p => p.Status === 'AWAITING_APPROVAL' || p.Status === 'APPROVED_FOR_DEPLOY');

    // 1. Monitorar Arquivos Físicos
    ROOT_FILES.forEach(f => {
        if (previousHashes[f] !== currentHashes[f]) {
            console.log(`\x1b[32m[ALERTA DE DEPLOY] O arquivo ${f} foi modificado fisicamente!\x1b[0m`);
            previousHashes[f] = currentHashes[f];
        }
    });

    // 2. Monitorar Estados do DB
    if (pending.length > 0) {
        console.log(`[WATCHER] Status Atual: ${pending.map(p => p.Title + ' -> ' + p.Status).join(', ')}`);
    }

}, 10000); // Checagem a cada 10s
