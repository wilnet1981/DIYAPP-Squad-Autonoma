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

// AI Real Interview logic
app.post('/api/chat', async (req, res) => {
    const { message, history, stage, fileContext, evolution } = req.body || {};
    try {
        console.log(`[DEBUG] Chat disparado. Stage: ${stage}. Evolution: ${evolution}`);
        
        const roleFile = (stage === 'gathering_tech') ? 'po_instruction.html' : 'pm_instruction.html';

        let augmentedMessage = message || "Olá! Gostaria de iniciar um ajuste no sistema.";
        
        // Contexto para projeto de auto-evolução (DIYAPP)
        if (evolution) {
            augmentedMessage = `[MODO AUTO-EVOLUÇÃO DIYAPP ATIVO]
O usuário quer realizar um ajuste no prprio sistema DIYAPP.
Aja como um Product Manager cauteloso. Descubra exatamente o que o usuário quer mudar.
Não encerre a conversa enquanto houver dúvidas sobre o objetivo ou escopo.
Pergunte uma coisa de cada vez.

Solicitação do usuário: ${message}`;
        }

        if (fileContext) {
            augmentedMessage += `\n\n[CONTEXTO DE DOCUMENTOS ANEXADOS]:\n${fileContext}`;
        }

        const aiResult = await aiService.getSmartResponse({
            role: (stage === 'gathering_tech') ? 'Product Owner' : 'Product Manager',
            roleFile: roleFile,
            message: augmentedMessage,
            history: history || []
        });

        // Evolução de estágios: Curta para DIYAPP, Standard para outros
        let nextStage = stage;
        const standardStages = ['start', 'step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'done'];
        const evolutionStages = ['start', 'step_1', 'step_2', 'step_3', 'step_4', 'done'];
        
        const stagesOrder = (evolution) ? evolutionStages : standardStages;
        const currentIndex = stagesOrder.indexOf(stage);
        
        if (currentIndex === -1) {
            nextStage = 'done';
        } else {
            nextStage = stagesOrder[currentIndex + 1] || 'done';
        }

        if (aiResult.reply.includes('[SQUAD_NOTIFICADA]') || aiResult.reply.includes('[FINALIZAR]') || aiResult.reply.includes('SQUAD NOTIFICADA')) {
            nextStage = 'done';
            console.log(`[CHAT] Marcador de encerramento detectado. Forçando nextStage: done`);
        }

        console.log(`[DEBUG] Finalizando turno. Atual: ${stage} -> Próximo: ${nextStage}`);
        res.json({ reply: aiResult.reply, nextStage });
    } catch (e) {
        console.error('[ERRO CRÍTICO NO CHAT]:', e);
        res.status(500).json({ reply: 'Erro interno no servidor de IA.', nextStage: stage });
    }
});

app.listen(PORT, () => {
    console.log(`DIYAPP Server rodando em http://localhost:${PORT}`);
    orchestrator.start();
});
