require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const orchestrator = require('./services/orchestrator');
const aiService = require('./services/ai_service');
const store = require('./services/store');
const billing = require('./services/billing_service');
const fileService = require('./services/file_service');
const security = require('./services/security_monitor');
const usersApi = require('./services/mock-users-api');
const auditTrail = require('./services/audit_trail');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de Middlewares
app.use(cors());
app.use(express.json());

// AGGRESSIVE ANTI-CACHE: Previne que o Dashboard sirva versões antigas dos scripts
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Log de TODA requisição
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// API Routes
app.use('/api/users', usersApi);

// API: Billing Report
app.get('/api/billing', (req, res) => {
    res.json(billing.getReport());
});

// NEW: Stability & Health Metrics
app.get('/api/stability', (req, res) => {
    res.json(orchestrator.getMetrics());
});

// NEW: Security Status & Unlock
app.get('/api/security/status', (req, res) => {
    res.json(security.getStatus());
});

app.post('/api/security/unlock', (req, res) => {
    security.unlock();
    res.json({ success: true });
});

// NEW: Heartbeat for UI
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        orchestrator: orchestrator.getMetrics()
    });
});

// API Approval Gate
app.post('/api/tasks/approve', async (req, res) => {
    try {
        const { projectId, type } = req.body;
        console.log(`[APPROVAL] Autorização [${type}] recebida para o projeto: ${projectId}`);

        if (type === 'PLANNING') {
            await store.updateProject(projectId, {
                Status: 'IN_PROGRESS',
                Active_Agent: 'Sprint Ativa (HIVE)',
                LogEntry: '[GOVERNANÇA] Planejamento aprovado. Iniciando codificação.'
            });
        } else if (type === 'STEP') {
            await store.updateProject(projectId, {
                Status: 'IN_PROGRESS',
                Active_Agent: 'Sprint Ativa (HIVE)',
                LogEntry: '[GOVERNANÇA] Passo aprovado. Solicitando execução da próxima etapa.'
            });
        } else if (type === 'INNOVATION') {
            // Após proposta de Inovação: inicia novo ciclo de planejamento
            await store.updateProject(projectId, {
                Status: 'IN_PROGRESS',
                Active_Agent: 'Product Owner',
                Backlog: '[]',
                LogEntry: '[GOVERNANÇA] Melhorias aprovadas. PO iniciará novo planejamento.'
            });
        } else if (type === 'DEPLOY_MERGE') {
            // Merge da PR do GitHub
            const github = require('./services/github_service');
            const projects = await store.getProjects();
            const project = projects.find(p => p.Id === projectId);
            if (!project || !project.PR_Number) {
                return res.status(400).json({ error: 'PR não encontrada para este projeto.' });
            }
            await github.mergePR(project.PR_Number, project.PR_Branch);
            await store.updateProject(projectId, {
                Status: 'DONE',
                Active_Agent: null,
                LogEntry: `[GITHUB] PR #${project.PR_Number} mergeada com sucesso! Código no master. 🚀`
            });
        } else {
            // DEPLOY clássico (projetos sem GitHub configurado / não-meta)
            await store.updateProject(projectId, {
                Status: 'APPROVED_FOR_DEPLOY',
                LogEntry: '[GOVERNANÇA] Implantação autorizada. Prosseguindo...'
            });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('[APPROVAL] Erro:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Rejeitar/cancelar um projeto
app.post('/api/tasks/reject', async (req, res) => {
    try {
        const { projectId } = req.body;
        const github = require('./services/github_service');
        const projects = await store.getProjects();
        const project = projects.find(p => p.Id === projectId);

        // Se tiver PR aberta, fecha ela também
        if (project && project.PR_Number && project.PR_Branch && github.isConfigured()) {
            await github.closePR(project.PR_Number, project.PR_Branch).catch(e =>
                console.warn(`[REJECT] Não foi possível fechar PR: ${e.message}`)
            );
        }

        await store.updateProject(projectId, {
            Status: 'CANCELLED',
            Active_Agent: null,
            LogEntry: '[GOVERNANÇA] Projeto cancelado pelo Proprietário.'
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/staging/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const stagingPath = path.join(__dirname, 'data/staging', id);
        if (!fs.existsSync(stagingPath)) return res.json({ files: [] });
        
        const files = fs.readdirSync(stagingPath).filter(f => fs.statSync(path.join(stagingPath, f)).isFile());
        res.json({ files });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar staging.' });
    }
});

// Multer Configuration
const upload = multer({ dest: 'data/uploads/' });


app.use(express.static(path.join(__dirname, '/')));

const AdmZip = require('adm-zip');

// API Routes
app.get('/api/projects/:id/files', async (req, res) => {
    try {
        const id = req.params.id;
        const projectPath = path.join(__dirname, 'data/projects', id, 'src');
        if (!fs.existsSync(projectPath)) return res.json({ files: [] });
        
        const files = [];
        const walk = (dir) => {
            fs.readdirSync(dir).forEach(file => {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) walk(fullPath);
                else files.push(path.relative(projectPath, fullPath));
            });
        };
        walk(projectPath);
        res.json({ files });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar arquivos.' });
    }
});

app.get('/api/projects/:id/download', async (req, res) => {
    try {
        const id = req.params.id;
        const projectPath = path.join(__dirname, 'data/projects', id, 'src');
        if (!fs.existsSync(projectPath)) return res.status(404).send('Projeto sem arquivos.');

        const zip = new AdmZip();
        zip.addLocalFolder(projectPath);
        const buffer = zip.toBuffer();

        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename=project_${id}.zip`);
        res.set('Content-Length', buffer.length);
        res.send(buffer);
    } catch (e) {
        res.status(500).send('Erro ao gerar ZIP.');
    }
});

// Dinamic Preview Hosting
app.use('/preview/:id', (req, res, next) => {
    const id = req.params.id;
    const projectPath = path.join(__dirname, 'data/projects', id, 'src');
    if (fs.existsSync(projectPath)) {
        express.static(projectPath)(req, res, next);
    } else {
        res.status(404).send('Preview não disponível. A squad ainda não gerou arquivos.');
    }
});
app.get('/api/projects/:id/docs', async (req, res) => {
    try {
        const id = req.params.id;
        const docPath = path.join(__dirname, 'data/docs', `${id}.md`);
        if (fs.existsSync(docPath)) {
            const content = fs.readFileSync(docPath, 'utf8');
            res.json({ content });
        } else {
            res.json({ content: 'Documentação ainda não gerada para este projeto.' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Erro ao ler doc.' });
    }
});

// API: List Projects
app.get('/api/projects', async (req, res) => {
    try { const projects = await store.getProjects(); res.json({ list: projects }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// AUDIT TRAIL — log completo de todos os ciclos
app.get('/api/trail', (req, res) => {
    try {
        const recent = auditTrail.getRecent(200);
        res.json(recent);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// AUDIT TRAIL — relatório textual de um projeto específico
app.get('/api/trail/:projectId/report', (req, res) => {
    try {
        const report = auditTrail.generateReport(req.params.projectId);
        if (!report) return res.json({ report: 'Nenhum registro encontrado para este projeto.' });
        res.json({ report });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Evidence log — what was actually changed per task
app.get('/api/evidence', (req, res) => {
    try {
        const evPath = path.join(__dirname, 'data/evidence_log.json');
        if (!fs.existsSync(evPath)) return res.json([]);
        const log = JSON.parse(fs.readFileSync(evPath, 'utf8'));
        res.json(log.slice(0, 50)); // últimas 50 evidências
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// NEW: Audit Route for Transparency Wall
app.get('/api/audit', async (req, res) => {
    try {
        const projects = await store.getProjects();
        let globalLogs = [];
        
        // 1. Load from Physical Logs (Robust History)
        const logDir = path.join(__dirname, 'data/logs');
        if (fs.existsSync(logDir)) {
            const files = fs.readdirSync(logDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const projectId = file.replace('.json', '');
                    const project = projects.find(p => p.Id.toString() === projectId);
                    const title = project ? project.Title : `Projeto #${projectId}`;
                    
                    try {
                        const logs = JSON.parse(fs.readFileSync(path.join(logDir, file), 'utf8'));
                        logs.forEach(l => {
                            globalLogs.push({
                                timestamp: l.timestamp,
                                project: title,
                                message: l.message,
                                type: 'success'
                            });
                        });
                    } catch(e) {}
                }
            }
        }

        // 2. Sort by timestamp and take latest 100
        globalLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(globalLogs.slice(0, 100));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        const { title, description, goal, specs } = req.body;
        console.log(`[SERVER] Recebendo solicitação de novo projeto: "${title}"`);
        
        const payload = {
            Title: title || 'Sem Título',
            Status: 'PENDING',
            Description: description || 'Sem Descrição',
            Project_Goal: goal || 'Sem Objetivo',
            Technical_Specs: specs || 'Sem Especificações',
            Tokens: 0,
            Active_Agent: 'Squad Leader'
        };
 
        const project = await store.createProject(payload);
        console.log(`[SERVER] Projeto criado com sucesso! ID: ${project.Id}`);

        auditTrail.log({
            projectId: project.Id,
            projectTitle: project.Title,
            phase: 'BRIEFING',
            actor: 'Sistema',
            action: 'Projeto criado e enviado para fila de execução',
            result: 'OK',
            detail: `Objetivo: ${(goal || '').substring(0, 120)}`
        });

        res.json(project);
    } catch (error) {
        console.error('[SERVER] ERRO CRÍTICO NA CRIAÇÃO DO PROJETO:', error.message);
        res.status(500).json({ error: 'Erro ao criar projeto' });
    }
});

// Upload Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        
        const extractedText = await fileService.extractTextFromFile(req.file.path, req.file.mimetype);
        
        res.json({ 
            success: true, 
            filename: req.file.originalname,
            path: req.file.path,
            mime: req.file.mimetype,
            text: extractedText
        });
    } catch (e) {
        console.error('[SERVER] Upload Error:', e.message);
        res.status(500).json({ error: 'Erro ao processar arquivo' });
    }
});

// ─── Prompts por estágio para o PM ───────────────────────────────────────────
function buildPMPrompt(stage, userMessage, history, fileContext) {
    // Extrai contexto confirmado das mensagens anteriores
    const userTurns = (history || []).filter(h => h.role === 'user').map(h => h.content);
    const confirmedContext = userTurns.length > 0
        ? `\nCONTEXTO JÁ CONFIRMADO PELO USUÁRIO:\n${userTurns.map((t, i) => `  R${i+1}: ${t.substring(0, 150)}`).join('\n')}\n`
        : '';

    const fileCtx = fileContext ? `\nARQUIVOS DE REFERÊNCIA ANEXADOS:\n${fileContext}\n` : '';

    const stagePrompts = {
        start: `Você é o PM da squad. Uma nova sessão de briefing foi iniciada.
${confirmedContext}
MENSAGEM INICIAL DO SISTEMA: "${userMessage}"

Dê as boas-vindas de forma curta e profissional.
Faça UMA única pergunta objetiva: o que o usuário quer construir ou mudar?
Máximo 2 frases. Sem listas. Sem explicações.`,

        step_1: `Você é o PM da squad.
${confirmedContext}
ÚLTIMA MENSAGEM DO USUÁRIO: "${userMessage}"
${fileCtx}

O usuário descreveu o que quer. Agora descubra o ESCOPO.
Faça UMA pergunta objetiva sobre o que estará incluído ou excluído.
NÃO repita o que o usuário já disse. NÃO faça duas perguntas.
Máximo 2 frases.`,

        step_2: `Você é o PM da squad.
${confirmedContext}
ÚLTIMA MENSAGEM DO USUÁRIO: "${userMessage}"
${fileCtx}

O escopo está definido. Agora descubra UM detalhe funcional importante que ainda não foi mencionado.
Ex: comportamento de um botão, transição visual, persistência de estado, etc.
UMA pergunta. Máximo 2 frases.`,

        step_3: `Você é o PM da squad.
${confirmedContext}
ÚLTIMA MENSAGEM DO USUÁRIO: "${userMessage}"
${fileCtx}

Você tem informação suficiente para briefinq.
Faça um resumo CURTO do que será feito (3-4 linhas).
Termine com: "Posso passar isso para a squad agora?"
NÃO faça perguntas adicionais.`,

        step_4: `Você é o PM da squad.
${confirmedContext}
ÚLTIMA MENSAGEM DO USUÁRIO: "${userMessage}"

O usuário confirmou. Encerre a conversa.
Diga que vai acionar a squad agora.
Inclua exatamente esta linha ao final: [TITULO: {título conciso de 4-6 palavras descrevendo a entrega}]
Exemplo: [TITULO: Light Mode com Toggle de Tema]
Substitua o conteúdo entre chaves pelo título real. Máximo 3 frases.`,

        done: `Encerramento. Responda apenas: "Entendido. A squad já foi acionada."`
    };

    return stagePrompts[stage] || stagePrompts['step_1'];
}

// AI Real Interview logic
app.post('/api/chat', async (req, res) => {
    const { message, history, stage, fileContext, evolution, projectId } = req.body || {};
    try {
        console.log(`[DEBUG] Chat disparado. Stage: ${stage}. Evolution: ${evolution}`);

        const prompt = buildPMPrompt(stage, message || '', history, fileContext);

        const aiResult = await aiService.getSmartResponse({
            role: 'Product Manager',
            roleFile: 'pm_instruction.html',
            message: prompt,
            history: [] // histórico já embutido no prompt estruturado
        });

        // Registra no audit trail
        auditTrail.log({
            projectId: projectId || 'BRIEFING',
            projectTitle: 'Briefing em andamento',
            phase: 'BRIEFING',
            actor: 'PM',
            action: `[${stage}] Usuário: "${(message || '').substring(0, 80)}"`,
            result: 'OK',
            detail: `PM respondeu: "${aiResult.reply.substring(0, 100)}"`
        });

        // Extrai título se o PM gerou [TITULO: ...]
        let generatedTitle = null;
        const titleMatch = aiResult.reply.match(/\[TITULO:\s*([^\]]{3,80})\]/i);
        if (titleMatch) {
            generatedTitle = titleMatch[1].trim();
            console.log(`[CHAT] Título gerado pelo PM: "${generatedTitle}"`);
        }

        // Progressão de estágio
        const stages = ['start', 'step_1', 'step_2', 'step_3', 'step_4', 'done'];
        const currentIndex = stages.indexOf(stage);
        let nextStage = currentIndex === -1 ? 'done' : (stages[currentIndex + 1] || 'done');

        if (aiResult.reply.includes('[SQUAD_NOTIFICADA]') || aiResult.reply.includes('[FINALIZAR]')) {
            nextStage = 'done';
        }

        console.log(`[DEBUG] Estágio: ${stage} -> ${nextStage}`);
        res.json({ reply: aiResult.reply, nextStage, generatedTitle });
    } catch (e) {
        console.error('[ERRO CRÍTICO NO CHAT]:', e);
        res.status(500).json({ reply: 'Erro interno no servidor de IA.', nextStage: stage });
    }
});

app.listen(PORT, () => {
    console.log(`DIYAPP Server rodando em http://localhost:${PORT}`);
    orchestrator.start();
});
