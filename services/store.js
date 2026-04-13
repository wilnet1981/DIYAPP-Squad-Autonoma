const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/local_db.json');

// Ensure data dir exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Initial structure if file not exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ list: [] }, null, 2));
}

const nocoBaseUrl = process.env.NOCODB_BASE_URL;
const nocoToken = process.env.NOCODB_TOKEN;
const tableId = process.env.NOCODB_TABLE_ID;

const nocoApi = axios.create({
    baseURL: nocoBaseUrl,
    headers: { 'xc-token': nocoToken, 'Content-Type': 'application/json' }
});

const isNocoConfigured = false; // MODO LOCAL FORÇADO PARA VELOCIDADE

async function getProjects() {
    console.log('[STORE] Iniciando fetch de projetos...');
    let allProjects = [];

    // 1. Try NocoDB
    if (isNocoConfigured) {
        try {
            const startTime = Date.now();
            const res = await nocoApi.get(`/api/v2/tables/${tableId}/records`, { params: { limit: 25, sort: '-CreatedAt' } });
            allProjects = res.data.list || [];
            console.log(`[STORE] NocoDB respondeu em ${Date.now() - startTime}ms com ${allProjects.length} registros.`);
        } catch (e) {
            console.error('[STORE] Falha ao ler NocoDB, usando local:', e.message);
        }
    }

    // 2. Merge with Local
    const localData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const total = [...allProjects, ...(localData.list || [])];
    
    // 3. Inject Local Backlogs for Hive mode visibility
    const BACKLOG_FILE = path.join(__dirname, '../data/backlogs.json');
    if (fs.existsSync(BACKLOG_FILE)) {
        try {
            const backlogs = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf8'));
            total.forEach(p => {
                if (!p.Backlog && backlogs[p.Id]) {
                    p.Backlog = backlogs[p.Id];
                }
            });
        } catch(e) {}
    }

    console.log(`[STORE] Total de projetos em memória: ${total.length}`);
    return total;
}

async function createProject(payload) {
    if (isNocoConfigured) {
        try {
            const res = await nocoApi.post(`/api/v2/tables/${tableId}/records`, payload);
            console.log('[STORE] Projeto criado no NocoDB:', res.data.Id);
            return res.data;
        } catch (e) {
            console.error('[STORE] Erro NocoDB, salvando apenas local:', e.message);
        }
    }

    // Save Local
    const localData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const newProject = { 
        Id: 'local-' + Date.now(), 
        ...payload, 
        Logs: [], 
        Token_Breakdown: { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 },
        CreatedAt: new Date().toISOString() 
    };
    localData.list.unshift(newProject);
    fs.writeFileSync(DB_PATH, JSON.stringify(localData, null, 2));
    console.log('[STORE] Projeto salvo LOCALMENTE:', newProject.Id);
    return newProject;
}

async function updateProject(id, data) {
    const isLocal = id.toString().startsWith('local-');
    let project = null;
    let localData = null;

    if (isLocal) {
        localData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        const index = localData.list.findIndex(p => p.Id === id);
        if (index !== -1) project = localData.list[index];
    } else {
        // NocoDB project, we might need its current state for breakdown
        const projects = await getProjects();
        project = projects.find(p => p.Id === id);
    }

    if (!project) return null;

    // 1. Calculate Token Breakdown
    if (data.TokenAmount && data.Provider) {
        if (!project.Token_Breakdown || typeof project.Token_Breakdown === 'string') {
            try {
                project.Token_Breakdown = typeof project.Token_Breakdown === 'string' 
                    ? JSON.parse(project.Token_Breakdown) 
                    : { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 };
            } catch (e) {
                project.Token_Breakdown = { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 };
            }
        }
        
        // Ensure keys exist and are normalized
        const normalizedBD = { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0, ...project.Token_Breakdown };
        const prov = data.Provider.toLowerCase();
        
        // Match base providers even if they have model suffixes
        let matchedProv = 'deepseek';
        if (prov.includes('mistral')) matchedProv = 'mistral';
        if (prov.includes('gemini') || prov.includes('google')) matchedProv = 'gemini';
        if (prov.includes('gpt') || prov.includes('openai')) matchedProv = 'openai';
        if (prov.includes('claude') || prov.includes('anthropic')) matchedProv = 'claude';
        if (prov.includes('deepseek')) matchedProv = 'deepseek';

        normalizedBD[matchedProv] = (normalizedBD[matchedProv] || 0) + data.TokenAmount;
        
        // Pass the updated breakdown to the final data object
        data.Token_Breakdown = normalizedBD;
        
        // NEW: Fallback/Direct columns support for NocoDB
        // We add these keys to the main update object so NocoDB fills them if cols exist
        data[matchedProv] = (project[matchedProv] || 0) + data.TokenAmount;

        delete data.TokenAmount;
        delete data.Provider;
    }

    // 2. Handle Logs (Multi-Layer: Local File + Local Memory)
    if (data.LogEntry) {
        const logDir = path.join(__dirname, '../data/logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logFile = path.join(logDir, `${id}.json`);
        
        // 2.1 Load existing local logs
        let logs = [];
        if (fs.existsSync(logFile)) {
            try { logs = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch(e) {}
        }
        
        // 2.2 Add new entry
        const newEntry = {
            timestamp: new Date().toISOString(),
            message: data.LogEntry,
            agent: project.Active_Agent
        };
        logs.unshift(newEntry);
        
        // 2.3 Keep latest 100, save to disk
        fs.writeFileSync(logFile, JSON.stringify(logs.slice(0, 100), null, 2));
        
        // 2.4 Update in-memory for local_db support
        project.Logs = logs;
        data.Logs = logs;
        delete data.LogEntry;
    }

    // 3. Persist
    if (isLocal) {
        const index = localData.list.findIndex(p => p.Id === id);
        localData.list[index] = { ...project, ...data };
        fs.writeFileSync(DB_PATH, JSON.stringify(localData, null, 2));
        return localData.list[index];
    } else if (isNocoConfigured) {
        try {
            // NocoDB might require JSON fields to be strings depending on version, 
            // but xc-token API usually handles JSON objects if column type is JSON.
            const res = await nocoApi.patch(`/api/v2/tables/${tableId}/records`, { Id: id, ...data });
            return res.data;
        } catch (e) {
            console.error(`[STORE] Erro ao atualizar NocoDB ${id}:`, e.message);
        }
    }
    return null;
}

module.exports = { getProjects, createProject, updateProject };
