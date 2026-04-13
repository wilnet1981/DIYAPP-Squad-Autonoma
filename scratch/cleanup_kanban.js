const store = require('../services/store');
const fs = require('fs');
const path = require('path');

const BACKLOG_FILE = path.join(__dirname, './data/backlogs.json');

function getProjectProgress(projectId, tasks) {
    if (!tasks || tasks.length === 0) return 0;
    const done = tasks.filter(t => t.status === 'DONE').length;
    return done / tasks.length;
}

async function cleanup() {
    console.log('--- INICIANDO LIMPEZA DE KANBAN (PROTOCOLO DE FOCO) ---');
    try {
        const projects = await store.getProjects();
        let backlogs = {};
        if (fs.existsSync(BACKLOG_FILE)) {
            backlogs = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf8'));
        }

        const activeProjects = projects.filter(p => p.Status === 'IN_PROGRESS')
            .map(p => ({
                ...p,
                progress: getProjectProgress(p.Id, backlogs[p.Id])
            }));

        // Sort by progress descending
        activeProjects.sort((a, b) => b.progress - a.progress);

        if (activeProjects.length <= 1) {
            console.log('Nada para limpar. Apenas 1 ou menos projetos em progresso.');
            return;
        }

        const chosenOne = activeProjects[0];
        const toCleanup = activeProjects.slice(1);

        console.log(`FOCO MANTIDO EM: ${chosenOne.Title} (${(chosenOne.progress * 100).toFixed(1)}%)`);

        for (const p of toCleanup) {
            console.log(`RECUANDO: ${p.Title} -> Voltando para 'Aguardando'`);
            await store.updateProject(p.Id, { Status: 'PENDING', Active_Agent: null });
        }

        console.log('--- LIMPEZA CONCLUÍDA ✅ ---');
    } catch (e) {
        console.error('Erro na limpeza:', e.message);
    }
}

cleanup();
