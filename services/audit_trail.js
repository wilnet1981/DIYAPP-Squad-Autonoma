/**
 * AUDIT TRAIL — Registro completo de cada ciclo de desenvolvimento.
 * Captura tudo: do briefing inicial ao deploy final.
 * Cada entrada tem: timestamp, fase, ator, ação, resultado.
 */

const fs = require('fs');
const path = require('path');

const TRAIL_FILE = path.join(__dirname, '../data/audit_trail.json');

function load() {
    try {
        if (!fs.existsSync(TRAIL_FILE)) return [];
        return JSON.parse(fs.readFileSync(TRAIL_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function save(entries) {
    try {
        const dir = path.dirname(TRAIL_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        // Mantém só as últimas 500 entradas
        const trimmed = entries.slice(-500);
        fs.writeFileSync(TRAIL_FILE, JSON.stringify(trimmed, null, 2));
    } catch (e) {
        console.error('[AUDIT-TRAIL] Falha ao salvar:', e.message);
    }
}

/**
 * Registra um evento no audit trail.
 * @param {Object} params
 * @param {string} params.projectId   - ID do projeto (ou 'CHAT' para fase de briefing)
 * @param {string} params.projectTitle - Título legível do projeto
 * @param {string} params.phase       - Ex: 'BRIEFING', 'PLANEJAMENTO', 'EXECUÇÃO', 'VERIFICAÇÃO', 'QA', 'DEPLOY'
 * @param {string} params.actor       - Quem fez: 'PM', 'PO', 'Frontend', 'QA', etc.
 * @param {string} params.action      - O que foi feito (resumo curto)
 * @param {string} params.result      - 'OK', 'FAIL', 'SKIP', 'PENDING'
 * @param {string} [params.detail]    - Detalhe adicional (opcional)
 */
function log({ projectId, projectTitle, phase, actor, action, result, detail }) {
    const entries = load();
    const entry = {
        ts: new Date().toISOString(),
        projectId: projectId || 'UNKNOWN',
        projectTitle: projectTitle || 'Sem título',
        phase,
        actor,
        action,
        result,
        detail: detail || null
    };
    entries.push(entry);
    save(entries);
    console.log(`[AUDIT] [${phase}] [${actor}] ${action} → ${result}`);
}

/**
 * Retorna o trail completo de um projeto específico, ordenado por tempo.
 */
function getForProject(projectId) {
    return load().filter(e => e.projectId === projectId);
}

/**
 * Retorna os últimos N eventos de todos os projetos.
 */
function getRecent(n = 200) {
    return load().slice(-n).reverse();
}

/**
 * Gera um relatório em texto legível para um projeto.
 */
function generateReport(projectId) {
    const entries = getForProject(projectId);
    if (entries.length === 0) return null;

    const title = entries[0].projectTitle;
    const start = new Date(entries[0].ts);
    const end = new Date(entries[entries.length - 1].ts);
    const durationMin = Math.round((end - start) / 60000);

    const lines = [
        `═══════════════════════════════════════════════════`,
        `  RELATÓRIO DE CICLO — ${title}`,
        `═══════════════════════════════════════════════════`,
        `  Início:   ${start.toLocaleString('pt-BR')}`,
        `  Término:  ${end.toLocaleString('pt-BR')}`,
        `  Duração:  ${durationMin} minutos`,
        `───────────────────────────────────────────────────`,
        ``
    ];

    let lastPhase = '';
    for (const e of entries) {
        if (e.phase !== lastPhase) {
            lines.push(`  ▶ FASE: ${e.phase}`);
            lastPhase = e.phase;
        }
        const icon = e.result === 'OK' ? '✅' : e.result === 'FAIL' ? '❌' : e.result === 'SKIP' ? '⏭️' : '⏳';
        const time = new Date(e.ts).toLocaleTimeString('pt-BR');
        lines.push(`    ${icon} [${time}] [${e.actor}] ${e.action}`);
        if (e.detail) lines.push(`         → ${e.detail}`);
    }

    lines.push(``);
    lines.push(`───────────────────────────────────────────────────`);

    const ok = entries.filter(e => e.result === 'OK').length;
    const fail = entries.filter(e => e.result === 'FAIL').length;
    lines.push(`  Ações bem-sucedidas: ${ok}`);
    lines.push(`  Falhas:              ${fail}`);
    lines.push(`═══════════════════════════════════════════════════`);

    return lines.join('\n');
}

module.exports = { log, getForProject, getRecent, generateReport };
