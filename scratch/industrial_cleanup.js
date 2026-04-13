const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/local_db.json');
const BL_PATH = path.join(__dirname, '../data/backlogs.json');

console.log('--- INICIANDO LIMPEZA INDUSTRIAL DE GOVERNANÇA ---');

// 1. Reset Local DB (Projects)
const localDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
localDb.list.forEach(p => {
    if (p.Title.includes('DIYAPP')) {
        p.Status = 'PENDING';
        p.Active_Agent = null;
        console.log(`[RESET] Projeto: ${p.Title} (${p.Id})`);
    }
});
fs.writeFileSync(DB_PATH, JSON.stringify(localDb, null, 2));

// 2. Reset Backlogs (Tasks)
const backlogs = JSON.parse(fs.readFileSync(BL_PATH, 'utf8'));
Object.keys(backlogs).forEach(pId => {
    // Verificar se o ID pertence a um projeto DIYAPP (via verificação cruzada simples ou nome no DB)
    const project = localDb.list.find(p => p.Id.toString() === pId.toString());
    if (project && project.Title.includes('DIYAPP')) {
        backlogs[pId].forEach(task => {
            if (task.status !== 'DONE') { // Manter o histórico de DONE se houver, mas resetar o resto
                 task.status = 'PENDING';
            }
            // O usuário quer tudo no backlog para re-priorizar 1 por 1
            // Então vamos resetar até os IN_PROGRESS
            if (task.status === 'IN_PROGRESS') task.status = 'PENDING';
        });
        console.log(`[RESET] Backlog do Projeto ID: ${pId}`);
    }
});
fs.writeFileSync(BL_PATH, JSON.stringify(backlogs, null, 2));

console.log('--- LIMPEZA CONCLUÍDA: SISTEMA PRONTO PARA SEQUENCIAMENTO ---');
