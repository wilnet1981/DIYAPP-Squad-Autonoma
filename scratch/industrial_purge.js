const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/local_db.json');

if (!fs.existsSync(DB_PATH)) {
    console.error('DB não encontrado.');
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const originalCount = db.list.length;

// 1. Identificar e Filtrar Duplicatas de Projetos DIYAPP
const seen = new Set();
const uniqueList = db.list.filter(p => {
    if (p.Title.includes('DIYAPP Evolution')) {
        const version = (p.Title.match(/V\d+/) || ['UNKNOWN'])[0];
        if (seen.has(version)) return false;
        seen.add(version);
        return true;
    }
    return true; // Mantém outros projetos
});

// 2. Reset de Estados para Governança Estrita
uniqueList.forEach(p => {
    if (p.Status === 'IN_PROGRESS' || p.Status === 'AWAITING_APPROVAL' || p.Status === 'APPROVED_FOR_DEPLOY') {
        p.Status = 'PENDING';
        p.Active_Agent = null;
    }
});

db.list = uniqueList;
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log(`--- PURGA CONCLUÍDA ---`);
console.log(`Projetos Removidos: ${originalCount - uniqueList.length}`);
console.log(`Projetos Restantes: ${uniqueList.length}`);
console.log(`Estado: Sistema Esterilizado e pronto para Lockdown.`);
