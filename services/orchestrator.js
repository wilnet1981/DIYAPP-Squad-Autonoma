const aiService = require('./ai_service');
const store = require('./store');
const billing = require('./billing_service');
const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const security = require('./security_monitor');

// META-EVOLUTION: Reads current platform files so agents can modify them
function getMetaFileContext(taskDesc) {
    const rootPath = path.join(__dirname, '..');
    const files = {};
    const targets = [
        { name: 'style.css', keywords: ['css', 'cor', 'color', 'estilo', 'verde', 'botão', 'visual', 'fundo', 'background', 'style'] },
        { name: 'index.html', keywords: ['html', 'botão', 'nav', 'sidebar', 'guia', 'menu', 'tela', 'dom'] },
        { name: 'app.js', keywords: ['js', 'javascript', 'função', 'click', 'evento', 'lógica', 'fetch'] }
    ];

    const descLower = (taskDesc || '').toLowerCase();

    for (const target of targets) {
        const filePath = path.join(rootPath, target.name);
        // Include file if task description mentions relevant keywords, or always include style.css for visual tasks
        const isRelevant = target.keywords.some(kw => descLower.includes(kw));
        if (isRelevant && fs.existsSync(filePath)) {
            try {
                let content = fs.readFileSync(filePath, 'utf8');
                // Truncate very large files to avoid token overflow (keep first 8000 chars)
                if (content.length > 8000) {
                    content = content.substring(0, 8000) + '\n/* ... arquivo truncado para economizar tokens ... */';
                }
                files[target.name] = content;
            } catch (e) {
                console.warn(`[META-CONTEXT] Falha ao ler ${target.name}: ${e.message}`);
            }
        }
    }

    if (Object.keys(files).length === 0) return '';

    let context = '\n\n=== CONTEÚDO ATUAL DOS ARQUIVOS DO SISTEMA (LEIA COM ATENÇÃO) ===\n';
    context += 'Você DEVE modificar estes arquivos existentes. NÃO crie arquivos novos do zero.\n';
    context += 'Retorne o arquivo COMPLETO com suas alterações aplicadas.\n\n';
    
    for (const [name, content] of Object.entries(files)) {
        context += `--- ARQUIVO ATUAL: ${name} ---\n`;
        context += content;
        context += `\n--- FIM DE ${name} ---\n\n`;
    }

    return context;
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
    'Squad Leader': 'squad_leader_instruction.html'
};

const BACKLOG_FILE = path.join(__dirname, '../data/backlogs.json');

function getLocalBacklog(projectId) {
    if (!fs.existsSync(BACKLOG_FILE)) return null;
    try {
        const backlogs = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf8'));
        return backlogs[projectId.toString()] || null;
    } catch(e) { return null; }
}

function saveLocalBacklog(projectId, tasks) {
    let backlogs = {};
    const pId = projectId.toString();
    if (fs.existsSync(BACKLOG_FILE)) {
        try { backlogs = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf8')); } catch(e) {}
    }
    
    // PROGRESS PROTECTION: Don't overwrite existing DONE tasks if the new list is just a re-seed
    const existing = backlogs[pId] || [];
    const merged = tasks.map(t => {
        const match = existing.find(ex => ex.desc === t.desc && ex.agent === t.agent);
        if (match && match.status === 'DONE') return { ...t, status: 'DONE' };
        return t;
    });

    backlogs[pId] = merged;
    if (!fs.existsSync(path.dirname(BACKLOG_FILE))) fs.mkdirSync(path.dirname(BACKLOG_FILE), { recursive: true });
    fs.writeFileSync(BACKLOG_FILE, JSON.stringify(backlogs, null, 2));
}

function getRoleFile(agentName) {
    return ROLE_MAP[agentName] || (agentName.toLowerCase().replace(/\s+/g, '_') + '_instruction.html');
}

function getProjectProgress(projectId) {
    const tasks = getLocalBacklog(projectId);
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
        const allPendingOrActive = projects.filter(p => p.Status === 'PENDING' || p.Status === 'IN_PROGRESS' || p.Status === 'AWAITING_APPROVAL' || p.Status === 'APPROVED_FOR_DEPLOY')
            .map(p => ({ ...p, progress: getProjectProgress(p.Id) }));

        // STRATEGIC LOCK: Se qualquer projeto estiver aguardando aprovação, pause a fábrica.
        const awaitingApproval = allPendingOrActive.find(p => p.Status === 'AWAITING_APPROVAL');
        if (awaitingApproval) {
            console.log(`[LOCKDOWN] Fábrica Pausada. Aguardando aprovação soberana para: ${awaitingApproval.Title}`);
            
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
            console.log('[Orchestrator] Nada pendente de execução real. Silêncio industrial.');
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

        // --- NEW: CONTINUOUS IMPROVEMENT LOGIC ---
        
        if (project.Active_Agent === 'QA (Analise)') {
            console.log(`[HIVE-DEBUG] Iniciando Auditoria de QA para ${project.Title}...`);
            const aiResult = await aiService.getSmartResponse({
                role: 'QA Auditor',
                roleFile: 'qa_instruction.html',
                message: `ANALISE DE CICLO: O projeto "${project.Title}" terminou sua sprint. Analise o repositório em busca de bugs residuais. Se estiver tudo limpo, responda exatamente "[STATUS: CLEAN]". Se houver bugs, liste-os como novas tarefas.`
            });
            console.log(`[HIVE-DEBUG] Resposta do QA: ${aiResult.reply.substring(0, 50)}...`);

            if (aiResult.reply.includes('[STATUS: CLEAN]')) {
                console.log(`[QA] Ciclo aprovado. Chamando Inovação para ${project.Title}.`);
                await store.updateProject(project.Id, { 
                    Active_Agent: 'Inovação', 
                    LogEntry: '[QA] Estabilidade confirmada. Solicitando propostas de evolução ao Agente de Inovação...'
                });
            } else {
                console.log(`[QA] Bugs detectados. Reiniciando Sprint de Correção.`);
                const newTasks = parseBacklogFromReply(aiResult.reply);
                saveLocalBacklog(project.Id, newTasks);
                await store.updateProject(project.Id, { 
                    Active_Agent: 'Sprint Ativa (HIVE)', 
                    Backlog: JSON.stringify(newTasks),
                    LogEntry: '[QA] Bugs residuais detectados. Iniciando sprint de correção emergencial.'
                });
            }
        } else if (project.Active_Agent === 'Inovação') {
            console.log(`[HIVE-DEBUG] Iniciando Agente de Inovação para ${project.Title}...`);
            const aiResult = await aiService.getSmartResponse({
                role: 'Estrategista de Inovação',
                roleFile: 'inovacao_produto_instruction.html',
                message: `MELHORIA CONTÍNUA: O projeto "${project.Title}" está estável. Proponha de 2 a 3 melhorias técnicas ou de UX que agreguem valor real. Formate sua resposta como uma lista de tarefas para a squad.`
            });
            console.log(`[HIVE-DEBUG] Resposta da Inovação: ${aiResult.reply.substring(0, 50)}...`);

            const improvementTasks = parseBacklogFromReply(aiResult.reply);
            saveLocalBacklog(project.Id, improvementTasks);
            
            await store.updateProject(project.Id, { 
                Active_Agent: 'Product Owner',
                Status: 'AWAITING_APPROVAL', 
                Backlog: JSON.stringify(improvementTasks),
                LogEntry: '[INOVAÇÃO] Novas melhorias sugeridas. Aguardando a aprovação do Arquiteto para iniciar implementação.'
            });
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
    const existingTasks = getLocalBacklog(project.Id);
    
    if (project.Active_Agent === 'Product Owner') {
        if (existingTasks && existingTasks.length > 0) {
            console.log(`[LOCKDOWN] Projeto ${project.Title} já possui backlog local. Saltando PO para evitar reset.`);
            await store.updateProject(project.Id, { Active_Agent: 'Sprint Ativa (HIVE)' });
            return;
        }

        let metaContext = '';
        if (isMeta) {
            const fileContext = getMetaFileContext(project.Project_Goal + ' ' + project.Technical_Specs);
            metaContext = `\n[META-EVOLUÇÃO — CONTEXTO DO SISTEMA]:
Este projeto modifica os arquivos EXISTENTES da plataforma DIYAPP.
Os arquivos-alvo são: style.css, index.html e app.js na RAIZ.
NÃO é React. É HTML/CSS/JS puro.
Crie tarefas que referenciem os arquivos e seletores REAIS.
Exemplo de tarefa boa: {"agent": "Frontend", "desc": "No arquivo style.css, adicionar regra #nav-docs com background-color verde"}
Exemplo de tarefa RUIM: {"agent": "Frontend", "desc": "Criar componente de botão verde"}
${fileContext}`;
        }

        const aiResult = await aiService.getSmartResponse({
            role: 'Product Owner',
            roleFile: 'po_instruction.html',
            message: `PROJETO: "${project.Title}"
OBJETIVO: ${project.Project_Goal}
ESCOPO: ${project.Technical_Specs}
${metaContext}
TAREFA: Crie o BACKLOG com tarefas SIMPLES e DIRETAS. Máximo 3 tarefas.
Retorne JSON: [BACKLOG: {"tasks": [{"agent": "Frontend", "desc": "..."}]}]`
        });

        const backlogMatch = aiResult.reply.match(/\[BACKLOG:\s*({[\s\S]+?})\]/) || aiResult.reply.match(/({[\s\S]*"tasks"[\s\S]*})/);
        
        if (backlogMatch) {
            try {
                const cleanedJson = backlogMatch[1].replace(/```json|```/g, '').trim();
                const backlogData = JSON.parse(cleanedJson);
                const tasks = (backlogData.tasks || []).map(t => ({ ...t, status: 'PENDING' }));
                
                if (tasks.length === 0) throw new Error("Vazio");

                saveLocalBacklog(project.Id, tasks);
                console.log(`[GOVERNANÇA] Bloqueio V20 ativado para ${project.Title}. Aguardando inspeção humana.`);
                
                await store.updateProject(project.Id, { 
                    Backlog: JSON.stringify(tasks),
                    Status: 'AWAITING_APPROVAL',
                    Active_Agent: 'Aprovador',
                    LogEntry: '[GOVERNANÇA] Planejamento concluído e retido para revisão. Autorize no Dashboard para iniciar a execução.' 
                });
                return;
            } catch (e) { console.error('[PO] JSON Erro:', e.message); }
        }
    }

    // 2. Sprint Handling (Parallelism)
    // Check local memory first, fallback to DB
    let tasks = getLocalBacklog(project.Id);
    if (!tasks && project.Backlog) {
        try { tasks = JSON.parse(project.Backlog); } catch(e) { tasks = []; }
    }

    if (tasks && project.Active_Agent === 'Sprint Ativa (HIVE)') {
        const pendingTasks = tasks.filter(t => t.status === 'PENDING').slice(0, 5); // Max 5 parallel
        
        if (pendingTasks.length > 0) {
            console.log(`[HIVE] Executando ${pendingTasks.length} tarefas em paralelo para o projeto ${project.Title}...`);
            
            // 2.1 Gather results in memory to avoid race conditions
            const sprintResults = await Promise.all(pendingTasks.map(async (task) => {
                let metaContext = '';
                if (isMeta) {
                    const fileContext = getMetaFileContext(task.desc + ' ' + project.Project_Goal);
                    metaContext = `\n[AVISO CRÍTICO — META-EVOLUÇÃO]:
Você está MODIFICANDO o sistema DIYAPP existente na raiz.
NÃO crie páginas novas. NÃO invente componentes. NÃO use React.
Você DEVE retornar o arquivo COMPLETO com sua modificação aplicada.
Use o formato: [FILE: nome_do_arquivo] conteúdo completo [/FILE]
${fileContext}`;
                }

                const aiResult = await aiService.getSmartResponse({
                    role: task.agent,
                    roleFile: getRoleFile(task.agent),
                    message: `PROJETO: "${project.Title}"
TAREFA ESPECÍFICA: ${task.desc}
${metaContext}
Retorne SOMENTE os arquivos modificados usando [FILE: nome] ... [/FILE].`
                });

                if (aiResult.provider === 'none') {
                   console.error(`[CRÍTICO] Todos os provedores falharam para o agente ${task.agent}`);
                }

                const fileCount = processFiles(project.Id, aiResult.reply, project.Title);
                const cmdCount = processCommands(project.Id, aiResult.reply, project.Title);
                const tokenGain = (aiResult.reply.length * 2);

                if (fileCount > 0 || cmdCount > 0) {
                    task.status = 'DONE';
                } else {
                    console.warn(`[HIVE-GUARD] Agent ${task.agent} produced NO output for: ${task.desc}`);
                }
                
                return {
                    agent: task.agent,
                    tokens: tokenGain,
                    provider: aiResult.provider,
                    fileCount,
                    cmdCount,
                    content: aiResult.reply
                };
            }));

            // 2.2 Consolidate all results
            let totalGain = 0;
            let breakdown = { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 };
            let consolidatedLogs = [];

            sprintResults.forEach(res => {
                totalGain += res.tokens;
                consolidatedLogs.push(`[${res.agent}] Editou (${res.fileCount} arq, ${res.cmdCount} cmds) - ${res.tokens} tokens`);
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

            await store.updateProject(project.Id, { 
                Backlog: JSON.stringify(tasks),
                Tokens: (project.Tokens || 0) + totalGain,
                TokenAmount: totalGain,
                LogEntry: `SQUAD EM AÇÃO: ${consolidatedLogs.join(' | ')}`
            });

        } else {
            // BACKLOG FINISHED -> Start Continuous Improvement Cycle
            console.log(`[HIVE] Sprint concluída para "${project.Title}". Iniciando ciclo de Melhoria Contínua.`);
            await store.updateProject(project.Id, { 
                Active_Agent: 'QA (Analise)', 
                LogEntry: '[MELHORIA CONTÍNUA] Backlog finalizado. Solicitando auditoria de estabilidade ao QA...'
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

    if (fs.existsSync(stagingPath)) {
        const files = fs.readdirSync(stagingPath);
        let deployedCount = 0;
        
        for (const file of files) {
            const src = path.join(stagingPath, file);
            const dest = path.join(rootPath, file);
            
            // CRITICAL SAFETY: Don't overwrite if staged file is significantly smaller
            // This prevents squad hallucinations from destroying the real dashboard
            if (fs.existsSync(dest)) {
                const currentSize = fs.statSync(dest).size;
                const stagedSize = fs.statSync(src).size;
                
                if (currentSize > 1000 && stagedSize < currentSize * 0.5) {
                    console.error(`[META-DEPLOY] ❌ BLOQUEADO: ${file} — arquivo staged (${stagedSize}B) é muito menor que o atual (${currentSize}B). Possível destruição.`);
                    continue;
                }
                
                // Backup current file
                const backupDir = path.join(rootPath, 'backups');
                if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
                fs.copyFileSync(dest, path.join(backupDir, `${file}.bak_${Date.now()}`));
            }

            fs.copyFileSync(src, dest);
            console.log(`[META-DEPLOY] Arquivo promovido: ${file}`);
            deployedCount++;
        }
        
        if (deployedCount > 0) {
            console.log(`[META-DEPLOY] ${deployedCount} arquivo(s) implantado(s) com sucesso. ✨`);
        } else {
            console.warn(`[META-DEPLOY] ⚠️ Nenhum arquivo foi implantado (todos bloqueados por segurança).`);
        }
    }
}

function processFiles(projectId, text, projectTitle = '') {
    // FIX: Regex corrigida para capturar o nome completo do arquivo.
    // A regex antiga (.+?)\]? capturava apenas 1 char do nome (ex: "s" de "style.css").
    // Nova regex: captura tudo entre [FILE: e ] como nome, depois o conteúdo até [/FILE].
    const fileRegex = /\[FILE:\s*([^\]]+)\]([\s\S]+?)\[\/FILE\]/g;
    let match;
    let count = 0;
    
    // SYSTEM PROTECTION LIST
    const PROTECTED_FILES = ['server.js', 'orchestrator.js', 'store.js', 'ai_service.js', 'package.json', '.env'];
    
    let projectPath = path.join(__dirname, '../data/projects', projectId.toString(), 'src');
    let isMeta = projectTitle.toUpperCase().includes('DIYAPP');

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
        await deployMetaChanges(project.Id);
    }
    await store.updateProject(project.Id, { Status: 'DONE', Active_Agent: null, LogEntry: '[GOVERNANÇA] Implantação Core concluída com sucesso!🚀' });
}

async function deployMetaChanges(projectId) {
    console.log(`[META-DEPLOY] Iniciando Auto-Implantação Autônoma para projeto ${projectId}...`);
    const stagingPath = path.join(__dirname, '../data/staging', projectId.toString());
    const rootPath = path.join(__dirname, '..');

    if (fs.existsSync(stagingPath)) {
        console.log(`[META-DEPLOY] Promovendo arquivos de staging para produção recursivamente...`);
        
        // Usando shelljs para cópia recursiva robusta
        // Normalização de paths (Forward Slashes) é necessária para o globbing do ShellJS no Windows
        const src = stagingPath.replace(/\\/g, '/') + '/*';
        const dst = rootPath.replace(/\\/g, '/') + '/';
        
        console.log(`[META-DEPLOY] Executando: shell.cp('-Rf', "${src}", "${dst}")`);
        const result = shell.cp('-Rf', src, dst);
        
        if (result.code !== 0) {
            console.error(`[META-DEPLOY] Falha na promoção: ${result.stderr}`);
        } else {
            console.log('[META-DEPLOY] Cópia recursiva concluída com sucesso.');
        }
    }
}

function parseBacklogFromReply(text) {
    if (!text) return [];
    // Tenta encontrar o marcador [BACKLOG: ...] ou um JSON direto com a chave "tasks"
    const backlogMatch = text.match(/\[BACKLOG:\s*({[\s\S]+?})\]/) || text.match(/({[\s\S]*"tasks"[\s\S]*})/);
    
    if (backlogMatch) {
        try {
            const cleanedJson = backlogMatch[1].replace(/```json|```/g, '').trim();
            const backlogData = JSON.parse(cleanedJson);
            return (backlogData.tasks || []).map(t => ({ ...t, status: 'PENDING' }));
        } catch (e) {
            console.error('[HIVE-PARSER] Erro ao processar JSON de Backlog:', e.message);
        }
    }
    
    // Fallback: Tentativa de extração heurística de lista se o JSON falhar
    console.warn('[HIVE-PARSER] Marcador [BACKLOG] não encontrado ou inválido. Usando extração heurística...');
    const tasks = [];
    const lines = text.split('\n');
    lines.forEach(line => {
        const match = line.match(/^\s*[-*]\s*\[(.*?)\]\s*(.*)/i);
        if (match) {
            tasks.push({ agent: match[1].trim(), desc: match[2].trim(), status: 'PENDING' });
        }
    });

    return tasks;
}

function start() {
    console.log('[Orchestrator] Motor de Ciclo Industrial Iniciado. Mantendo squad ativa.');
    // Run immediately once, then interval
    runOrchestration();
    setInterval(runOrchestration, TICK_INTERVAL);
}

function getMetrics() {
    return lastCycleMetrics;
}

module.exports = { start, getMetrics };
