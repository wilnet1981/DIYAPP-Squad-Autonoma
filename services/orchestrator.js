const aiService = require('./ai_service');
const store = require('./store');
const billing = require('./billing_service');
const auditTrail = require('./audit_trail');
const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const security = require('./security_monitor');

// ─── SINGLETON LOCK (Previne Processos Fantasmas) ─────────────────────────────
const LOCK_FILE = path.join(__dirname, '../.orchestrator.lock');
function acquireLock() {
    if (fs.existsSync(LOCK_FILE)) {
        const oldPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'));
        try {
            // Verifica se o processo antigo ainda está vivo no Windows/Linux
            process.kill(oldPid, 0); 
            console.error(`[FATAL] Orquestrador já está rodando (PID: ${oldPid}). Encerrando esta instância.`);
            process.exit(1);
        } catch (e) {
            // Processo antigo morreu, podemos assumir o controle
            console.log(`[LOCK] Limpando trava órfã do PID ${oldPid}.`);
        }
    }
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    process.on('exit', () => { try { fs.unlinkSync(LOCK_FILE); } catch(e){} });
}
acquireLock();

// Todos os arquivos da plataforma que podem ser auditados/modificados
const PLATFORM_FILES = [
    { name: 'index.html',              maxLen: 12000, keywords: ['html', 'botão', 'nav', 'sidebar', 'menu', 'tela', 'dom', 'modal', 'layout', 'view', 'spa'] },
    { name: 'style.css',               maxLen: 12000, keywords: ['css', 'cor', 'color', 'estilo', 'visual', 'fundo', 'background', 'fonte', 'margin', 'padding', 'seletor', 'selector'] },
    { name: 'app.js',                  maxLen: 12000, keywords: ['js', 'javascript', 'função', 'click', 'evento', 'lógica', 'fetch', 'aprovação', 'kanban', 'switchview', 'render'] },
    { name: 'server.js',               maxLen: 8000,  keywords: ['servidor', 'api', 'rota', 'endpoint', 'backend', 'express', 'stability', 'metrics', 'route'] },
    { name: 'services/orchestrator.js',maxLen: 8000,  keywords: ['orquestrador', 'hive', 'sprint', 'agente', 'fluxo', 'ciclo', 'getmetrics', 'metrics', 'orchestrat'] }
];

// Extrai trecho relevante de um arquivo em torno de palavras-chave da tarefa.
// Se o arquivo cabe no maxLen, retorna inteiro. Se não, extrai janela ao redor das ocorrências.
function extractRelevantSection(content, taskDesc, maxLen) {
    if (content.length <= maxLen) return content;

    const words = (taskDesc || '').toLowerCase()
        .split(/[\s,.()\[\]'"]+/)
        .filter(w => w.length > 4);

    const lines = content.split('\n');
    const scored = lines.map((line, i) => {
        const lower = line.toLowerCase();
        const score = words.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0);
        return { i, score };
    });

    // Encontra as linhas com maior relevância
    const hotLines = scored.filter(l => l.score > 0).map(l => l.i);

    if (hotLines.length === 0) {
        // Nenhuma linha relevante — retorna início + fim (cabeçalho e rodapé)
        const half = Math.floor(maxLen / 2);
        const start = content.substring(0, half);
        const end = content.substring(content.length - half);
        return start + '\n\n/* ... conteúdo intermediário omitido ... */\n\n' + end;
    }

    // Expande janela de ±40 linhas ao redor das linhas relevantes
    const WINDOW = 40;
    const included = new Set();
    for (const idx of hotLines) {
        for (let j = Math.max(0, idx - WINDOW); j <= Math.min(lines.length - 1, idx + WINDOW); j++) {
            included.add(j);
        }
    }

    const sortedIdx = [...included].sort((a, b) => a - b);
    let result = '';
    let prev = -1;
    for (const idx of sortedIdx) {
        if (prev !== -1 && idx > prev + 1) result += '\n/* ... */\n';
        result += lines[idx] + '\n';
        prev = idx;
    }

    if (result.length > maxLen) result = result.substring(0, maxLen) + '\n/* ... truncado ... */';
    return result;
}

// ─── DOM CONTRACT ─────────────────────────────────────────────────────────────
// Extrai todos os id="..." do index.html e salva em data/dom_inventory.json.
// Chamado automaticamente após qualquer patch ao index.html.
function rebuildDOMInventory() {
    try {
        const indexPath = path.join(__dirname, '../index.html');
        if (!fs.existsSync(indexPath)) return null;
        const html = fs.readFileSync(indexPath, 'utf8');
        const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
        const views = allIds.filter(id => id.startsWith('view-'));
        const nav   = allIds.filter(id => id.startsWith('nav-'));
        const inventory = { all: allIds, views, nav, updatedAt: Date.now() };
        const inventoryPath = path.join(__dirname, '../data/dom_inventory.json');
        fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
        console.log(`[DOM-INVENTORY] Reconstruído: ${allIds.length} IDs (views: ${views.join(', ')})`);
        return inventory;
    } catch (e) {
        console.error(`[DOM-INVENTORY] Falha: ${e.message}`);
        return null;
    }
}

function getDOMInventory() {
    try {
        const inventoryPath = path.join(__dirname, '../data/dom_inventory.json');
        if (!fs.existsSync(inventoryPath)) return rebuildDOMInventory();
        return JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    } catch (e) {
        return null;
    }
}

// Verifica se o conteúdo JS referencia IDs que não existem no index.html.
// Retorna lista de IDs inválidos (vazia = OK).
function validateDOMReferences(jsContent, inventory) {
    if (!inventory || !inventory.all) return [];
    const idRefs = [...jsContent.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
    const selectorRefs = [...jsContent.matchAll(/querySelector(?:All)?\(['"]#([^'"\s)]+)['"]\)/g)].map(m => m[1]);
    const allRefs = [...new Set([...idRefs, ...selectorRefs])];
    // Ignora IDs gerados dinamicamente (ex: agent-${name})
    const staticRefs = allRefs.filter(id => !id.includes('${') && !id.includes('+'));
    return staticRefs.filter(id => !inventory.all.includes(id));
}
// ──────────────────────────────────────────────────────────────────────────────

// Retorna métricas do sistema para monitoramento de estabilidade
function getMetrics() {
    const now = Date.now();
    return {
        uptime: now - lastCycleMetrics.startTime,
        status: lastCycleMetrics.status,
        latency: lastCycleMetrics.latency,
        duration: lastCycleMetrics.duration
    };
}

// META-EVOLUTION: Lê arquivos da plataforma para contexto dos agentes.
// forAudit=true → carrega TODOS os arquivos (para ciclos de auto-avaliação)
// forAudit=false → carrega apenas os relevantes pela descrição da tarefa
function getMetaFileContext(taskDesc, forAudit = false) {
    const rootPath = path.join(__dirname, '..');
    const files = {};
    const descLower = (taskDesc || '').toLowerCase();

    for (const target of PLATFORM_FILES) {
        const isRelevant = forAudit || target.keywords.some(kw => descLower.includes(kw));
        if (!isRelevant) continue;
        const filePath = path.join(rootPath, target.name);
        if (!fs.existsSync(filePath)) continue;
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            files[target.name] = forAudit
                ? (raw.length > target.maxLen ? raw.substring(0, target.maxLen) + '\n/* ... truncado ... */' : raw)
                : extractRelevantSection(raw, taskDesc, target.maxLen);
        } catch (e) {
            console.warn(`[META-CONTEXT] Falha ao ler ${target.name}: ${e.message}`);
        }
    }

    if (Object.keys(files).length === 0) return '';

    let context = '\n\n=== ARQUIVOS REAIS DA PLATAFORMA DIYAPP ===\n';
    context += 'Estes são os arquivos REAIS do sistema em produção. Baseie sua análise neles.\n\n';
    for (const [name, content] of Object.entries(files)) {
        context += `--- ${name} ---\n${content}\n--- FIM DE ${name} ---\n\n`;
    }
    return context;
}

// Níveis de complexidade do ciclo de auto-avaliação
const EVAL_LEVELS = [
    {
        level: 1,
        label: 'SIMPLES',
        desc: 'Bugs visuais e estruturais simples: elementos HTML ausentes que o app.js referencia mas não existem no index.html, classes CSS faltando, textos/labels errados, console.logs desnecessários, inconsistências de estilo óbvias.'
    },
    {
        level: 2,
        label: 'MÉDIO',
        desc: 'Problemas de lógica e fluxo: funções em app.js que referenciam IDs que não existem, endpoints do servidor incompletos, estados de projeto não tratados na UI, fluxos de aprovação com casos faltando.'
    },
    {
        level: 3,
        label: 'COMPLEXO',
        desc: 'Melhorias de arquitetura e features: novas views no SPA (view-softwares, view-billing, view-audit), melhorias de UX, novos agentes, otimizações de performance do orquestrador.'
    }
];

// Lê o nível atual de avaliação persistido (começa em 1)
function getCurrentEvalLevel() {
    const stateFile = path.join(__dirname, '../.squad/eval_state.json');
    try {
        if (fs.existsSync(stateFile)) {
            const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            return Math.min(state.level || 1, EVAL_LEVELS.length);
        }
    } catch(e) {}
    return 1;
}

function saveEvalLevel(level) {
    const stateFile = path.join(__dirname, '../.squad/eval_state.json');
    const dir = path.dirname(stateFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ level, updatedAt: new Date().toISOString() }, null, 2));
}

// Lê GOVERNANCE_STEP_BY_STEP do .env para modo de aprovação soberana (passo a passo)
function isStepByStepEnabled() {
    try {
        const envPath = path.join(__dirname, '../.env');
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^GOVERNANCE_STEP_BY_STEP\s*=\s*(true|false)\b/m);
        return match ? match[1].toLowerCase() === 'true' : false;
    } catch (e) {
        return false;
    }
}

// Lê ENABLE_AUTO_SEEDING direto do .env (DESATIVADO FORÇADAMENTE PARA MODO MANUAL)
function isAutoSeedingEnabled() {
    return false; // Forçado pelo Arquiteto para garantir modo 100% manual.
}

// Cria automaticamente um projeto de auto-avaliação quando a fábrica está ociosa
async function autoSeedEvaluation(allProjects) {
    if (!isAutoSeedingEnabled()) return;

    // Não cria se já existe um ciclo ativo ou aguardando deploy
    const hasActive = allProjects.some(p =>
        p.Title.includes('DIYAPP — Ciclo') &&
        !['DONE', 'CANCELLED'].includes(p.Status)
    );
    if (hasActive) {
        console.log('[AUTO-SEED] Ciclo ativo ou em deploy encontrado. Aguardando conclusão antes de criar novo.');
        return;
    }

    const level = getCurrentEvalLevel();
    const evalInfo = EVAL_LEVELS[level - 1];

    const title = `DIYAPP — Ciclo ${level}: Auto-Avaliação ${evalInfo.label}`;
    console.log(`[AUTO-SEED] Iniciando ${title}...`);

    await store.createProject({
        Title: title,
        Project_Goal: `Auto-avaliar e corrigir a plataforma DIYAPP no nível ${evalInfo.label}.`,
        Technical_Specs: JSON.stringify({ evalLevel: level, evalLabel: evalInfo.label, evalDesc: evalInfo.desc }),
        Status: 'PENDING'
    });

    console.log(`[AUTO-SEED] Projeto criado: ${title}`);
}

// Loop interval
// Loop interval - accelerated to 15s for high responsiveness
// Loop interval - set to 30s to allow for backup AI latency
const TICK_INTERVAL = 30000; 
let lastCycleMetrics = {
    latency: 0,
    startTime: Date.now(),
    duration: 0,
    status: 'IDLE'
};

const FLOW = [
    { status: 'IN_PROGRESS', agent: 'Product Manager', activity: 'Ajustando escopo', roleFile: 'pm_instruction.html' },
    { status: 'IN_PROGRESS', agent: 'UX Designer', activity: 'Criando wireframes e UI', roleFile: 'ux_designer_instruction.html' },
    { status: 'IN_PROGRESS', agent: 'Tech Leader', activity: 'Definindo arquitetura e diretórios', roleFile: 'tech_leader_instruction.html' },
    { status: 'IN_PROGRESS', agent: 'Dev Backend', activity: 'Codificando Lógica e APIs', roleFile: 'dev_backend_instruction.html' },
    { status: 'IN_PROGRESS', agent: 'QA', activity: 'Validando e Refatorando', roleFile: 'qa_instruction.html' },
    { status: 'IN_PROGRESS', agent: 'QA (Analise)', activity: 'Buscando bugs residuais', roleFile: 'qa_instruction.html' },
    { status: 'IN_PROGRESS', agent: 'Inovação', activity: 'Propondo Melhorias Evolutivas', roleFile: 'inovacao_produto_instruction.html' },
    { status: 'DONE', agent: 'SRE', activity: 'Finalizando Deploy Industrial', roleFile: 'sre_instruction.html' }
];

const ROLE_MAP = {
    'Product Manager': 'pm_instruction.html',
    'Product Owner': 'po_instruction.html',
    'UX Designer': 'ux_designer_instruction.html',
    'Tech Leader': 'tech_leader_instruction.html',
    'Frontend': 'dev_frontend_instruction.html',
    'Backend': 'dev_backend_instruction.html',
    'Dev Backend': 'dev_backend_instruction.html',
    'Dev Frontend': 'dev_frontend_instruction.html',
    'QA': 'qa_instruction.html',
    'SRE': 'sre_instruction.html',
    'Inovação': 'inovacao_produto_instruction.html',
    'Segurança': 'especialista_seguranca_instruction.html',
    'Compliance': 'compliance_instruction.html',
    'Data Engineer': 'data_engineer_instruction.html',
    'AI Ops': 'ai_ops_instruction.html',
    'Especialista LLM': 'especialista_llm_instruction.html',
    'Especialista Infra': 'especialista_infra_instruction.html',
    'Tech Writer': 'tech_writer_instruction.html',
    'Melhoria Contínua': 'melhoria_continua_instruction.html',
    'Squad Leader': 'squad_leader_instruction.html',
    'Verificador de Código': 'verificador_codigo_instruction.html'
};

// BACKLOG INTEGRAÇÃO: Agora usando SQLite diretamente via store
function getLocalBacklog(project) {
    return project.Backlog || [];
}

async function saveLocalBacklog(projectId, tasks) {
    await store.updateProject(projectId, { Backlog: tasks });
}

function getRoleFile(agentName) {
    return ROLE_MAP[agentName] || (agentName.toLowerCase().replace(/\s+/g, '_') + '_instruction.html');
}

function getProjectProgress(project) {
    const tasks = getLocalBacklog(project);
    if (!tasks || tasks.length === 0) return 0;
    const done = tasks.filter(t => t.status === 'DONE').length;
    return done / tasks.length;
}

async function runOrchestration() {
    console.log('[Orchestrator] Modo Colmeia Ativo. Verificando enxames...');
    
    // 0. SECURITY CHECK: Global Lockdown
    const secStatus = security.getStatus();
    if (secStatus.lockdown) {
        console.error(`[LOCKDOWN] Operação suspensa por segurança: ${secStatus.reason}`);
        return;
    }

    const start = Date.now();
    lastCycleMetrics.startTime = start;
    lastCycleMetrics.status = 'RUNNING';

    try {
        const projects = await store.getProjects();
        
        // Filter and calculate progress
        const allPendingOrActive = projects.filter(p => p.Status === 'PENDING' || p.Status === 'IN_PROGRESS' || p.Status === 'AWAITING_APPROVAL' || p.Status === 'AWAITING_STEP_APPROVAL' || p.Status === 'AWAITING_DEPLOY_APPROVAL' || p.Status === 'APPROVED_FOR_DEPLOY')
            .map(p => ({ ...p, progress: getProjectProgress(p) }));

        // STRATEGIC LOCK: Se qualquer projeto estiver aguardando aprovação ou com o Aprovador, pause a fábrica.
        const awaitingApproval = allPendingOrActive.find(p => p.Status === 'AWAITING_APPROVAL' || p.Status === 'AWAITING_STEP_APPROVAL' || p.Status === 'AWAITING_DEPLOY_APPROVAL' || p.Active_Agent === 'Aprovador');
        if (awaitingApproval) {
            console.log(`[LOCKDOWN] Fábrica Pausada. Aguardando aprovação soberana para: ${awaitingApproval.Title} [Status: ${awaitingApproval.Status}]`);
            
            // Mas permitimos que o projeto que JÁ FOI aprovado prossiga para o deploy
            const approved = allPendingOrActive.find(p => p.Status === 'APPROVED_FOR_DEPLOY');
            if (approved) {
                console.log(`[GOVERNANÇA] Autorização confirmada! Finalizando implantação de "${approved.Title}"...`);
                await finalizeProjectDeploy(approved);
            }
            return;
        }

        // Active pool for the Strategic Brake (Focus on real pending work)
        const active = allPendingOrActive.filter(p => p.Status === 'PENDING' || p.Status === 'IN_PROGRESS' || p.Status === 'APPROVED_FOR_DEPLOY');

        // Sort by progress (closest to finish first)
        active.sort((a,b) => b.progress - a.progress);

        if (active.length === 0) {
            console.log('[Orchestrator] Nada pendente de execução real. Verificando auto-avaliação...');
            await autoSeedEvaluation(projects);
            return;
        }

        // STRATEGIC BRAKE: Only process the TOP 1 project (Focus Mode)
        const project = active[0];

        const status = (project.Status || '').toUpperCase();
        if (status === 'PENDING') {
            console.log(`[Orchestrator] Foco Único: Ativando novo projeto: ${project.Title}`);
            await store.updateProject(project.Id, { Status: 'IN_PROGRESS', Active_Agent: 'Product Owner' });
        } else if (status === 'IN_PROGRESS') {
            console.log(`[HIVE] Foco Único: "${project.Title}" (${(project.progress * 100).toFixed(1)}%)`);
            await advanceProjectHive(project);
        } else if (status === 'APPROVED_FOR_DEPLOY') {
            await finalizeProjectDeploy(project);
        }

        // --- CONTINUOUS IMPROVEMENT LOGIC ---

        if (project.Active_Agent === 'QA (Analise)') {
            console.log(`[HIVE-DEBUG] Auditoria de QA para ${project.Title}...`);

            // Detecta ciclo de auto-avaliação para dar contexto real ao QA
            let evalInfo = null;
            try {
                const specs = JSON.parse(project.Technical_Specs || '{}');
                if (specs.evalLevel) evalInfo = specs;
            } catch(e) {}

            let qaMessage;
            if (evalInfo) {
                const allFiles = getMetaFileContext('', true);
                qaMessage = `Você é o QA do sistema DIYAPP.
Analise os arquivos REAIS abaixo em busca de bugs DO NÍVEL ${evalInfo.evalLabel}:
${evalInfo.evalDesc}

${allFiles}

REGRAS:
1. Baseie-se APENAS no código acima. NÃO invente problemas.
2. Se não houver bugs verificáveis neste nível, responda EXATAMENTE: [STATUS: CLEAN]
3. Se houver, liste apenas os REAIS, com arquivo e localização exata.`;
            } else {
                qaMessage = `ANALISE DE CICLO: O projeto "${project.Title}" terminou sua sprint. Verifique se há bugs residuais concretos. Se estiver tudo correto, responda exatamente "[STATUS: CLEAN]". Se houver bugs, liste-os com arquivo e localização.`;
            }

            const aiResult = await aiService.getSmartResponse({
                role: 'QA Auditor', roleFile: 'qa_instruction.html', message: qaMessage
            });
            // QA não deve usar [FILE:] ou [PATCH:] — remover se vier na resposta
            aiResult.reply = aiResult.reply.replace(/\[FILE:[^\]]+\][\s\S]+?\[\/FILE\]/g, '').replace(/\[PATCH:[^\]]+\][\s\S]+?\[\/PATCH\]/g, '').trim();
            console.log(`[QA] Resposta: ${aiResult.reply.substring(0, 80)}...`);

            auditTrail.log({
                projectId: project.Id,
                projectTitle: project.Title,
                phase: 'QA',
                actor: 'QA (Analise)',
                action: 'Auditoria de qualidade do ciclo',
                result: aiResult.reply.includes('[STATUS: CLEAN]') ? 'OK' : 'FAIL',
                detail: aiResult.reply.substring(0, 200)
            });

            if (aiResult.reply.includes('[STATUS: CLEAN]')) {
                // Antes de aceitar CLEAN: verificar se algo foi realmente escrito no staging
                const stagingPath = path.join(__dirname, '../data/staging', project.Id.toString());
                const stagingFiles = fs.existsSync(stagingPath)
                    ? fs.readdirSync(stagingPath).filter(f => !f.startsWith('.'))
                    : [];
                const tasks = getLocalBacklog(project) || [];
                const failedTasks = tasks.filter(t => t.status === 'FAILED');
                const doneTasks = tasks.filter(t => t.status === 'DONE');

                // Se havia tarefas mas nenhuma foi concluída com sucesso → não aceitar CLEAN
                if (tasks.length > 0 && doneTasks.length === 0 && stagingFiles.length === 0) {
                    const MAX_RETRIES = 2;
                    const abandonedTasks = tasks.filter(t => t.status === 'FAILED' && (t.retries || 0) >= MAX_RETRIES);
                    if (abandonedTasks.length === tasks.length) {
                        // Todas as tarefas foram permanentemente abandonadas — não resetar (evita loop infinito)
                        console.error(`[QA-GUARD] ❌ Todas as ${abandonedTasks.length} tarefa(s) foram ABANDONADAS após ${MAX_RETRIES} tentativas cada. Encerrando sprint sem deploy.`);
                        await store.updateProject(project.Id, {
                            Status: 'DONE',
                            Active_Agent: null,
                            LogEntry: `[QA-GUARD] Sprint encerrada — todas as tarefas foram abandonadas após ${MAX_RETRIES} tentativas sem sucesso. Verifique os logs de erro dos agentes.`
                        });
                        return;
                    }
                    console.warn(`[QA-GUARD] ⚠️ QA disse CLEAN mas NENHUMA tarefa foi concluída e staging está vazio. Resetando sprint.`);
                    tasks.forEach(t => { if (t.status !== 'FAILED' || (t.retries || 0) < MAX_RETRIES) { t.status = 'PENDING'; t.retries = 0; delete t.failReason; } });
                    saveLocalBacklog(project.Id, tasks);
                    await store.updateProject(project.Id, {
                        Active_Agent: 'Sprint Ativa (HIVE)',
                        LogEntry: `[QA-GUARD] Sprint resetada — agentes não produziram mudanças reais. Retentando com novo ciclo.`
                    });
                    return;
                }

                // Ciclo limpo → se for auto-avaliação, avança o nível e vai para DEPLOY (não DONE direto)
                if (evalInfo) {
                    // Avança o nível AGORA para o próximo ciclo já ser criado corretamente
                    const nextLevel = evalInfo.evalLevel + 1;
                    if (nextLevel <= EVAL_LEVELS.length) {
                        saveEvalLevel(nextLevel);
                        console.log(`[EVAL] Nível ${evalInfo.evalLabel} concluído. Próximo: ${EVAL_LEVELS[nextLevel - 1].label}`);
                    } else {
                        saveEvalLevel(1);
                        console.log('[EVAL] Todos os níveis concluídos. Reiniciando ciclo.');
                    }
                    // Vai para deploy para que as mudanças do staging cheguem à produção via PR
                    const nextStatusQA = isStepByStepEnabled() ? 'AWAITING_STEP_APPROVAL' : 'APPROVED_FOR_DEPLOY';
                    await store.updateProject(project.Id, {
                        Status: nextStatusQA,
                        LogEntry: `[EVAL] Nível ${evalInfo.evalLabel} auditado. ${nextStatusQA === 'AWAITING_STEP_APPROVAL' ? 'Aguardando autorização para deploy.' : 'Enviando mudanças para PR de revisão.'}`
                    });
                } else {
                    const nextStatusQA2 = isStepByStepEnabled() ? 'AWAITING_STEP_APPROVAL' : 'IN_PROGRESS';
                    await store.updateProject(project.Id, {
                        Status: nextStatusQA2,
                        Active_Agent: 'Inovação',
                        LogEntry: `[QA] Estabilidade confirmada. ${nextStatusQA2 === 'AWAITING_STEP_APPROVAL' ? 'Passo concluído. Aguardando autorização para Inovação.' : 'Solicitando propostas de evolução...'}`
                    });
                }
            } else {
                const newTasks = parseBacklogFromReply(aiResult.reply);
                if (newTasks.length > 0) {
                    saveLocalBacklog(project.Id, newTasks);
                    await store.updateProject(project.Id, {
                        Active_Agent: 'Sprint Ativa (HIVE)',
                        Backlog: JSON.stringify(newTasks),
                        LogEntry: '[QA] Bugs detectados. Iniciando sprint de correção.'
                    });
                } else {
                    // QA respondeu em texto livre sem tarefas estruturadas — verificar se algo foi feito
                    const stagingPath2 = path.join(__dirname, '../data/staging', project.Id.toString());
                    const stagingFiles2 = fs.existsSync(stagingPath2)
                        ? fs.readdirSync(stagingPath2).filter(f => !f.startsWith('.'))
                        : [];
                    const tasks2 = getLocalBacklog(project) || [];
                    const doneTasks2 = tasks2.filter(t => t.status === 'DONE');

                    if (tasks2.length > 0 && doneTasks2.length === 0 && stagingFiles2.length === 0) {
                        const MAX_RETRIES2 = 2;
                        const abandoned2 = tasks2.filter(t => t.status === 'FAILED' && (t.retries || 0) >= MAX_RETRIES2);
                        if (abandoned2.length === tasks2.length) {
                            console.error(`[QA-GUARD] ❌ Todas as tarefas abandonadas definitivamente. Encerrando sprint.`);
                            await store.updateProject(project.Id, {
                                Status: 'DONE',
                                Active_Agent: null,
                                LogEntry: `[QA-GUARD] Sprint encerrada — todas as tarefas abandonadas após ${MAX_RETRIES2} tentativas.`
                            });
                            return;
                        }
                        console.warn('[QA-GUARD] ⚠️ QA sem estrutura e staging vazio. Resetando sprint.');
                        tasks2.forEach(t => { if (t.status !== 'FAILED' || (t.retries || 0) < MAX_RETRIES2) { t.status = 'PENDING'; t.retries = 0; delete t.failReason; } });
                        saveLocalBacklog(project.Id, tasks2);
                        await store.updateProject(project.Id, {
                            Active_Agent: 'Sprint Ativa (HIVE)',
                            LogEntry: '[QA-GUARD] Sprint resetada — nenhuma mudança real detectada. Retentando.'
                        });
                    } else {
                        console.warn('[QA] Resposta sem tarefas estruturadas. Tratando como CLEAN.');
                        if (evalInfo) {
                            const nextLevel = evalInfo.evalLevel + 1;
                            if (nextLevel <= EVAL_LEVELS.length) saveEvalLevel(nextLevel);
                            else saveEvalLevel(1);
                            await store.updateProject(project.Id, { Status: 'APPROVED_FOR_DEPLOY', LogEntry: '[QA] Ciclo encerrado. Enviando staging para PR de revisão.' });
                        } else {
                            await store.updateProject(project.Id, { Status: 'DONE', Active_Agent: null, LogEntry: '[QA] Ciclo encerrado. Nenhum bug estruturado encontrado.' });
                        }
                    }
                }
            }
        } else if (project.Active_Agent === 'Inovação') {
            // Apenas para projetos NÃO-avaliação (criados pelo usuário)
            console.log(`[HIVE-DEBUG] Agente de Inovação para ${project.Title}...`);
            const aiResult = await aiService.getSmartResponse({
                role: 'Estrategista de Inovação',
                roleFile: 'inovacao_produto_instruction.html',
                message: `MELHORIA CONTÍNUA: O projeto "${project.Title}" está estável. Proponha 1 a 2 melhorias técnicas ou de UX concretas. Formate como lista de tarefas para a squad.`
            });

            const improvementTasks = parseBacklogFromReply(aiResult.reply);
            if (improvementTasks.length > 0) {
                saveLocalBacklog(project.Id, improvementTasks);
                await store.updateProject(project.Id, {
                    Active_Agent: 'Product Owner',
                    Status: 'AWAITING_APPROVAL',
                    Backlog: JSON.stringify(improvementTasks),
                    LogEntry: '[INOVAÇÃO] Melhorias propostas. Aguardando aprovação para nova sprint.'
                });
            } else {
                await store.updateProject(project.Id, { Status: 'DONE', Active_Agent: null, LogEntry: '[INOVAÇÃO] Nenhuma melhoria identificada. Projeto finalizado.' });
            }
        }
    } catch (e) { 
        console.error('[Orchestrator] Erro no ciclo:', e.message); 
    } finally {
        const end = Date.now();
        lastCycleMetrics.duration = end - start;
        lastCycleMetrics.latency = lastCycleMetrics.duration;
        lastCycleMetrics.status = 'IDLE';
    }
}

async function advanceProjectHive(project) {
    const isMeta = project.Title.toUpperCase().includes('DIYAPP');
    // 1. If PO is active, check if we already have work.
    const existingTasks = getLocalBacklog(project);
    
    if (project.Active_Agent === 'Product Owner') {
        if (existingTasks && existingTasks.length > 0) {
            console.log(`[LOCKDOWN] Projeto ${project.Title} já possui backlog local. Saltando PO para evitar reset.`);
            await store.updateProject(project.Id, { Active_Agent: 'Sprint Ativa (HIVE)' });
            return;
        }

        let metaContext = '';
        let poMessage = '';

        // Detecta se é um ciclo de auto-avaliação
        let evalInfo = null;
        try {
            const specs = JSON.parse(project.Technical_Specs || '{}');
            if (specs.evalLevel) evalInfo = specs;
        } catch(e) {}

        if (isMeta && evalInfo) {
            // MODO AUTO-AVALIAÇÃO: lê todos os arquivos e gera backlog por nível de complexidade
            const allFiles = getMetaFileContext('', true);
            poMessage = `Você é o Product Owner do sistema DIYAPP.
Analise os arquivos REAIS da plataforma abaixo e identifique problemas DO NÍVEL: ${evalInfo.evalLabel}.

DEFINIÇÃO DO NÍVEL ${evalInfo.evalLabel}:
${evalInfo.evalDesc}

${allFiles}

REGRAS CRÍTICAS:
1. Crie EXATAMENTE 1 tarefa concreta e verificável para este nível.
2. Cada tarefa DEVE referenciar: arquivo exato + seletor CSS / ID HTML / nome de função.
3. NÃO invente problemas. Baseie-se apenas no código acima.
4. Se não houver problemas reais neste nível, crie 1 tarefa de melhoria pequena.
5. Tarefas devem ser do agente "Frontend" (HTML/CSS) ou "Backend" (JS/server).

Exemplo de tarefa CORRETA: {"agent": "Frontend", "desc": "Em index.html, o modal #modal-staging está sem classe CSS 'modal' no elemento raiz, adicionar class='modal' ao div id='modal-staging'"}
Exemplo de tarefa ERRADA: {"agent": "Frontend", "desc": "Melhorar a UI geral"}

Retorne APENAS JSON: [BACKLOG: {"tasks": [{"agent": "...", "desc": "..."}]}]`;
        } else if (isMeta) {
            // MODO META-EVOLUÇÃO normal (projeto criado pelo usuário)
            const fileContext = getMetaFileContext(project.Project_Goal + ' ' + project.Technical_Specs);
            metaContext = `\n[META-EVOLUÇÃO — CONTEXTO DO SISTEMA]:
Este projeto modifica os arquivos EXISTENTES da plataforma DIYAPP.
NÃO é React. É HTML/CSS/JS puro.
Crie tarefas que referenciem os arquivos e seletores REAIS.

REGRAS CRÍTICAS:
1. A tarefa DEVE ser cirúrgica: referenciar o arquivo exato + seletor/bloco exato que muda.
2. Para mudanças visuais (cores, tema, modo claro): use "agent": "Frontend" e modifique style.css usando [PATCH: style.css] com <<<SEARCH>>>...<<<REPLACE>>>.
3. Para light mode/tema claro: adicione variáveis CSS no :root e uma classe .light-mode no body. Use o seletor exato já presente no arquivo.
4. NÃO use [FILE:] para arquivos que já existem. Use [PATCH:] com SEARCH/REPLACE cirúrgico.
5. O trecho SEARCH deve ser copiado EXATAMENTE do arquivo mostrado abaixo.

${fileContext}`;
            poMessage = `PROJETO: "${project.Title}"
OBJETIVO: ${project.Project_Goal}
ESCOPO: ${project.Technical_Specs}
${metaContext}
TAREFA: Crie o BACKLOG com EXATAMENTE 1 tarefa CIRÚRGICA e DIRETA. Apenas uma. Não mais.
A tarefa deve ser específica o suficiente para que o agente saiba exatamente qual trecho do arquivo modificar.
Retorne JSON: [BACKLOG: {"tasks": [{"agent": "Frontend", "desc": "..."}]}]`;
        } else {
            // PROJETO EXTERNO (cria software novo)
            poMessage = `PROJETO: "${project.Title}"
OBJETIVO: ${project.Project_Goal}
ESCOPO: ${project.Technical_Specs}
TAREFA: Crie o BACKLOG com EXATAMENTE 1 tarefa para construir este software. Apenas uma tarefa por vez.
Retorne JSON: [BACKLOG: {"tasks": [{"agent": "Backend", "desc": "..."}]}]`;
        }

        const aiResult = await aiService.getSmartResponse({
            role: 'Product Owner',
            roleFile: 'po_instruction.html',
            message: poMessage
        });

        const tasks = extractTasksFromReply(aiResult.reply).slice(0, 1); // HARD LIMIT: 1 tarefa por vez
        if (tasks && tasks.length > 0) {
            const stamped = tasks.map(t => ({ ...t, status: 'PENDING' }));
            saveLocalBacklog(project.Id, stamped);
            console.log(`[GOVERNANÇA] Backlog extraído: ${stamped.length} tarefa(s). Bloqueando para revisão.`);

            auditTrail.log({
                projectId: project.Id,
                projectTitle: project.Title,
                phase: 'PLANEJAMENTO',
                actor: 'PO',
                action: `Backlog criado com ${stamped.length} tarefa(s)`,
                result: 'OK',
                detail: stamped.map(t => `[${t.agent}] ${t.desc?.substring(0, 100)}`).join(' | ')
            });

            const nextStatus = isStepByStepEnabled() ? 'AWAITING_STEP_APPROVAL' : 'AWAITING_APPROVAL';
            await store.updateProject(project.Id, {
                Backlog: JSON.stringify(stamped),
                Status: nextStatus,
                Active_Agent: 'Aprovador',
                LogEntry: `[GOVERNANÇA] Planejamento concluído e retido para revisão soberana. (${stamped.length} tarefa(s))`
            });
            return;
        } else {
            console.error('[PO] Não foi possível extrair tarefas da resposta do PO. Tentando novamente no próximo tick.');
            auditTrail.log({
                projectId: project.Id,
                projectTitle: project.Title,
                phase: 'PLANEJAMENTO',
                actor: 'PO',
                action: 'Falha ao extrair tarefas da resposta',
                result: 'FAIL',
                detail: `Resposta recebida (primeiros 150 chars): ${aiResult.reply.substring(0, 150)}`
            });
        }
    }

    // 2. Sprint Handling (Parallelism)
    // Check local memory first, fallback to DB
    let tasks = getLocalBacklog(project);
    if (!tasks && project.Backlog) {
        try { tasks = JSON.parse(project.Backlog); } catch(e) { tasks = []; }
    }

    if (tasks && project.Active_Agent === 'Sprint Ativa (HIVE)') {
        const MAX_RETRIES = 2;
        const pendingTasks = tasks.filter(t =>
            t.status === 'PENDING' ||
            (t.status === 'FAILED' && (t.retries || 0) < MAX_RETRIES)
        ).slice(0, 1);

        if (pendingTasks.length > 0) {
            console.log(`[HIVE] Executando 1 tarefa por vez para o projeto ${project.Title}...`);

            // 2.1 Sequential execution — 1 task per tick to avoid file conflicts
            const sprintResults = [];
            for (const task of pendingTasks) { sprintResults.push(await (async (task) => {
                const isRetry = task.status === 'FAILED';
                if (isRetry) {
                    task.retries = (task.retries || 0) + 1;
                    console.warn(`[RETRY] Tentativa ${task.retries}/${MAX_RETRIES} para: ${task.desc?.substring(0, 60)}`);
                }

                let metaContext = '';
                if (isMeta) {
                    const fileContext = getMetaFileContext(task.desc + ' ' + project.Project_Goal);

                    const failReason = task.failReason ? `\nMotivo do FAIL: ${task.failReason}` : '';
                    const retryWarning = isRetry ? `
⚠️ ATENÇÃO CRÍTICA — TENTATIVA ${task.retries}/${MAX_RETRIES}:
Esta tarefa FALHOU na tentativa anterior. O Verificador de Código inspecionou o arquivo após seu patch e rejeitou.${failReason}

REGRA ABSOLUTA DESTA TENTATIVA:
1. Copie o trecho EXATO do arquivo mostrado abaixo (sem alterar espaços/tabs).
2. Coloque-o no <<<SEARCH>>>.
3. Coloque o código novo no <<<REPLACE>>>.
4. NÃO escreva explicações. APENAS o bloco [PATCH:].
` : '';

                    // Peça 3: injetar inventário DOM quando a tarefa envolve JS
                    let domContractContext = '';
                    const taskInvolvesJS = /app\.js|javascript|função|switchview|render|getelementbyid|queryselector|dom|view-|nav-/i.test(task.desc);
                    if (taskInvolvesJS) {
                        const inventory = getDOMInventory();
                        if (inventory && inventory.all.length > 0) {
                            domContractContext = `
[CONTRATO DOM — OBRIGATÓRIO]:
Os únicos IDs que existem no index.html são listados abaixo.
NÃO use nenhum ID que não esteja nesta lista em getElementById(), querySelectorAll() ou switchView().

  Views (divs de tela): ${(inventory.views || []).join(', ')}
  Nav (itens do menu):  ${(inventory.nav  || []).join(', ')}
  Todos os IDs:         ${inventory.all.join(', ')}

Se a tarefa pede para referenciar uma view/nav inexistente, use o ID correto da lista acima.
`;
                        }
                    }

                    metaContext = `\n[INSTRUÇÕES DE MODIFICAÇÃO CIRÚRGICA]:${retryWarning}
Você está modificando arquivos EXISTENTES do sistema DIYAPP.
NÃO é React. É HTML/CSS/JS puro.

FORMATO OBRIGATÓRIO para modificar um arquivo existente:
[PATCH: nome_do_arquivo]
<<<SEARCH>>>
trecho EXATO do arquivo original que deve ser substituído
<<<REPLACE>>>
novo trecho que substitui o anterior
[/PATCH]

Você pode ter múltiplos blocos <<<SEARCH>>>...<<<REPLACE>>> dentro de um [PATCH:].
Use [FILE: nome] ... [/FILE] APENAS para criar arquivos NOVOS que não existem ainda.
NÃO retorne o arquivo inteiro. APENAS o trecho que muda.
${domContractContext}
${fileContext}`;
                }

                const taskMessage = isMeta
                    ? `PROJETO: "${project.Title}"\nTAREFA: ${task.desc}\n${metaContext}`
                    : `PROJETO: "${project.Title}"\nTAREFA: ${task.desc}\nRetorne os arquivos usando [FILE: nome] ... [/FILE].`;

                const aiResult = await aiService.getSmartResponse({
                    role: task.agent,
                    roleFile: getRoleFile(task.agent),
                    message: taskMessage
                });

                if (aiResult.provider === 'none') {
                    console.error(`[CRÍTICO] Todos os provedores falharam para o agente ${task.agent}`);
                }

                const { count: patchCount, changedFiles } = processPatches(project.Id, aiResult.reply, project.Title);
                const fileCount = processFiles(project.Id, aiResult.reply, project.Title);
                const cmdCount = processCommands(project.Id, aiResult.reply, project.Title);
                const tokenGain = (aiResult.reply.length * 2);

                // Peça 4: validação DOM-CONTRACT pós-patch — rejeita patches JS com IDs inválidos
                if (isMeta && changedFiles.some(f => f.endsWith('.js'))) {
                    const domInventory = getDOMInventory();
                    if (domInventory) {
                        const stagingBasePath = path.join(__dirname, '../data/staging', project.Id.toString());
                        const rootBasePath = path.join(__dirname, '..');
                        const violations = [];
                        for (const jsFile of changedFiles.filter(f => f.endsWith('.js'))) {
                            const staged = path.join(stagingBasePath, jsFile);
                            const src = fs.existsSync(staged) ? staged : path.join(rootBasePath, jsFile);
                            if (fs.existsSync(src)) {
                                const jsContent = fs.readFileSync(src, 'utf8');
                                const missing = validateDOMReferences(jsContent, domInventory);
                                if (missing.length > 0) {
                                    violations.push(`${jsFile} referencia IDs inexistentes: ${missing.join(', ')}`);
                                }
                            }
                        }
                        if (violations.length > 0) {
                            console.error(`[DOM-CONTRACT] ❌ Violações:\n  ${violations.join('\n  ')}`);
                            // Reverte arquivos JS do staging
                            for (const jsFile of changedFiles.filter(f => f.endsWith('.js'))) {
                                const staged = path.join(stagingBasePath, jsFile);
                                if (fs.existsSync(staged)) { fs.unlinkSync(staged); console.error(`[DOM-CONTRACT] Revertido: ${jsFile}`); }
                            }
                            // Remove arquivos JS da lista de mudanças válidas
                            const validViews = (domInventory.views || []).join(', ');
                            task.failReason = `DOM-CONTRACT: ${violations.join('; ')}. Views válidas: ${validViews}`;
                            changedFiles.splice(0, changedFiles.length, ...changedFiles.filter(f => !f.endsWith('.js')));
                        }
                    }
                }

                // VERIFICAÇÃO HUMANA POR IA: confirma que a mudança descrita está de fato no arquivo
                let verifiedFiles = [...changedFiles];
                if (changedFiles.length > 0 && isMeta) {
                    const stagingPath = path.join(__dirname, '../data/staging', project.Id.toString());
                    const rootPath = path.join(__dirname, '..');

                    let fileContents = '';
                    for (const fname of changedFiles) {
                        const staged = path.join(stagingPath, fname);
                        const src = fs.existsSync(staged) ? staged : path.join(rootPath, fname);
                        if (fs.existsSync(src)) {
                            const content = fs.readFileSync(src, 'utf8');
                            fileContents += `\n=== ${fname} ===\n${content.substring(0, 4000)}\n=== FIM DE ${fname} ===\n`;
                        }
                    }

                    // Peça 5: incluir inventário DOM no Verificador para tarefas JS
                    const domForVerifier = changedFiles.some(f => f.endsWith('.js')) ? (() => {
                        const inv = getDOMInventory();
                        return inv ? `\n[DOM INVENTORY — IDs existentes no index.html]:\n  Views: ${(inv.views||[]).join(', ')}\n  Nav: ${(inv.nav||[]).join(', ')}\n  Todos: ${inv.all.join(', ')}\nAlém de verificar a mudança descrita, confirme que nenhum getElementById() ou switchView() referencia um ID fora desta lista.\n` : '';
                    })() : '';

                    const verifyMsg = `TAREFA QUE DEVERIA TER SIDO EXECUTADA:
${task.desc}
${domForVerifier}
ARQUIVO(S) APÓS A MODIFICAÇÃO:
${fileContents}

Verifique se a mudança descrita na TAREFA está presente nos arquivos acima.`;

                    const verifyResult = await aiService.getSmartResponse({
                        role: 'Verificador de Código',
                        roleFile: 'verificador_codigo_instruction.html',
                        message: verifyMsg
                    });

                    const verdict = verifyResult.reply.match(/\[VERIFIED:\s*(PASS|FAIL[^\]]*)\]/i);
                    if (!verdict || verdict[1].toUpperCase().startsWith('FAIL')) {
                        const reason = verdict ? verdict[1] : 'sem veredito estruturado';
                        console.error(`[VERIFIER] ❌ Verificação FALHOU para [${task.agent}]: ${reason}`);
                        auditTrail.log({
                            projectId: project.Id,
                            projectTitle: project.Title,
                            phase: 'VERIFICAÇÃO',
                            actor: 'Verificador de Código',
                            action: `Revisão da tarefa [${task.agent}]: ${task.desc?.substring(0, 80)}`,
                            result: 'FAIL',
                            detail: `Veredito: ${reason.substring(0, 200)}`
                        });
                        for (const fname of changedFiles) {
                            const staged = path.join(stagingPath, fname);
                            if (fs.existsSync(staged)) {
                                fs.unlinkSync(staged);
                                console.error(`[VERIFIER] Revertido do staging: ${fname}`);
                            }
                        }
                        verifiedFiles = [];
                        task.failReason = reason;
                    } else {
                        console.log(`[VERIFIER] ✅ Verificado OK: ${changedFiles.join(', ')}`);
                        auditTrail.log({
                            projectId: project.Id,
                            projectTitle: project.Title,
                            phase: 'VERIFICAÇÃO',
                            actor: 'Verificador de Código',
                            action: `Revisão da tarefa [${task.agent}]: ${task.desc?.substring(0, 80)}`,
                            result: 'OK',
                            detail: `Arquivos validados: ${changedFiles.join(', ')}`
                        });
                    }
                }

                auditTrail.log({
                    projectId: project.Id,
                    projectTitle: project.Title,
                    phase: 'EXECUÇÃO',
                    actor: task.agent,
                    action: task.desc?.substring(0, 120),
                    result: (verifiedFiles.length > 0 || fileCount > 0 || cmdCount > 0) ? 'OK' : 'FAIL',
                    detail: verifiedFiles.length > 0
                        ? `Arquivos alterados: ${verifiedFiles.join(', ')}`
                        : (task.failReason ? `Motivo: ${task.failReason.substring(0, 150)}` : 'Nenhum arquivo alterado')
                });

                if (verifiedFiles.length > 0 || fileCount > 0 || cmdCount > 0) {
                    task.status = 'DONE';
                    // Evidence: record exactly which files changed and their current content snippet
                    const evidence = {
                        ts: new Date().toISOString(),
                        projectId: project.Id,
                        projectTitle: project.Title,
                        taskDesc: task.desc,
                        agent: task.agent,
                        filesChanged: changedFiles,
                        snippets: {}
                    };
                    const rootPathEv = path.join(__dirname, '..');
                    const stagingPathEv = path.join(__dirname, '../data/staging', project.Id.toString());
                    for (const f of changedFiles) {
                        const staged = path.join(stagingPathEv, f);
                        const prod = path.join(rootPathEv, f);
                        const src = fs.existsSync(staged) ? staged : (fs.existsSync(prod) ? prod : null);
                        if (src) {
                            const txt = fs.readFileSync(src, 'utf8');
                            evidence.snippets[f] = txt.substring(0, 800);
                        }
                    }
                    task.evidence = evidence;
                    // Append to evidence log
                    try {
                        const evPath = path.join(__dirname, '../data/evidence_log.json');
                        let evLog = [];
                        try { evLog = JSON.parse(fs.readFileSync(evPath, 'utf8')); } catch(_) {}
                        evLog.unshift(evidence);
                        if (evLog.length > 200) evLog = evLog.slice(0, 200);
                        fs.writeFileSync(evPath, JSON.stringify(evLog, null, 2));
                    } catch(evErr) { console.warn('[EVIDENCE] Falha ao salvar log:', evErr.message); }
                    console.log(`[EVIDENCE] ✅ [${task.agent}] "${task.desc?.substring(0,60)}" → ${changedFiles.join(', ')}`);
                    if (isRetry) console.log(`[RETRY] ✅ Sucesso na tentativa ${task.retries}: ${task.desc?.substring(0, 60)}`);
                } else {
                    task.status = 'FAILED';
                    if ((task.retries || 0) >= MAX_RETRIES) {
                        console.error(`[HONESTY] ❌ Tarefa ABANDONADA após ${MAX_RETRIES} tentativas — [${task.agent}]: ${task.desc?.substring(0, 80)}`);
                    } else {
                        console.error(`[HONESTY] ❌ Tarefa FAILED — [${task.agent}]: ${task.desc?.substring(0, 80)}`);
                    }
                }

                return {
                    agent: task.agent,
                    tokens: tokenGain,
                    provider: aiResult.provider,
                    patchCount,
                    changedFiles,
                    fileCount,
                    cmdCount,
                    content: aiResult.reply
                };
            })(task)); }

            // 2.2 Consolidate all results
            let totalGain = 0;
            let breakdown = { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 };
            let consolidatedLogs = [];

            sprintResults.forEach(res => {
                totalGain += res.tokens;
                const realWork = res.changedFiles && res.changedFiles.length > 0
                    ? `ESCREVEU: ${res.changedFiles.join(', ')}`
                    : (res.fileCount > 0 ? `${res.fileCount} arquivo(s) novo(s)` : 'NADA ESCRITO ⚠️');
                consolidatedLogs.push(`[${res.agent}] ${realWork} — ${res.tokens}tk`);
                appendDoc(project.Id, `### [Sessão Paralela: ${res.agent}]\n${res.content}`);
                
                // Track breakdown locally for the update
                const prov = res.provider.toLowerCase();
                let matched = 'deepseek';
                if (prov.includes('mistral')) matched = 'mistral';
                if (prov.includes('gemini') || prov.includes('google')) matched = 'gemini';
                if (prov.includes('gpt') || prov.includes('openai')) matched = 'openai';
                if (prov.includes('claude') || prov.includes('anthropic')) matched = 'claude';
                breakdown[matched] += res.tokens;

                // NEW: Persistent Billing Registry
                billing.registerTokens(project.Id, project.Title, res.provider, res.tokens);
            });

            // 2.3 Single Atomic Update
            // SAVE LOCALLY (Always update memory)
            saveLocalBacklog(project.Id, tasks);

            const nextStatusHive = (isStepByStepEnabled() && consolidatedLogs.length > 0) ? 'AWAITING_STEP_APPROVAL' : 'IN_PROGRESS';
            await store.updateProject(project.Id, { 
                Backlog: JSON.stringify(tasks),
                Tokens: (project.Tokens || 0) + totalGain,
                TokenAmount: totalGain,
                Status: nextStatusHive,
                LogEntry: (nextStatusHive === 'AWAITING_STEP_APPROVAL') 
                    ? `[GOVERNANÇA] Passo concluído: ${consolidatedLogs.join(' | ')}. Aguardando aprovação para o próximo.`
                    : `SQUAD EM AÇÃO: ${consolidatedLogs.join(' | ')}`
            });

        } else {
            // BACKLOG FINISHED -> but check for permanently abandoned tasks first
            const tasks = getLocalBacklog(project);
            const abandoned = tasks.filter(t => t.status === 'FAILED' && (t.retries || 0) >= MAX_RETRIES);
            if (abandoned.length > 0) {
                console.warn(`[HIVE] Sprint encerrada com ${abandoned.length} tarefa(s) ABANDONADA(S) após ${MAX_RETRIES} tentativas:`);
                abandoned.forEach(t => console.warn(`  ❌ [${t.agent}] ${t.desc?.substring(0, 80)}`));
            }
            console.log(`[HIVE] Sprint concluída para "${project.Title}". Iniciando ciclo de Melhoria Contínua.`);
            await store.updateProject(project.Id, {
                Active_Agent: 'QA (Analise)',
                LogEntry: `[MELHORIA CONTÍNUA] Sprint encerrada. ${abandoned.length > 0 ? `⚠️ ${abandoned.length} tarefa(s) não executada(s). ` : ''}Solicitando auditoria ao QA...`
            });
        }
        return;
    } else if (project.Active_Agent === 'Sprint Ativa (HIVE)') {
        // ERROR STATE: Project thinks it's Hive but has no tasks. Re-trigger PO.
        console.warn(`[HIVE] Projeto ${project.Title} travado sem Backlog. Re-chamando PO.`);
        await store.updateProject(project.Id, { Active_Agent: 'Product Owner', LogEntry: '[HIVE] Memória perdida. Re-chamando PO para recalibrar.' });
    }

    // 3. Final Step (SRE) if not in Backlog mode
    if (project.Active_Agent === 'SRE') {
        const aiResult = await aiService.getSmartResponse({
            role: 'SRE',
            roleFile: 'sre_instruction.html',
            message: `O software "${project.Title}" está pronto. Faça o polimento final, configure o index.html principal e garanta que tudo funcione 24/7.`
        });
        
        if (isMeta) {
            console.log(`[GOVERNANÇA] Meta-Deploy Pendente: ${project.Title}. Bloqueando fábrica.`);
            await store.updateProject(project.Id, { 
                Status: 'AWAITING_APPROVAL', 
                LogEntry: '[GOVERNANÇA] Evolução Gerada em Staging. Fábrica em LOCKDOWN até sua aprovação.' 
            });
            return;
        }

        await store.updateProject(project.Id, { Status: 'DONE', Active_Agent: null, LogEntry: '[SRE] Projeto finalizado e implantado!🚀' });
    }
}

async function deployMetaChanges(projectId) {
    console.log(`[META-DEPLOY] Iniciando Auto-Implantação Autônoma para projeto ${projectId}...`);
    const stagingPath = path.join(__dirname, '../data/staging', projectId.toString());
    const rootPath = path.join(__dirname, '..');

    if (!fs.existsSync(stagingPath)) return;

    const files = fs.readdirSync(stagingPath);
    let deployedCount = 0;
    let blockedCount = 0;

    for (const file of files) {
        const src = path.join(stagingPath, file);
        const dest = path.join(rootPath, file);
        const stagedContent = fs.readFileSync(src, 'utf8');
        const ext = path.extname(file).toLowerCase();

        // --- Guard 1: Size check (60% threshold - relaxed) ---
        if (fs.existsSync(dest)) {
            const currentSize = fs.statSync(dest).size;
            const stagedSize = fs.statSync(src).size;

            if (currentSize > 1000 && stagedSize < currentSize * 0.6) {
                console.error(`[META-DEPLOY] ❌ BLOQUEADO [TAMANHO]: ${file} — staged é ${Math.round(stagedSize / currentSize * 100)}% do original. Possível sobrescrita parcial.`);
                blockedCount++;
                continue;
            }
        }

        // --- Guard 2: HTML structure validation ---
        if (ext === '.html') {
            const missingStructure = [];
            if (!stagedContent.includes('<!DOCTYPE') && !stagedContent.includes('<!doctype')) missingStructure.push('DOCTYPE');
            if (!stagedContent.includes('<html')) missingStructure.push('<html>');
            if (!stagedContent.includes('<body')) missingStructure.push('<body>');
            if (!stagedContent.includes('sidebar') && !stagedContent.includes('nav')) missingStructure.push('sidebar/nav');
            if (missingStructure.length > 0) {
                console.error(`[META-DEPLOY] ❌ BLOQUEADO [HTML]: ${file} — estrutura incompleta, faltando: ${missingStructure.join(', ')}`);
                blockedCount++;
                continue;
            }
        }

        // --- Guard 3: JS syntax check ---
        if (ext === '.js') {
            const tmpFile = path.join(stagingPath, `__check_${file}`);
            try {
                fs.writeFileSync(tmpFile, stagedContent, 'utf8');
                const { execSync } = require('child_process');
                execSync(`node --check "${tmpFile}"`, { stdio: 'pipe' });
                fs.unlinkSync(tmpFile);
            } catch (syntaxErr) {
                try { fs.unlinkSync(tmpFile); } catch (_) {}
                console.error(`[META-DEPLOY] ❌ BLOQUEADO [SINTAXE JS]: ${file} — erro de sintaxe detectado: ${syntaxErr.stderr ? syntaxErr.stderr.toString().split('\n')[0] : syntaxErr.message}`);
                blockedCount++;
                continue;
            }
        }

        // --- Guard 4: CSS balanced braces check ---
        if (ext === '.css') {
            const opens = (stagedContent.match(/\{/g) || []).length;
            const closes = (stagedContent.match(/\}/g) || []).length;
            if (opens !== closes) {
                console.error(`[META-DEPLOY] ❌ BLOQUEADO [CSS]: ${file} — chaves desbalanceadas (${opens} abre, ${closes} fecha)`);
                blockedCount++;
                continue;
            }
        }

        // All guards passed — backup and deploy
        if (fs.existsSync(dest)) {
            const backupDir = path.join(rootPath, 'backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
            fs.copyFileSync(dest, path.join(backupDir, `${file}.bak_${Date.now()}`));
        }

        fs.copyFileSync(src, dest);
        console.log(`[META-DEPLOY] ✅ Arquivo promovido: ${file}`);
        deployedCount++;

        // Peça 2 (deploy): index.html promovido → reconstruir inventário DOM
        if (file === 'index.html') rebuildDOMInventory();
    }

    if (deployedCount > 0) {
        console.log(`[META-DEPLOY] ${deployedCount} arquivo(s) implantado(s) com sucesso. ✨`);
    }
    if (blockedCount > 0) {
        console.warn(`[META-DEPLOY] ⚠️ ${blockedCount} arquivo(s) BLOQUEADO(s) por falha nos guards de segurança.`);
    }
    if (deployedCount === 0 && blockedCount === files.length) {
        throw new Error(`[META-DEPLOY] Todos os ${files.length} arquivo(s) staged foram rejeitados pelos guards. Deploy abortado.`);
    }
}

/**
 * Aplica blocos [PATCH: filename] ao arquivo existente.
 * Formato esperado dentro de cada bloco:
 *   <<<SEARCH>>>
 *   trecho exato a substituir
 *   <<<REPLACE>>>
 *   novo trecho
 *
 * Múltiplos SEARCH/REPLACE permitidos por bloco.
 * Retorna o número de patches aplicados com sucesso.
 */
function applyPatch(originalContent, patchContent) {
    const opRegex = /<<<SEARCH>>>([\s\S]+?)<<<REPLACE>>>([\s\S]+?)(?=<<<SEARCH>>>|$)/g;
    let result = originalContent;
    let applied = 0;
    let match;

    // Normaliza quebras de linha para busca consistente (\r\n -> \n)
    const normalize = (s) => s.replace(/\r\n/g, '\n');

    while ((match = opRegex.exec(patchContent)) !== null) {
        let search = match[1];
        let replace = match[2];

        // Remove apenas uma quebra de linha inicial/final se existir, mas preserva espaços/tabs
        search = search.replace(/^\n/, '').replace(/\n$/, '');
        replace = replace.replace(/^\n/, '').replace(/\n$/, '');

        if (!search) continue;

        const normalizedResult = normalize(result);
        const normalizedSearch = normalize(search);

        if (normalizedResult.includes(normalizedSearch)) {
            // Se as quebras de linha baterem exatamente no original, usa replace simples
            if (result.includes(search)) {
                result = result.replace(search, replace);
            } else {
                // Se as quebras de linha forem mistas (ex: \r\n no arquivo), usa regex para preservar estilo original
                const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n');
                result = result.replace(new RegExp(escapedSearch, 's'), replace);
            }
            applied++;
        } else {
            // Fallback: Tentativa com limpeza drástica apenas como último recurso
            const cleanResult = normalizedResult.replace(/[ \t]+/g, ' ');
            const cleanSearch = normalizedSearch.replace(/[ \t]+/g, ' ');

            if (cleanResult.includes(cleanSearch)) {
                console.log(`[PATCH] Aplicando fallback fuzzy para: "${search.substring(0, 30)}..."`);
                const escapedFuzzy = normalizedSearch
                    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\s+/g, '\\s+');
                result = result.replace(new RegExp(escapedFuzzy, 's'), replace);
                applied++;
            } else {
                console.warn(`[PATCH] SEARCH não encontrado no arquivo (mesmo com normalização): "${search.substring(0, 60).trim()}..."`);
            }
        }
    }
    return { content: result, applied };
}

// Verifica integridade do arquivo após patch. Retorna { ok, reason }.
function verifyFileIntegrity(fileName, content) {
    const ext = path.extname(fileName).toLowerCase();

    if (ext === '.js') {
        // Escreve em arquivo temp e roda node --check
        const tmpPath = path.join(require('os').tmpdir(), `squad_verify_${Date.now()}.js`);
        try {
            fs.writeFileSync(tmpPath, content, 'utf8');
            const result = shell.exec(`node --check "${tmpPath}"`, { silent: true });
            fs.unlinkSync(tmpPath);
            if (result.code !== 0) {
                return { ok: false, reason: `Erro de sintaxe JS: ${result.stderr.split('\n')[0]}` };
            }
        } catch (e) {
            try { fs.unlinkSync(tmpPath); } catch(_) {}
            return { ok: false, reason: `Falha na verificação: ${e.message}` };
        }
    }

    if (ext === '.html') {
        // Verifica tags obrigatórias e balanceamento básico
        const selfClosing = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
        const openTags = [];
        const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
        let m;
        while ((m = tagRegex.exec(content)) !== null) {
            const full = m[0];
            const tag = m[1].toLowerCase();
            if (selfClosing.includes(tag) || full.endsWith('/>')) continue;
            if (full.startsWith('</')) {
                if (openTags.length > 0 && openTags[openTags.length - 1] === tag) openTags.pop();
            } else {
                openTags.push(tag);
            }
        }
        if (openTags.length > 0) {
            return { ok: false, reason: `HTML com tags não fechadas: ${openTags.slice(-3).join(', ')}` };
        }
    }

    if (ext === '.css') {
        // Verifica chaves balanceadas
        let depth = 0;
        for (const ch of content) {
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            if (depth < 0) return { ok: false, reason: 'CSS com chaves desbalanceadas (} sem {)' };
        }
        if (depth !== 0) return { ok: false, reason: `CSS com ${depth} bloco(s) não fechado(s)` };
    }

    return { ok: true, reason: null };
}

// Extrai tarefas da resposta do PO com 4 estratégias de fallback.
// Nunca lança exceção — retorna [] se nada funcionar.
function extractTasksFromReply(text) {
    if (!text) return [];

    function sanitize(s) {
        return s
            .replace(/```json|```/g, '')
            .replace(/,\s*([}\]])/g, '$1')               // trailing commas
            .replace(/\n|\r/g, ' ')                       // newlines viram espaço
            .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')    // outros controles (menos \n tratado acima)
            .trim();
    }

    // Estratégia 1: [BACKLOG: {...}]
    try {
        const m = text.match(/\[BACKLOG:\s*({[\s\S]+?})\]/);
        if (m) {
            const data = JSON.parse(sanitize(m[1]));
            if (Array.isArray(data.tasks) && data.tasks.length > 0) return data.tasks;
        }
    } catch(_) {}

    // Estratégia 2: qualquer bloco {"tasks": [...]}
    try {
        const m = text.match(/\{\s*"tasks"\s*:\s*(\[[\s\S]+?\])\s*\}/);
        if (m) {
            const tasks = JSON.parse(sanitize(m[1]));
            if (Array.isArray(tasks) && tasks.length > 0) return tasks;
        }
    } catch(_) {}

    // Estratégia 3: extrai objetos {"agent":"...","desc":"..."} individualmente
    try {
        const tasks = [];
        // Pega cada objeto de tarefa — captura pares chave:valor sem depender de JSON.parse
        const objRegex = /\{[^{}]*"agent"\s*:\s*"([^"]+)"[^{}]*"desc"\s*:\s*"([^"]+)"[^{}]*\}/g;
        let m;
        while ((m = objRegex.exec(text)) !== null) {
            tasks.push({ agent: m[1].trim(), desc: m[2].trim() });
        }
        if (tasks.length > 0) return tasks;
    } catch(_) {}

    // Estratégia 4: linhas no formato - [Agente] Descrição
    try {
        const tasks = [];
        const lineRegex = /[-*]\s*\[([^\]]+)\]\s*(.+)/g;
        let m;
        while ((m = lineRegex.exec(text)) !== null) {
            tasks.push({ agent: m[1].trim(), desc: m[2].trim() });
        }
        if (tasks.length > 0) return tasks;
    } catch(_) {}

    console.error('[PO-PARSER] Todas as estratégias falharam. Resposta do PO:\n' + text.substring(0, 300));
    return [];
}

// Retorna { count, changedFiles[] } — só conta arquivos que REALMENTE mudaram no disco
function processPatches(projectId, text, projectTitle = '') {
    const patchRegex = /\[PATCH:\s*([^\]]+)\]([\s\S]+?)\[\/PATCH\]/g;
    const isMeta = projectTitle.toUpperCase().includes('DIYAPP');
    // Meta-projetos vão para staging (revisão humana via PR) — server.js e orchestrator.js são seguros
    // Projetos externos nunca tocam arquivos do root, mas mantemos a proteção por precaução
    const PROTECTED_FILES = isMeta
        ? ['.env', 'package.json', 'package-lock.json']
        : ['server.js', 'orchestrator.js', 'store.js', 'ai_service.js', 'package.json', '.env'];
    const rootPath = path.join(__dirname, '..');
    const changedFiles = [];
    let match;

    while ((match = patchRegex.exec(text)) !== null) {
        let rawFileName = match[1].trim().replace(/\*|`|\[|\]/g, '');
        const patchContent = match[2];

        if (PROTECTED_FILES.includes(rawFileName)) {
            console.error(`[PATCH-GUARD] Arquivo protegido, ignorado: ${rawFileName}`);
            continue;
        }

        const targetPath = isMeta
            ? path.join(rootPath, rawFileName)
            : path.join(__dirname, '../data/projects', projectId.toString(), 'src', rawFileName);

        if (!fs.existsSync(targetPath)) {
            console.warn(`[PATCH] ⚠️ Arquivo não existe no disco: ${rawFileName} — patch ignorado`);
            continue;
        }

        // Para meta-projetos: se já existe uma versão em staging, ler de lá (é o estado mais recente)
        const stagingFilePath = isMeta ? path.join(__dirname, '../data/staging', projectId.toString(), rawFileName) : null;
        const readFrom = (stagingFilePath && fs.existsSync(stagingFilePath)) ? stagingFilePath : targetPath;
        const original = fs.readFileSync(readFrom, 'utf8');
        const { content: patched, applied } = applyPatch(original, patchContent);

        if (applied === 0) {
            // IDEMPOTENCY CHECK: verifica se o conteúdo do REPLACE já está no arquivo.
            // Isso acontece quando o patch já foi aplicado em ciclo anterior mas a tarefa
            // foi marcada como FAILED (ex: verifier reverteu o staging, mas a produção já tinha o conteúdo).
            const replaceBlocks = [];
            const replRegex = /<<<SEARCH>>>[\s\S]+?<<<REPLACE>>>([\s\S]+?)(?=<<<SEARCH>>>|$)/g;
            let rm;
            while ((rm = replRegex.exec(patchContent)) !== null) {
                const repl = rm[1].replace(/^\n/, '').replace(/\n$/, '');
                if (repl) replaceBlocks.push(repl);
            }
            const alreadyApplied = replaceBlocks.length > 0 && replaceBlocks.every(repl =>
                original.includes(repl) || original.replace(/\r\n/g, '\n').includes(repl.replace(/\r\n/g, '\n'))
            );
            if (alreadyApplied) {
                console.log(`[PATCH] ✅ IDEMPOTENTE: ${rawFileName} já contém as mudanças — marcado como aplicado`);
                // Copia o arquivo atual para staging para que o verifier possa validar
                if (isMeta) {
                    const stagingPath = path.join(__dirname, '../data/staging', projectId.toString());
                    if (!fs.existsSync(stagingPath)) fs.mkdirSync(stagingPath, { recursive: true });
                    const stagingFile = path.join(stagingPath, rawFileName);
                    if (!fs.existsSync(stagingFile)) fs.copyFileSync(targetPath, stagingFile);
                }
                changedFiles.push(rawFileName);
            } else {
                console.warn(`[PATCH] ⚠️ Nenhum SEARCH encontrado em ${rawFileName} — arquivo NÃO mudou`);
            }
            continue;
        }

        // Verifica se o conteúdo realmente mudou (não apenas aplicado sem diferença)
        if (patched === original) {
            console.warn(`[PATCH] ⚠️ ${rawFileName}: patch aplicado mas conteúdo idêntico — ignorado`);
            continue;
        }

        // Verifica integridade antes de escrever — rejeita patches que quebram sintaxe
        const integrity = verifyFileIntegrity(rawFileName, patched);
        if (!integrity.ok) {
            console.error(`[PATCH] ❌ REJEITADO: ${rawFileName} — ${integrity.reason}. Arquivo NÃO modificado.`);
            continue;
        }

        if (isMeta) {
            const stagingPath = path.join(__dirname, '../data/staging', projectId.toString());
            if (!fs.existsSync(stagingPath)) fs.mkdirSync(stagingPath, { recursive: true });
            fs.writeFileSync(path.join(stagingPath, rawFileName), patched);
            console.log(`[PATCH] ✅ ${rawFileName}: ${applied} substituição(ões) → staging (verificado)`);
        } else {
            fs.writeFileSync(targetPath, patched);
            console.log(`[PATCH] ✅ ${rawFileName}: ${applied} substituição(ões) → projeto (verificado)`);
        }
        changedFiles.push(rawFileName);

        // Peça 2: se index.html mudou, reconstruir inventário DOM
        if (rawFileName === 'index.html') {
            // Em meta-projetos, o staging ainda não é produção — reconstruir do produção após deploy.
            // Mas se for escrita direta (não-meta), reconstruir agora.
            if (!isMeta) rebuildDOMInventory();
        }
    }
    return { count: changedFiles.length, changedFiles };
}

function processFiles(projectId, text, projectTitle = '') {
    // FIX: Regex corrigida para capturar o nome completo do arquivo.
    // A regex antiga (.+?)\]? capturava apenas 1 char do nome (ex: "s" de "style.css").
    // Nova regex: captura tudo entre [FILE: e ] como nome, depois o conteúdo até [/FILE].
    const fileRegex = /\[FILE:\s*([^\]]+)\]([\s\S]+?)\[\/FILE\]/g;
    let match;
    let count = 0;
    
    let isMeta = projectTitle.toUpperCase().includes('DIYAPP');

    // SYSTEM PROTECTION LIST
    // Meta-projetos vão para staging (revisado via PR), então server.js/orchestrator.js são seguros
    const PROTECTED_FILES = isMeta
        ? ['.env', 'package.json', 'package-lock.json']
        : ['server.js', 'orchestrator.js', 'store.js', 'ai_service.js', 'package.json', '.env'];

    let projectPath = path.join(__dirname, '../data/projects', projectId.toString(), 'src');

    if (isMeta) {
        // Em Modo Meta (Auto-Evolução), o código vai para Staging primeiro.
        const stagingPath = path.join(__dirname, '../data/staging', projectId.toString());
        if (!fs.existsSync(stagingPath)) fs.mkdirSync(stagingPath, { recursive: true });
        
        projectPath = stagingPath;
        console.log(`[HIVE-GUARD] Redirecionando evolução interna para: ${projectPath}`);
    }

    while ((match = fileRegex.exec(text)) !== null) {
        let rawFileName = match[1].trim();
        // Limpar possíveis caracteres de markdown do nome do arquivo
        rawFileName = rawFileName.replace(/\*|`|\[|\]/g, '');

        // META-GUARD: Bloqueia [FILE:] em arquivos que já existem na plataforma.
        // Agentes DEVEM usar [PATCH:] para modificar arquivos existentes.
        if (isMeta) {
            const existsInRoot = fs.existsSync(path.join(__dirname, '..', rawFileName));
            if (existsInRoot) {
                console.error(`[FILE-GUARD] ❌ BLOQUEADO: "${rawFileName}" já existe na plataforma. Use [PATCH:] para modificar arquivos existentes. [FILE:] rejeitado.`);
                continue;
            }
        }

        const filePath = path.join(projectPath, rawFileName);
        const content = match[2].trim();
        
        // SECURITY VALIDATION
        if (!security.checkFileWrite(projectId, rawFileName, content)) {
            console.error(`[GUARD] Gravação abortada por risco de loop: ${rawFileName}`);
            continue;
        }

        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        fs.writeFileSync(filePath, content);
        console.log(`[Orchestrator] SISTEMA ESCREVEU: ${rawFileName} em ${projectPath}`);
        count++;
    }
    return count;
}

function processCommands(projectId, text, projectTitle = '') {
    const cmdRegex = /\[CMD:\s*(.+?)\]/g;
    let match;
    let count = 0;
    
    let projectPath = path.join(__dirname, '../data/projects', projectId.toString(), 'src');
    if (projectTitle.toUpperCase().includes('DIYAPP')) {
        projectPath = path.join(__dirname, '../data/staging', projectId.toString());
        console.log(`[META-GUARD] Redirecionando execução de comandos para staging: ${projectPath}`);
    }

    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });

    while ((match = cmdRegex.exec(text)) !== null) {
        const command = match[1].trim();
        console.log(`[Orchestrator] Executando comando: ${command}`);
        
        // Safety: expanded allowed commands for seniors
        const allowed = ['npm', 'ls', 'mkdir', 'echo', 'touch', 'git', 'cat'];
        const isAllowed = allowed.some(a => command.startsWith(a));
        
        if (isAllowed) {
            shell.cd(projectPath);
            shell.exec(command);
            count++;
        } else {
            console.warn(`[Orchestrator] Comando bloqueado por segurança: ${command}`);
        }
    }
    return count;
}

function appendDoc(projectId, text) {
    const docPath = path.join(__dirname, '../data/docs', `${projectId}.md`);
    if (!fs.existsSync(path.dirname(docPath))) fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.appendFileSync(docPath, `${text}\n\n`);
}

async function finalizeProjectDeploy(project) {
    const isMeta = project.Title.toUpperCase().includes('DIYAPP');
    if (isMeta) {
        const github = require('./github_service');
        const stagingPath = path.join(__dirname, '../data/staging', project.Id.toString());

        // GUARD: verifica se staging tem arquivos antes de tentar PR
        const stagingFiles = fs.existsSync(stagingPath)
            ? fs.readdirSync(stagingPath).filter(f => !f.startsWith('.'))
            : [];

        if (stagingFiles.length === 0) {
            console.error(`[META-DEPLOY] ❌ Staging vazio para "${project.Title}". Nenhuma mudança foi gravada pelos agentes.`);
            const MAX_RETRIES_DEPLOY = 2;
            const tasks = getLocalBacklog(project) || [];
            const abandonedTasks = tasks.filter(t => t.status === 'FAILED' && (t.retries || 0) >= MAX_RETRIES_DEPLOY);
            // Se todas as tarefas foram abandonadas definitivamente, encerra sem loop infinito
            if (abandonedTasks.length > 0 && abandonedTasks.length >= tasks.filter(t => t.status === 'FAILED').length) {
                console.error(`[META-DEPLOY] ❌ Todas as tarefas foram abandonadas. Encerrando projeto sem deploy.`);
                await store.updateProject(project.Id, {
                    Status: 'DONE',
                    Active_Agent: null,
                    LogEntry: `[META-DEPLOY] Projeto encerrado — agentes não conseguiram produzir mudanças válidas após múltiplas tentativas. Verifique os logs de erro.`
                });
                return;
            }
            // Reset: volta tarefas que ainda têm tentativas disponíveis
            let resetCount = 0;
            tasks.forEach(t => {
                if ((t.status === 'FAILED' && (t.retries || 0) < MAX_RETRIES_DEPLOY) || t.status === 'DONE') {
                    t.status = 'PENDING';
                    t.retries = 0;
                    delete t.failReason;
                    resetCount++;
                }
            });
            if (resetCount > 0) saveLocalBacklog(project.Id, tasks);
            await store.updateProject(project.Id, {
                Status: 'IN_PROGRESS',
                Active_Agent: 'Sprint Ativa (HIVE)',
                LogEntry: `[RESET] Staging vazio — ${resetCount} tarefa(s) resetada(s) para nova tentativa.`
            });
            return;
        }

        // Ciclos de auto-avaliação (DIYAPP — Ciclo N) → deploy direto, sem PR GitHub
        // Projetos criados pelo usuário → PR GitHub para revisão
        const isEvalCycle = /Ciclo\s*\d+/i.test(project.Title);

        if (isEvalCycle) {
            console.log(`[META-DEPLOY] Ciclo de auto-avaliação detectado. Deploy direto para produção...`);
            try {
                await deployMetaChanges(project.Id);
                // Limpa staging após deploy bem-sucedido
                stagingFiles.forEach(f => {
                    try { fs.unlinkSync(path.join(stagingPath, f)); } catch(_) {}
                });
                await store.updateProject(project.Id, {
                    Status: 'DONE',
                    Active_Agent: null,
                    LogEntry: `[DEPLOY] ✅ ${stagingFiles.length} arquivo(s) aplicado(s) em produção: ${stagingFiles.join(', ')}`
                });
            } catch (deployErr) {
                console.error(`[META-DEPLOY] ❌ Deploy bloqueado pelos guards: ${deployErr.message}`);
                await store.updateProject(project.Id, {
                    Status: 'IN_PROGRESS',
                    Active_Agent: 'Sprint Ativa (HIVE)',
                    LogEntry: `[DEPLOY-GUARD] Deploy rejeitado: ${deployErr.message}. Retornando à sprint.`
                });
            }
            return;
        }

        if (github.isConfigured()) {
            try {
                const { prUrl, prNumber, branchName } = await github.createPRFromStaging(project.Id, project.Title, stagingPath);
                auditTrail.log({
                    projectId: project.Id,
                    projectTitle: project.Title,
                    phase: 'DEPLOY',
                    actor: 'GitHub',
                    action: `PR criada: #${prNumber} na branch ${branchName}`,
                    result: 'OK',
                    detail: prUrl
                });
                await store.updateProject(project.Id, {
                    Status: 'AWAITING_DEPLOY_APPROVAL',
                    PR_URL: prUrl,
                    PR_Number: prNumber,
                    PR_Branch: branchName,
                    LogEntry: `[GITHUB] PR criada para revisão humana. Acesse: ${prUrl}`
                });
                return;
            } catch (e) {
                console.error(`[META-DEPLOY] Falha ao criar PR: ${e.message}.`);
                auditTrail.log({
                    projectId: project.Id,
                    projectTitle: project.Title,
                    phase: 'DEPLOY',
                    actor: 'GitHub',
                    action: 'Falha ao criar PR',
                    result: 'FAIL',
                    detail: e.message
                });
                await store.updateProject(project.Id, {
                    Status: 'IN_PROGRESS',
                    Active_Agent: 'Sprint Ativa (HIVE)',
                    LogEntry: `[ERRO] Falha ao criar PR: ${e.message}. Retentando sprint.`
                });
                return;
            }
        }

        console.warn('[META-DEPLOY] GitHub não configurado. Configure GITHUB_TOKEN e GITHUB_REPO no .env.');
        await store.updateProject(project.Id, { LogEntry: '[AVISO] Deploy bloqueado: configure GITHUB_TOKEN e GITHUB_REPO no .env.' });
        return;
    }
    await store.updateProject(project.Id, { Status: 'DONE', Active_Agent: null, LogEntry: '[GOVERNANÇA] Implantação concluída com sucesso!🚀' });
}

function parseBacklogFromReply(text) {
    const tasks = extractTasksFromReply(text);
    return tasks.map(t => ({ ...t, status: 'PENDING' }));
}

function start() {
    console.log('[Orchestrator] Motor de Ciclo Industrial Iniciado. Mantendo squad ativa.');
    // Inicializar inventário DOM na startup
    rebuildDOMInventory();
    // Run immediately once, then interval
    runOrchestration();
    setInterval(runOrchestration, TICK_INTERVAL);
}

function getMetrics() {
    return lastCycleMetrics;
}

module.exports = { start, getMetrics };
