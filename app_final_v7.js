let config = {
    dailyTokenLimit: 500000,
    dailyUsed: 0,
    weeklyTokenLimit: 2500000,
    weeklyUsed: 0,
    monthlyTokenLimit: 10000000,
    monthlyUsed: 0
};

const agents = [
    { name: "PM", role: "Gestão", desc: "Define visão e prioridades RICE." },
    { name: "PO", role: "Produto", desc: "Refina histórias e critérios de aceite." },
    { name: "Squad Leader", role: "Gestão", desc: "Remove bloqueios e garante o fluxo." },
    { name: "Tech Leader", role: "Tecnologia", desc: "Guia arquitetura e padrões técnicos." },
    { name: "UX Designer", role: "Design", desc: "Cria jornadas e interfaces fluidas." },
    { name: "Frontend", role: "Dev", desc: "Transcreve designs em código vivo." },
    { name: "Backend", role: "Dev", desc: "Constrói APIs e lógica de negócio." },
    { name: "Infra", role: "DevOps", desc: "Prepara os ambientes de deploy." },
    { name: "SRE", role: "DevOps", desc: "Garante estabilidade e escalabilidade." },
    { name: "Segurança", role: "Cyber", desc: "Protege dados e acessos da squad." },
    { name: "Compliance", role: "Legal", desc: "Garante conformidade e regras." },
    { name: "Aprovador", role: "Qualidade", desc: "Valida riscos e libera deploys." },
    { name: "QA", role: "Qualidade", desc: "Testa exaustivamente cada entrega." },
    { name: "Especialista LLM", role: "IA", desc: "Otimiza prompts e modelos de IA." },
    { name: "AI Ops", role: "IA", desc: "Monitora saúde e custo das APIs." },
    { name: "Data Engineer", role: "Dados", desc: "Estrutura o conhecimento da squad." },
    { name: "Inovação", role: "Produto", desc: "Busca diferenciais técnicos únicos." },
    { name: "Tech Writer", role: "Docs", desc: "Documenta cada passo do software." },
    { name: "Melhoria Contínua", role: "Processo", desc: "Otimiza o ciclo SDLC da squad." }
];

let currentInterviewStage = 'start';
let chatHistory = [];
let projectDraft = { title: '', goal: '', specs: '' };
let currentProjects = [];
let currentAttachments = [];
let isMetaInterview = false; // NEW: Session flag for meta-evolution

async function init() {
    initTheme();
    setupEventListeners();
    renderAgents();
    await fetchProjects();
    fetchAuditLogs();
    
    // Final force view
    switchView('view-dashboard');
    
    setInterval(fetchProjects, 3000);
    setInterval(checkHealth, 5000);
}

async function checkHealth() {
    try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error('Offline');
        const data = await res.json();
        
        const pulse = document.getElementById('heartbeat-pulse');
        const text = document.getElementById('heartbeat-text');
        
        if (pulse) {
            pulse.className = 'pulse-green';
        }
        if (text) {
            const status = data.orchestrator.status || 'ATIVO';
            const latency = data.orchestrator.latency ? ` • ${Math.round(data.orchestrator.latency/1000)}s` : '';
            text.innerText = `${status}${latency}`;
        }

        // Combine with security check to save requests
        const securityModal = document.getElementById('security-lockdown-modal');
        const securityReason = document.getElementById('lockdown-reason');
        
        const secRes = await fetch('/api/security/status');
        const secStatus = await secRes.json();
        
        if (securityModal) {
            if (secStatus.lockdown) {
                securityModal.style.display = 'flex';
                if (securityReason) securityReason.innerText = secStatus.reason;
            } else {
                securityModal.style.display = 'none';
            }
        }
    } catch (e) { 
        const pulse = document.getElementById('heartbeat-pulse');
        const text = document.getElementById('heartbeat-text');
        if (pulse) pulse.className = 'pulse-gray';
        if (text) text.innerText = 'DESCONECTADO';
    }
}

async function unlockSystem() {
    try {
        const res = await fetch('/api/security/unlock', { method: 'POST' });
        if (res.ok) {
            const modal = document.getElementById('security-lockdown-modal');
            if (modal) modal.style.display = 'none';
            fetchProjects();
        }
    } catch (e) { alert("Erro ao destravar sistema."); }
}

function switchView(viewId) {
    // Esconde todas as views SPA (classe .view)
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');

    const el = document.getElementById(viewId);
    if (el) el.style.display = 'block';

    const navMap = {
        'view-dashboard':  'nav-dashboard',
        'view-softwares':  'nav-softwares',
        'view-factory':    'nav-factory',
        'view-billing':    'nav-billing',
        'view-audit':      'nav-audit',
        'view-stability':  'nav-stability',
        'view-doc-viewer': 'nav-docs'
    };

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNavId = navMap[viewId];
    if (activeNavId) {
        const navEl = document.getElementById(activeNavId);
        if (navEl) navEl.classList.add('active');
    }

    if (viewId === 'view-softwares') renderSoftwares();
    if (viewId === 'view-billing') renderBilling(currentProjects);
    if (viewId === 'view-audit') fetchAuditLogs();
    if (viewId === 'view-stability') renderStabilityMonitor();
    if (viewId === 'view-factory') renderFactory();
}

let stabilityChartInstance = null;
function renderStabilityMonitor() {
    const ctx = document.getElementById('latency-chart');
    if (!ctx) return;

    if (stabilityChartInstance) {
        stabilityChartInstance.destroy();
    }

    const labels = Array.from({ length: 15 }, (_, i) => `T-${14-i}`);
    const dataPoints = Array.from({ length: 15 }, () => 180 + Math.random() * 40);

    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-primary').trim() || '#58a6ff';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border-color').trim() || '#30363d';
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#8b949e';

    stabilityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Latência (ms)',
                data: dataPoints,
                borderColor: accentColor,
                backgroundColor: `${accentColor}1A`, // 0.1 opacity
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: gridColor }, ticks: { color: textColor }, min: 100, max: 300 },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });

    // Animação de Dados em Tempo Real (CONECTADO AO BACKEND)
    if (window.stabilityInterval) clearInterval(window.stabilityInterval);
    window.stabilityInterval = setInterval(async () => {
        try {
            const res = await fetch('/api/stability');
            const metrics = await res.json();
            
            const newData = metrics.latency || 150 + Math.random() * 20; // Fallback if 0
            stabilityChartInstance.data.datasets[0].data.shift();
            stabilityChartInstance.data.datasets[0].data.push(newData);
            stabilityChartInstance.update('none');
            
            // Updates visual status
            const statusText = document.getElementById('stability-status-text');
            const pulse = document.getElementById('stability-pulse');
            if (statusText) {
                statusText.innerText = metrics.status === 'RUNNING' ? 'SQUAD PROCESSANDO' : 'SQUAD EM STANDBY';
                statusText.style.color = metrics.status === 'RUNNING' ? '#ffab00' : '#3fb950';
            }
            if (pulse) {
                pulse.style.background = metrics.status === 'RUNNING' ? 'radial-gradient(circle, #ffab00 0%, transparent 70%)' : 'radial-gradient(circle, #3fb950 0%, transparent 70%)';
            }

            if (newData > 1000) { // High latency (industrial scale)
                const logs = document.getElementById('stability-logs');
                if (logs) {
                    const entry = document.createElement('div');
                    entry.className = 'log-entry';
                    entry.innerHTML = `<span style="color: #f778ba;">[ALTA CARGA]</span> Ciclo pesado detectado: ${Math.round(newData)}ms. Monitorando integridade...`;
                    logs.prepend(entry);
                    if (logs.children.length > 5) logs.lastChild.remove();
                }
            }
        } catch (e) { console.error("Erro ao sincronizar estabilidade:", e); }
    }, 5000); 
}

const PHASE_COLORS = {
    BRIEFING:     { bg: 'rgba(88,166,255,0.08)',  border: 'rgba(88,166,255,0.25)',  text: '#58a6ff' },
    PLANEJAMENTO: { bg: 'rgba(210,153,34,0.08)',  border: 'rgba(210,153,34,0.25)',  text: '#d99622' },
    EXECUÇÃO:     { bg: 'rgba(63,185,80,0.08)',   border: 'rgba(63,185,80,0.25)',   text: '#3fb950' },
    VERIFICAÇÃO:  { bg: 'rgba(247,120,186,0.08)', border: 'rgba(247,120,186,0.25)', text: '#f778ba' },
    QA:           { bg: 'rgba(139,148,158,0.08)', border: 'rgba(139,148,158,0.25)', text: '#8b949e' },
    DEPLOY:       { bg: 'rgba(188,140,255,0.08)', border: 'rgba(188,140,255,0.25)', text: '#bc8cff' },
};

const RESULT_ICON = { OK: '✅', FAIL: '❌', SKIP: '⏭️', PENDING: '⏳' };

async function fetchAuditLogs() {
    try {
        const [trailRes, evidenceRes] = await Promise.all([
            fetch('/api/trail'),
            fetch('/api/evidence')
        ]);
        const trail = await trailRes.json();
        const evidence = await evidenceRes.json();
        const feed = document.getElementById('audit-feed');
        if (!feed) return;

        // — Seção: Trail completo (por fase) —
        let trailHtml = '';
        if (trail.length === 0) {
            trailHtml = '<div style="color:#8b949e; padding:16px 0;">Nenhuma atividade registrada ainda. Inicie um ciclo para ver o trail completo.</div>';
        } else {
            // Agrupa por projeto
            const byProject = {};
            trail.forEach(e => {
                const key = e.projectId;
                if (!byProject[key]) byProject[key] = { title: e.projectTitle, entries: [] };
                byProject[key].entries.push(e);
            });

            trailHtml = Object.values(byProject).map(proj => {
                const entriesHtml = proj.entries.map(e => {
                    const c = PHASE_COLORS[e.phase] || PHASE_COLORS['EXECUÇÃO'];
                    const icon = RESULT_ICON[e.result] || '⏳';
                    const time = new Date(e.ts).toLocaleTimeString('pt-BR');
                    return `
                        <div style="display:grid; grid-template-columns:70px 90px 110px 1fr; gap:8px; align-items:start; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:11px;">
                            <span style="color:#8b949e;">${time}</span>
                            <span style="background:${c.bg}; border:1px solid ${c.border}; color:${c.text}; border-radius:4px; padding:1px 6px; text-align:center; font-weight:700; font-size:10px;">${e.phase}</span>
                            <span style="color:#c9d1d9; font-weight:600;">${icon} ${e.actor}</span>
                            <span style="color:#8b949e;">${e.action}${e.detail ? `<br><span style="color:#6e7681; font-size:10px;">↳ ${e.detail}</span>` : ''}</span>
                        </div>`;
                }).join('');

                return `
                    <div style="margin-bottom:20px;">
                        <div style="font-size:11px; font-weight:700; color:#c9d1d9; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.1);">
                            📋 ${proj.title}
                        </div>
                        ${entriesHtml}
                    </div>`;
            }).join('');
        }

        // — Seção: Evidências de arquivo (o que foi realmente escrito) —
        const evidenceHtml = evidence.length > 0 ? `
            <div style="margin-top:24px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.1);">
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#1D9E75; margin-bottom:8px;">📁 Arquivos Efetivamente Alterados</div>
                ${evidence.map(ev => `
                    <div style="background:rgba(29,158,117,0.07); border:1px solid rgba(29,158,117,0.2); border-radius:6px; padding:8px 12px; margin-bottom:6px; font-size:11px; display:grid; grid-template-columns:90px 110px 1fr; gap:8px; align-items:center;">
                        <span style="color:#8b949e;">${new Date(ev.ts).toLocaleTimeString('pt-BR')}</span>
                        <span style="color:#58a6ff; font-weight:600;">[${ev.agent}]</span>
                        <span style="color:#c9d1d9;">${ev.filesChanged && ev.filesChanged.length > 0
                            ? `✅ ${ev.filesChanged.join(', ')}`
                            : '⚠️ Nenhum arquivo alterado'
                        }</span>
                    </div>
                `).join('')}
            </div>
        ` : '';

        feed.innerHTML = trailHtml + evidenceHtml;

        const totalEl = document.getElementById('total-actions');
        if (totalEl) totalEl.innerText = trail.length;
    } catch (e) {
        console.warn("Audit trail fetch failed:", e.message);
        const feed = document.getElementById('audit-feed');
        if (feed) feed.innerHTML = '<div style="color:#8b949e; padding:20px;">Erro ao carregar auditoria.</div>';
    }
}
async function fetchProjects() {
    try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        currentProjects = data.list || [];
        renderKanban(currentProjects);
        syncActiveAgents(currentProjects);
        config.dailyUsed = currentProjects.reduce((acc, p) => acc + (p.Tokens || 0), 0);
        updateQuotas();
    } catch (e) { console.error("Erro fetchProjects:", e); }
}

function updateQuotas() {
    const updateBar = (id, used, limit, labelId, percId) => {
        const perc = Math.min((used / limit) * 100, 100);
        const el = document.getElementById(id);
        if (el) el.style.width = perc + '%';
        const pEl = document.getElementById(percId);
        if (pEl) pEl.innerText = Math.round(perc) + '%';
        const lEl = document.getElementById(labelId);
        if (lEl) lEl.innerText = `${used.toLocaleString()} / ${(limit/1000).toLocaleString()}k tokens`;
    };
    updateBar('daily-bar', config.dailyUsed, config.dailyTokenLimit, 'daily-label', 'daily-perc');
}

function renderAgents() {
    const grid = document.getElementById('agent-grid');
    if (!grid) return;
    grid.innerHTML = '';
    agents.forEach(a => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.innerHTML = `
            <div class="agent-status-light active" id="agent-${a.name.replace(/\s+/g, '-')}"></div>
            <div class="agent-role">${a.role}</div>
            <div class="agent-name">${a.name}</div>
            <div class="agent-desc">${a.desc}</div>
        `;
        grid.appendChild(card);
    });
}

function renderFactory() {
    const grid = document.getElementById('factory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // 1. Calculate tokens per agent role from currentProjects
    const agentMetrics = {};
    currentProjects.forEach(p => {
        if (p.Backlog) {
            try {
                const tasks = typeof p.Backlog === 'string' ? JSON.parse(p.Backlog) : p.Backlog;
                tasks.forEach(t => {
                    if (!agentMetrics[t.agent]) agentMetrics[t.agent] = { tokens: 0, actions: 0 };
                    if (t.status === 'DONE') {
                        agentMetrics[t.agent].actions++;
                        // Heuristic: distribute project tokens across tasks if granular is missing
                        // For now, we'll just show the role exists. 
                        // Real tracking comes from logs.
                    }
                });
            } catch(e) {}
        }
    });

    agents.forEach(a => {
        const stats = agentMetrics[a.name] || { tokens: 0, actions: 0 };
        const isActive = currentProjects.some(p => p.Active_Agent === a.name);
        
        const card = document.createElement('div');
        card.className = `agent-card-full ${isActive ? 'active-pulse' : ''}`;
        card.innerHTML = `
            <div style="display:flex; justify-content: space-between; align-items: flex-start;">
                <div class="agent-role">${a.name}</div>
                <div class="${isActive ? 'status-tag status-in-progress' : 'status-tag'}" style="font-size:9px;">
                    ${isActive ? 'ATIVO AGORA' : 'STANDBY'}
                </div>
            </div>
            <div class="agent-tag">${a.role || a.category || ''}</div>
            <div class="agent-desc">${a.desc || 'Especialista sênior em autonomia de sistemas.'}</div>
            
            <div style="margin-top:15px; display:grid; grid-template-columns: 1fr 1fr; gap:10px; border-top:1px solid #30363d; padding-top:12px;">
                <div>
                    <div style="font-size:9px; color:#8b949e; text-transform:uppercase;">Produtividade</div>
                    <div style="font-size:13px; font-weight:700; color:var(--accent-success);">${stats.actions} tasks</div>
                </div>
                <div>
                    <div style="font-size:9px; color:#8b949e; text-transform:uppercase;">Custo (Est.)</div>
                    <div style="font-size:13px; font-weight:700; color:var(--accent-primary);">Calculando...</div>
                </div>
            </div>
            
            <div style="margin-top:12px; display:flex; gap:8px;">
                <button onclick="openRoleDoc('${a.name}')" style="flex:1; background:#30363d; border:none; color:white; font-size:10px; padding:6px; border-radius:4px; cursor:pointer;">📖 Ver Instruções</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openRoleDoc(name) {
    // Navigate to a mock or real instruction file
    const safeName = name.toLowerCase().replace(/\s+/g, '_');
    const url = `Roles/${safeName}_instruction.html`;
    window.open(url, '_blank');
}

function renderSoftwares() {
    const grid = document.getElementById('software-list');
    if (!grid) return;
    const finished = currentProjects.filter(p => p.Status === 'DONE');
    
    if (finished.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary);">Nenhum software finalizado ainda. Deixe a squad trabalhar!</div>';
        return;
    }

    grid.innerHTML = '';
    finished.forEach(p => {
        const card = document.createElement('div');
        card.className = 'agent-card-full'; 
        card.innerHTML = `
            <div style="display:flex; justify-content: space-between; align-items: start;">
                <div>
                    <div class="agent-role">${p.Title}</div>
                    <div class="agent-tag" style="background: rgba(29, 158, 117, 0.2)">CONCLUÍDO</div>
                </div>
                <button onclick="launchApp('${p.Id}', '${p.Title}')" style="background: var(--accent-success); color: white; border:none; padding: 8px 15px; border-radius: 6px; cursor:pointer; font-weight: 600;">🚀 Lançar App</button>
            </div>
            <div class="agent-desc" style="margin-top:10px;">${p.Description || 'Sem descrição.'}</div>
            <div style="margin-top: 15px; font-size: 11px; color: #1D9E75;">${(p.Tokens || 0).toLocaleString()} tokens investidores</div>
        `;
        grid.appendChild(card);
    });
}

function launchApp(id, title) {
    const url = `${window.location.origin}/preview/${id}/index.html`;
    window.open(url, '_blank');
}

async function fetchProjects() {
    try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        currentProjects = data.list || [];
        renderKanban(currentProjects);
        syncActiveAgents(currentProjects);
        config.dailyUsed = currentProjects.reduce((acc, p) => acc + (p.Tokens || 0), 0);
        updateQuotas();
        
        // NEW: Check for Awaiting Approval
        checkApprovals(currentProjects);

        // NEW: Fetch and render Consolidated Billing
        fetchBilling();
    } catch (e) { console.error("Erro fetchProjects:", e); }
}

function checkApprovals(projects) {
    const deployPending = projects.find(p => p.Status === 'AWAITING_DEPLOY_APPROVAL');
    const stepPending   = projects.find(p => p.Status === 'AWAITING_STEP_APPROVAL');
    const anyApprover   = projects.find(p => p.Active_Agent === 'Aprovador');
    const pending       = deployPending || stepPending || anyApprover || projects.find(p => p.Status === 'AWAITING_APPROVAL');

    const gate = document.getElementById('governance-gate');
    const btnApprove = document.getElementById('btn-approve-deploy');
    const btnView = document.getElementById('btn-view-staging');
    const btnReject = document.getElementById('btn-reject-deploy');
    const subMsg = document.getElementById('approval-submsg');

    if (!pending) {
        gate.style.display = 'none';
        return;
    }

    gate.style.display = 'block';

    // Extrai título limpo (remove prefixo "DIYAPP — " para exibição)
    const cleanTitle = (pending.Title || '').replace(/^DIYAPP\s*[—-]\s*/i, '');

    // Conta tarefas do backlog
    let taskSummary = '';
    try {
        const backlog = Array.isArray(pending.Backlog) ? pending.Backlog : JSON.parse(pending.Backlog || '[]');
        if (backlog.length > 0) {
            const t = backlog[0];
            taskSummary = `${t.agent || '?'}: ${(t.desc || '').substring(0, 60)}`;
        }
    } catch(e) {}

    if (deployPending) {
        document.getElementById('approval-msg').innerText = `PR PRONTA: ${cleanTitle}`;
        subMsg.innerText = "Código auditado e pronto para merge no master.";
        btnApprove.innerText = 'MERGE PR NO GITHUB';
        btnView.innerText = 'VER PR';
        btnView.onclick = () => window.open(pending.PR_URL, '_blank');
        btnApprove.onclick = () => approveProject(pending.Id, 'DEPLOY_MERGE');

    } else if (stepPending) {
        document.getElementById('approval-msg').innerText = `PASSO CONCLUÍDO: ${cleanTitle}`;
        subMsg.innerText = taskSummary || "Etapa técnica finalizada. Autorize a transição para o próximo passo.";
        btnApprove.innerText = 'AUTORIZAR PRÓXIMO PASSO';
        btnView.innerText = 'INSPECIONAR LOG';
        btnView.onclick = () => viewStaging(pending.Id, false);
        btnApprove.onclick = () => approveProject(pending.Id, 'STEP');

    } else if (pending.Active_Agent === 'Aprovador') {
        document.getElementById('approval-msg').innerText = `PLANO PRONTO: ${cleanTitle}`;
        subMsg.innerText = taskSummary || "O Product Owner finalizou o backlog. Revise e autorize o início.";
        btnApprove.innerText = 'AUTORIZAR EXECUÇÃO';
        btnView.innerText = 'REVISAR BACKLOG';
        btnView.onclick = () => viewStaging(pending.Id, true);
        btnApprove.onclick = () => approveProject(pending.Id, 'PLANNING');

    } else if (pending.Active_Agent === 'Product Owner' && pending.Status === 'AWAITING_APPROVAL') {
        document.getElementById('approval-msg').innerText = `INOVAÇÃO: ${cleanTitle}`;
        subMsg.innerText = taskSummary || "Novas propostas de evolução detectadas pela squad.";
        btnApprove.innerText = 'INICIAR MELHORIAS';
        btnView.innerText = 'VER PROPOSTAS';
        btnView.onclick = () => viewStaging(pending.Id, true);
        btnApprove.onclick = () => approveProject(pending.Id, 'INNOVATION');

    } else {
        document.getElementById('approval-msg').innerText = `DEPLOY: ${cleanTitle}`;
        subMsg.innerText = taskSummary || "Sistema estável em Staging. Autorize o deploy final.";
        btnApprove.innerText = 'APROVAR DEPLOY';
        btnView.innerText = 'VER ARQUIVOS';
        btnView.onclick = () => viewStaging(pending.Id, false);
        btnApprove.onclick = () => approveProject(pending.Id, 'DEPLOY');
    }

    if (btnReject) btnReject.onclick = () => rejectProject(pending.Id);
}

async function viewStaging(id, isPlanning) {
    const listEl = document.getElementById('staging-file-list');
    const titleEl = document.querySelector('#modal-staging h3');
    const descEl = document.getElementById('staging-desc');

    document.getElementById('modal-staging').style.display = 'flex';

    if (isPlanning) {
        titleEl.innerText = 'Revisão de Planejamento';
        descEl.innerText = 'Estas são as tarefas que a squad planejou executar:';
        listEl.innerHTML = '<div style="color:var(--text-secondary); padding:20px; text-align:center;">Carregando planejamento...</div>';

        const project = currentProjects.find(p => p.Id === id);
        if (project && project.Backlog) {
            try {
                const tasks = typeof project.Backlog === 'string' ? JSON.parse(project.Backlog) : project.Backlog;
                if (tasks.length === 0) {
                    listEl.innerHTML = '<div style="color:grey; padding:20px; text-align:center;">Backlog vazio.</div>';
                } else {
                    listEl.innerHTML = tasks.map(t => `
                        <div style="padding: 12px; margin-bottom:8px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--border-color);">
                            <div style="font-size:10px; font-weight:700; color:var(--accent-primary); margin-bottom:4px; text-transform:uppercase;">${t.agent}</div>
                            <div style="font-size:13px; color:var(--text-primary); line-height:1.4;">${t.desc || t.task || ''}</div>
                        </div>`).join('');
                }
            } catch(e) { listEl.innerHTML = 'Erro ao ler backlog.'; }
        }
    } else {
        titleEl.innerText = 'Inspeção de Entrega';
        descEl.innerText = 'Arquivos gerados pela squad na área de staging:';
        listEl.innerHTML = '<div style="color:var(--text-secondary); padding:20px; text-align:center;">Buscando arquivos...</div>';
        try {
            const res = await fetch(`/api/staging/${id}`);
            const data = await res.json();
            if (data.files && data.files.length > 0) {
                listEl.innerHTML = data.files.map(f => `
                    <div style="padding: 10px; margin-bottom:4px; background:rgba(255,255,255,0.03); border-radius:6px; display:flex; align-items:center; gap:10px;">
                        <span style="font-size:16px;">📄</span>
                        <span style="font-size:13px; font-family:monospace;">${f}</span>
                    </div>`).join('');
            } else {
                listEl.innerHTML = '<div style="color: grey; padding:20px; text-align:center;">Nenhum arquivo em staging.</div>';
            }
        } catch(e) { listEl.innerHTML = 'Falha ao ler staging.'; }
    }
}

async function approveProject(id, type) {
    const btn = document.getElementById('btn-approve-deploy');
    const oldText = btn.innerText;
    btn.innerText = 'PROCESSANDO...';
    btn.disabled = true;
    try {
        const res = await fetch('/api/tasks/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: id, type })
        });
        if (res.ok) {
            const msgs = {
                'PLANNING': 'Planejamento autorizado!',
                'STEP': 'Próximo passo autorizado!',
                'INNOVATION': 'Melhorias aprovadas!',
                'DEPLOY_MERGE': 'PR mergeada!',
                'DEPLOY': 'Deploy autorizado!'
            };
            // Removendo alerts invasivos se for passo a passo para fluidez
            console.log(msgs[type] || 'Autorizado!');
            await fetchProjects();
        } else {
            const err = await res.json();
            alert('Erro: ' + (err.error || 'Falha ao autorizar.'));
        }
    } catch(e) { alert('Erro ao autorizar.'); }
    btn.disabled = false;
    btn.innerText = oldText;
}

async function rejectProject(id) {
    if (!confirm('Cancelar este projeto? A PR no GitHub será fechada se existir.')) return;
    try {
        const res = await fetch('/api/tasks/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: id })
        });
        if (res.ok) {
            alert('Projeto cancelado.');
            await fetchProjects();
        }
    } catch(e) { alert('Erro ao cancelar.'); }
}

async function fetchBilling() {
    try {
        const res = await fetch('/api/billing');
        const data = await res.json();
        renderBilling(data);
    } catch (e) { console.error("Erro fetchBilling:", e); }
}

function renderBilling(billingData) {
    const body = document.getElementById('billing-body');
    if (!body) return;
    body.innerHTML = '';
    
    const projects = billingData.projects || {};
    const totals = billingData.totals || { cloudflare: 0, groq: 0, mistral: 0, deepseek: 0, gemini: 0, openai: 0, anthropic: 0 };

    Object.keys(projects).forEach(title => {
        const p = projects[title];
        const b = p.breakdown || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px 16px;">${title}</td>
            <td style="padding:10px 8px; text-align:center;"><span class="status-tag status-done">ATIVA</span></td>
            <td style="padding:10px 8px; text-align:center;">${(b.cloudflare || 0).toLocaleString()}</td>
            <td style="padding:10px 8px; text-align:center;">${(b.groq || 0).toLocaleString()}</td>
            <td style="padding:10px 8px; text-align:center;">${(b.mistral || 0).toLocaleString()}</td>
            <td style="padding:10px 8px; text-align:center;">${(b.deepseek || 0).toLocaleString()}</td>
            <td style="padding:10px 8px; text-align:center;">${(b.gemini || 0).toLocaleString()}</td>
            <td style="padding:10px 8px; text-align:center;">${(b.openai || 0).toLocaleString()}</td>
            <td style="padding:10px 8px; text-align:center;">${(b.anthropic || 0).toLocaleString()}</td>
            <td style="padding:10px 8px; text-align:center; font-weight:700; color:#1D9E75;">${(p.tokens || 0).toLocaleString()}</td>
            <td style="padding:10px 8px; text-align:center; font-weight:700; color:#238636;">$${(p.cost || 0).toFixed(2)}</td>
        `;
        body.appendChild(tr);
    });

    renderLLMChart(totals);
}

let llmChartInstance = null;
function renderLLMChart(data) {
    const ctx = document.getElementById('llm-pie-chart');
    if (!ctx) return;
    const chartData = {
        labels: ['Cloudflare', 'Groq', 'Mistral', 'DeepSeek', 'Gemini', 'OpenAI', 'Anthropic'],
        datasets: [{
            data: [data.cloudflare, data.groq, data.mistral, data.deepseek, data.gemini, data.openai, data.anthropic],
            backgroundColor: ['#F6821F', '#F55036', '#FF8C00', '#1D9E75', '#0078D4', '#6B3FA0', '#D43F3F'],
            borderWidth: 0
        }]
    };
    if (llmChartInstance) { llmChartInstance.data = chartData; llmChartInstance.update(); }
    else { llmChartInstance = new Chart(ctx, { type: 'pie', data: chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#8b949e' } } } } }); }
}

function renderKanban(projectList) {
    const cols = {
        'PENDING':                  document.getElementById('col-todo'),
        'AWAITING_APPROVAL':        document.getElementById('col-todo'),
        'AWAITING_DEPLOY_APPROVAL': document.getElementById('col-todo'),
        'IN_PROGRESS':              document.getElementById('col-doing'),
        'APPROVED_FOR_DEPLOY':      document.getElementById('col-doing'),
        'DONE':                     document.getElementById('col-done'),
        'CANCELLED':                document.getElementById('col-done')
    };
    if (!cols.PENDING) return;
    
    // Unique list of column elements
    const colElements = Array.from(new Set(Object.values(cols)));
    colElements.forEach(c => { 
        const h = c.querySelector('.col-header'); 
        c.innerHTML = ''; 
        c.appendChild(h); 
    });
    
    projectList.forEach(p => {
        const container = cols[p.Status] || cols['PENDING'];
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.onclick = () => openDocViewer(p.Id, p.Title);
        
        if (p.Status === 'AWAITING_APPROVAL') {
            cardEl.style.borderLeft = '4px solid #ffab00';
            cardEl.style.background = 'rgba(255, 171, 0, 0.05)';
        } else if (p.Status === 'APPROVED_FOR_DEPLOY') {
            cardEl.style.borderLeft = '4px solid #3fb950';
        }
        
        let backlogHtml = '';
        let progressHtml = '';

        // Datas de início e fim a partir dos logs
        const logs = Array.isArray(p.Logs) ? p.Logs : [];
        const timestamps = logs.map(l => new Date(l.timestamp)).filter(d => !isNaN(d));
        const dtStart = timestamps.length ? new Date(Math.min(...timestamps)) : (p.CreatedAt ? new Date(p.CreatedAt) : null);
        const dtEnd   = (p.Status === 'DONE' || p.Status === 'CANCELLED') && timestamps.length
            ? new Date(Math.max(...timestamps)) : null;

        const fmtDt = d => d ? d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';

        const timeHtml = `
            <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-secondary); margin-top:6px;">
                <span>▶ ${fmtDt(dtStart)}</span>
                ${dtEnd ? `<span>■ ${fmtDt(dtEnd)}</span>` : ''}
            </div>`;

        if (p.Backlog) {
            try {
                const tasks = typeof p.Backlog === 'string' ? JSON.parse(p.Backlog) : p.Backlog;
                if (Array.isArray(tasks) && tasks.length > 0) {
                    const doneTasks = tasks.filter(t => t.status === 'DONE').length;
                    const perc = Math.round((doneTasks / tasks.length) * 100);

                    progressHtml = `
                        <div class="progress-container">
                            <div class="progress-fill" style="width: ${perc}%"></div>
                        </div>`;

                    backlogHtml = `
                        <div class="card-backlog" style="margin-top:6px;">
                            ${tasks.map(t => `
                                <div class="backlog-item ${t.status === 'DONE' ? 'done' : 'pending'}" style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px; padding:3px 0;">
                                    <span style="color:#c9d1d9; font-size:10px; flex:1; line-height:1.4;">${t.status === 'DONE' ? '✅' : '🕒'} <strong>[${t.agent}]</strong> ${t.desc || t.task || ''}</span>
                                </div>
                            `).join('')}
                        </div>`;
                }
            } catch(e) {}
        }

        cardEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div style="font-weight:700; color:var(--text-bright); font-size:14px; letter-spacing:-0.01em;">${p.Title}</div>
                <div style="font-size:10px; font-weight:800; color:var(--accent-primary); white-space:nowrap;">${(p.Tokens || 0).toLocaleString()} TK</div>
            </div>
            
            ${progressHtml}
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
                <div style="font-size:10px; font-family:monospace; color:var(--text-secondary);">#${p.Id.toString().substring(0,8)}</div>
                ${p.Active_Agent ? `<div style="font-size:10px; font-weight:700; color:var(--accent-primary); text-transform:uppercase; letter-spacing:0.04em;">● ${p.Active_Agent}</div>` : ''}
            </div>
            
            ${timeHtml}
            
            ${p.Status === 'AWAITING_APPROVAL' || p.Status === 'AWAITING_DEPLOY_APPROVAL' ? `
                <div style="margin-top:12px; padding:6px 10px; background:rgba(211, 84, 0, 0.1); border:1px solid rgba(211, 84, 0, 0.2); border-radius:6px; font-size:10px; color:var(--accent-primary); font-weight:700; text-align:center;">
                    ⚠️ REVISÃO REQUERIDA
                </div>` : ''}
            
            ${backlogHtml}
        `;
        container.appendChild(cardEl);
    });
    renderActivityConsole(projectList);
}

// AUTO-REFRESH Industrial
setInterval(() => {
    fetchProjects();
    fetchAuditLogs();
}, 10000); 

function renderActivityConsole(projectList) {
    const consoleEl = document.getElementById('activity-console');
    if (!consoleEl) return;
    let allLogs = [];
    projectList.forEach(p => { if (p.Logs) p.Logs.forEach(l => allLogs.push({ ...l, project: p.Title })); });
    allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const latest = allLogs.slice(-20);
    if (latest.length > 0) { consoleEl.innerHTML = latest.map(l => `<div class="log-entry"><span class="log-time">${new Date(l.timestamp).toLocaleTimeString()}</span> <span style="color: #58a6ff;">[${l.project}]</span> ${l.message}</div>`).join(''); }
}

async function openDocViewer(id, title) {
    switchView('view-doc-viewer');
    document.getElementById('doc-title-viewer').innerText = `Repositório & Documentação: ${title}`;
    const contentEl = document.getElementById('doc-content-viewer');
    const fileListEl = document.getElementById('file-list');
    contentEl.innerText = 'Carregando cérebro da squad...';
    try {
        const resDoc = await fetch(`/api/projects/${id}/docs`);
        const dataDoc = await resDoc.json();
        contentEl.innerText = dataDoc.content;
        const resFiles = await fetch(`/api/projects/${id}/files`);
        const dataFiles = await resFiles.json();
        if (dataFiles.files && dataFiles.files.length > 0) { fileListEl.innerHTML = dataFiles.files.map(f => `<div class="file-item">📄 ${f}</div>`).join(''); }
        else { fileListEl.innerHTML = '<span style="color: grey;">Nenhum arquivo físico gerado ainda.</span>'; }
        document.getElementById('btn-download-doc').onclick = () => { const blob = new Blob([dataDoc.content], { type: 'text/markdown' }); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/\s+/g, '_')}_documentacao.md`; a.click(); };
        document.getElementById('btn-download-repo').onclick = () => { window.location.href = `/api/projects/${id}/download`; };
    } catch (e) { contentEl.innerText = 'Falha ao carregar repositório.'; }
}

function bindClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
    else console.warn(`[UI] Elemento não encontrado: #${id}`);
}

function setupEventListeners() {
    bindClick('nav-dashboard',  () => switchView('view-dashboard'));
    bindClick('nav-softwares',  () => switchView('view-softwares'));
    bindClick('nav-factory',    () => switchView('view-factory'));
    bindClick('nav-billing',    () => switchView('view-billing'));
    bindClick('nav-audit',      () => switchView('view-audit'));
    bindClick('nav-stability',  () => switchView('view-stability'));
    bindClick('btn-new-app',    () => { document.getElementById('chat-modal').style.display = 'flex'; startInterview(); });
    bindClick('nav-docs',       () => switchView('view-doc-viewer'));
    bindClick('close-modal',    () => { document.getElementById('chat-modal').style.display = 'none'; currentInterviewStage = 'start'; });
    bindClick('btn-send',       () => sendChatMessage());
    bindClick('btn-unlock-system', () => unlockSystem());
    bindClick('theme-toggle',   () => toggleTheme());
    
    // NEW: Attachment Button Logic
    bindClick('btn-attach',     () => document.getElementById('chat-file').click());

    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });

    const fileInput = document.getElementById('chat-file');
    if (fileInput) fileInput.onchange = (e) => handleFileUpload(e.target.files);
}

async function handleFileUpload(files) {
    const preview = document.getElementById('attachment-preview');
    preview.style.display = 'flex';
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                const attachment = { name: data.filename, text: data.text, mime: data.mime, isImage: data.mime.startsWith('image/'), url: data.mime.startsWith('image/') ? URL.createObjectURL(file) : null };
                const thumb = document.createElement('div');
                thumb.className = 'thumb-card';
                if (attachment.isImage) { const img = document.createElement('img'); img.src = attachment.url; thumb.appendChild(img); }
                else { thumb.innerHTML = `<span style="font-weight:bold; color:#fff;">${attachment.name.split('.').pop().toUpperCase()}</span>`; }
                const r = document.createElement('div'); r.className = 'thumb-remove'; r.innerHTML = '&times;'; r.onclick = (e) => { e.stopPropagation(); thumb.remove(); currentAttachments = currentAttachments.filter(a => a.name !== attachment.name); if (currentAttachments.length === 0) preview.style.display = 'none'; };
                thumb.appendChild(r); preview.appendChild(thumb); currentAttachments.push(attachment);
            }
        } catch (e) { console.error('[UPLOAD FAIL]', e); }
    }
}

async function startInterview() {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = '';
    chatHistory = []; currentAttachments = []; 
    document.getElementById('attachment-preview').innerHTML = '';
    document.getElementById('attachment-preview').style.display = 'none';
    const loadingId = 'start-loading';
    addMessage('agent', 'Conectando com o Núcleo da Squad...', loadingId);
    try {
        const res = await fetch('/api/chat', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                message: 'Um usuário iniciou uma nova sessão de briefing para melhoria do sistema.', 
                history: chatHistory, 
                stage: 'start',
                evolution: true
            }) 
        });
        const data = await res.json();
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        
        const reply = data.reply || "A Squad está pronta para ouvir. O que vamos construir hoje?";
        addMessage('agent', reply);
        chatHistory.push({ role: 'assistant', content: reply });
        currentInterviewStage = data.nextStage || 'start';
        isMetaInterview = true;
    } catch (e) { 
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.innerText = "Falha ao conectar com o Núcleo."; 
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const btn = document.getElementById('theme-toggle');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (btn) btn.innerText = '☀️';
    } else {
        document.body.classList.remove('light-mode');
        if (btn) btn.innerText = '🌙';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    const btn = document.getElementById('theme-toggle');
    if (isLight) {
        if (btn) btn.innerText = '☀️';
        localStorage.setItem('theme', 'light');
    } else {
        if (btn) btn.innerText = '🌙';
        localStorage.setItem('theme', 'dark');
    }
    
    // Re-render chart to update colors if instances exist
    if (typeof stabilityChartInstance !== 'undefined' && stabilityChartInstance) {
        renderStabilityMonitor(); 
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg && currentAttachments.length === 0) return;
    let fileContext = currentAttachments.map(a => `ARQUIVO: ${a.name}\nCONTEÚDO:\n${a.text}`).join('\n\n');
    addMessage('user', msg || "[Enviando anexo]");
    input.value = '';
    document.getElementById('attachment-preview').innerHTML = '';
    document.getElementById('attachment-preview').style.display = 'none';
    const loadingId = 'msg-loading';
    addMessage('agent', '...', loadingId);
    if (fileContext) { projectDraft.specs += `\nReferência de arquivos: ${currentAttachments.map(a => a.name).join(', ')}\n${fileContext}`; }
    try {
        const res = await fetch('/api/chat', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                message: msg, 
                history: chatHistory, 
                stage: currentInterviewStage, 
                fileContext: fileContext,
                evolution: isMetaInterview // PERSIST FLAG
            }) 
        });
        const data = await res.json();
        document.getElementById(loadingId).remove();
        // Remove tag [TITULO:] da mensagem exibida
        const displayReply = data.reply.replace(/\[TITULO:[^\]]+\]/gi, '').trim();
        addMessage('agent', displayReply);

        // Captura título gerado pelo PM
        if (data.generatedTitle) {
            projectDraft.title = data.generatedTitle;
            console.log(`[INTERFACE] Título extraído: "${projectDraft.title}"`);
        } else if (currentInterviewStage === 'start' && msg) {
            // Fallback: usa primeira mensagem do usuário como rascunho de título
            projectDraft.title = msg.substring(0, 60);
        }

        if (msg.toUpperCase().includes('DIYAPP') || msg.toUpperCase().includes('SISTEMA') || isMetaInterview) {
            isMetaInterview = true;
        }

        projectDraft.specs += `\n[P]: ${data.reply.split('?')[0]}? \n[R]: ${msg}`;
        chatHistory.push({ role: 'user', content: msg });
        chatHistory.push({ role: 'assistant', content: data.reply });
        currentInterviewStage = data.nextStage;
        currentAttachments = [];
        console.log(`[INTERFACE] Avançando: ${currentInterviewStage}`);
    } catch (e) { document.getElementById(loadingId).innerText = "Erro ao conectar."; }
    
    if (currentInterviewStage === 'done') {
        addMessage('agent', '🔄 SQUAD NOTIFICADA: Preparando ambiente de evolução...');
        const btn = document.getElementById('btn-send');
        if (btn) { btn.disabled = true; btn.innerText = 'FIXANDO...'; }
        
        setTimeout(async () => { 
            const success = await createProject(); 
            if (success) {
                alert('✅ SUCESSO: O pedido foi registrado com sucesso! Verifique o painel "Codificando" no Dashboard.');
                document.getElementById('chat-modal').style.display = 'none'; 
                projectDraft = { title: '', goal: '', specs: '' }; 
                isMetaInterview = false;
                await fetchProjects(); 
            } else {
                addMessage('agent', '❌ ERRO DE PERSISTÊNCIA: Não consegui salvar sua solicitação no banco de dados. Por favor, tente novamente ou verifique os logs do servidor.');
            }
            if (btn) { btn.disabled = false; btn.innerText = 'Avançar'; }
        }, 2000);
    }
}

function addMessage(type, text, id = null) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = text.replace(/\n/g, '<br>');
    if (id) div.id = id;
    chatBox.appendChild(div);
    
    // Smooth scroll to bottom
    setTimeout(() => {
        chatBox.scrollTo({
            top: chatBox.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}

async function createProject() {
    // Prioridade: 1) título gerado pelo PM com [TITULO:], 2) mensagens do usuário, 3) fallback genérico
    let title = projectDraft.title;
    const genericFallbacks = ['novo projeto squad', 'nova melhoria', '', null, undefined];
    if (genericFallbacks.includes((title || '').toLowerCase().trim())) {
        // Tenta extrair das mensagens do usuário no histórico de chat
        const userMsgs = chatHistory.filter(h => h.role === 'user').map(h => h.content.trim()).filter(Boolean);
        if (userMsgs.length > 0) {
            // Usa as primeiras duas respostas do usuário para montar um título descritivo
            const raw = userMsgs.slice(0, 2).join(' — ').replace(/\n/g, ' ').trim();
            title = raw.length > 70 ? raw.substring(0, 67) + '...' : raw;
        } else {
            title = 'Nova Melhoria';
        }
    }
    if (isMetaInterview && !title.toUpperCase().includes('DIYAPP')) {
        title = `DIYAPP — ${title}`;
    }
    console.log(`[INTERFACE] Criando projeto: ${title} (Meta: ${isMetaInterview})`);
    try {
        const res = await fetch('/api/projects', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                title: title, 
                description: projectDraft.goal || 'Solicitação via chat.', 
                goal: projectDraft.goal || 'Executar melhoria proposta.', 
                specs: projectDraft.specs 
            }) 
        });
        return res.ok;
    } catch (e) {
        console.error('[ERRO NA CRIAÇÃO]:', e);
        return false;
    }
}

function syncActiveAgents(projectList) {
    // 1. Reset all lights
    agents.forEach(a => {
        const el = document.getElementById(`agent-${a.name.replace(/\s+/g, '-')}`);
        if (el) el.classList.remove('active');
    });

    // 2. Activate based on status OR backlog
    projectList.forEach(p => {
        if (p.Status === 'IN_PROGRESS') {
            if (p.Backlog) {
                try {
                    const tasks = JSON.parse(p.Backlog);
                    tasks.forEach(t => {
                        if (t.status === 'PENDING') {
                            const el = document.getElementById(`agent-${t.agent.replace(/\s+/g, '-')}`);
                            if (el) el.classList.add('active');
                        }
                    });
                } catch(e) {}
            } else if (p.Active_Agent) {
                const el = document.getElementById(`agent-${p.Active_Agent.replace(/\s+/g, '-')}`);
                if (el) el.classList.add('active');
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
