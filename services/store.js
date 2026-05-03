const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/squad.db');
const LOG_DIR = path.join(__dirname, '../data/logs');

// Ensure directories exist
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Initialize Schema
db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT,
        status TEXT,
        description TEXT,
        project_goal TEXT,
        technical_specs TEXT,
        backlog TEXT,
        active_agent TEXT,
        tokens INTEGER DEFAULT 0,
        token_breakdown TEXT,
        pr_number TEXT,
        pr_branch TEXT,
        pr_url TEXT,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT,
        timestamp TEXT,
        message TEXT,
        agent TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
`);

async function getProjects() {
    console.log('[STORE] Buscando projetos no SQLite...');
    const stmt = db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    const projects = stmt.all();

    // Map JSON strings back to objects
    return projects.map(p => {
        const project = {
            Id: p.id,
            Title: p.title,
            Status: p.status,
            Description: p.description,
            Project_Goal: p.project_goal,
            Technical_Specs: p.technical_specs,
            Active_Agent: p.active_agent,
            Tokens: p.tokens,
            PR_Number: p.pr_number,
            PR_Branch: p.pr_branch,
            PR_URL: p.pr_url,
            CreatedAt: p.created_at
        };

        try { project.Backlog = p.backlog ? JSON.parse(p.backlog) : []; } catch(e) { project.Backlog = []; }
        try { project.Token_Breakdown = p.token_breakdown ? JSON.parse(p.token_breakdown) : { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 }; } catch(e) { project.Token_Breakdown = {}; }

        // Fetch latest logs for this project
        const logStmt = db.prepare('SELECT timestamp, message, agent FROM logs WHERE project_id = ? ORDER BY timestamp DESC LIMIT 50');
        project.Logs = logStmt.all(p.id);

        return project;
    });
}

async function createProject(payload) {
    const id = payload.Id || 'local-' + Date.now();
    const createdAt = new Date().toISOString();
    
    const stmt = db.prepare(`
        INSERT INTO projects (id, title, status, description, project_goal, technical_specs, active_agent, created_at, backlog, token_breakdown)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        id,
        payload.Title || 'Sem Título',
        payload.Status || 'PENDING',
        payload.Description || '',
        payload.Project_Goal || '',
        payload.Technical_Specs || '',
        payload.Active_Agent || 'Squad Leader',
        createdAt,
        JSON.stringify(payload.Backlog || []),
        JSON.stringify({ deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 })
    );

    console.log('[STORE] Projeto criado no SQLite:', id);
    return { ...payload, Id: id, CreatedAt: createdAt, Logs: [], Token_Breakdown: { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 } };
}

async function updateProject(id, data) {
    // 1. Get current project
    const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!current) return null;

    // 2. Handle Token Breakdown Updates
    if (data.TokenAmount && data.Provider) {
        let breakdown = { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 };
        try { if (current.token_breakdown) breakdown = JSON.parse(current.token_breakdown); } catch(e) {}
        
        const prov = data.Provider.toLowerCase();
        let matchedProv = 'deepseek';
        if (prov.includes('mistral')) matchedProv = 'mistral';
        if (prov.includes('gemini') || prov.includes('google')) matchedProv = 'gemini';
        if (prov.includes('gpt') || prov.includes('openai')) matchedProv = 'openai';
        if (prov.includes('claude') || prov.includes('anthropic')) matchedProv = 'claude';

        breakdown[matchedProv] = (breakdown[matchedProv] || 0) + data.TokenAmount;
        data.token_breakdown = JSON.stringify(breakdown);
        data.tokens = (current.tokens || 0) + data.TokenAmount;

        delete data.TokenAmount;
        delete data.Provider;
    }

    // 3. Handle Logs
    if (data.LogEntry) {
        const logStmt = db.prepare('INSERT INTO logs (project_id, timestamp, message, agent) VALUES (?, ?, ?, ?)');
        logStmt.run(id, new Date().toISOString(), data.LogEntry, data.Active_Agent || current.active_agent);
        delete data.LogEntry;
    }

    // 4. Update Project Fields
    // Map cammelCase to snake_case if necessary
    const updateMap = {
        Title: 'title',
        Status: 'status',
        Description: 'description',
        Project_Goal: 'project_goal',
        Technical_Specs: 'technical_specs',
        Backlog: 'backlog',
        Active_Agent: 'active_agent',
        PR_Number: 'pr_number',
        PR_Branch: 'pr_branch',
        PR_URL: 'pr_url'
    };

    const sets = [];
    const values = [];

    for (const key in data) {
        const dbKey = updateMap[key] || key.toLowerCase();
        sets.push(`${dbKey} = ?`);
        let val = data[key];
        if (typeof val === 'object') val = JSON.stringify(val);
        values.push(val);
    }

    if (sets.length > 0) {
        values.push(id);
        const updateStmt = db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`);
        updateStmt.run(...values);
    }

    return { id, ...data };
}

module.exports = { getProjects, createProject, updateProject };


/**
 * deleteDoneProjects - Remove todos os projetos com status 'DONE' do banco SQLite.
 * @returns {number} Número de registros deletados
 */
function deleteDoneProjects() {
    console.log('[STORE] Removendo projetos finalizados (DONE)...');
    const info = db.prepare('DELETE FROM projects WHERE status = ?').run('DONE');
    console.log(`[STORE] ${info.changes} projetos removidos.`);
    return info.changes;
}

module.exports = { getProjects, createProject, updateProject, deleteDoneProjects };