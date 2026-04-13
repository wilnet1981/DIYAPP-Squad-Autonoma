const axios = require('axios');
require('dotenv').config();

const nocoBaseUrl = process.env.NOCODB_BASE_URL;
const nocoToken = process.env.NOCODB_TOKEN;
const tableId = process.env.NOCODB_TABLE_ID;

const nocoApi = axios.create({
    baseURL: nocoBaseUrl,
    headers: { 'xc-token': nocoToken, 'Content-Type': 'application/json' }
});

async function checkProgress() {
    try {
        const res = await nocoApi.get(`/api/v2/tables/${tableId}/records`, { params: { limit: 10, sort: '-Id' } });
        console.log('--- RELATÓRIO DE PROGRESSO DO ENXAME ---');
        res.data.list.forEach(p => {
            console.log(`\nPROJETO: ${p.Title} (ID: ${p.Id})`);
            console.log(`STATUS: ${p.Status}`);
            console.log(`AGENTE ATIVO: ${p.Active_Agent}`);
            
            if (p.Backlog) {
                try {
                    const tasks = JSON.parse(p.Backlog);
                    console.log(`BACKLOG (HIVE): ${tasks.length} tarefas detectadas.`);
                    tasks.forEach(t => console.log(`  - [${t.agent}] ${t.desc} -> STATUS: ${t.status}`));
                } catch(e) { console.log(`BACKLOG BRUTO: ${p.Backlog}`); }
            }
            
            if (p.Log_Entry) console.log(`LATEST LOG: ${p.Log_Entry}`);
            console.log(`TOKENS: ${p.Tokens}`);
            console.log('--------------------------------------');
        });
    } catch (e) {
        console.error('Erro ao verificar progresso:', e.response ? e.response.data : e.message);
    }
}

checkProgress();
