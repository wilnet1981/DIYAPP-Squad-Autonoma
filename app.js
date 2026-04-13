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
    renderFactory();
    await fetchProjects();
    setInterval(fetchProjects, 10000);
    setInterval(checkSecurityStatus, 5000);
}

async function checkSecurityStatus() {
    try {
        const res = await fetch('/api/security/status');
        const status = await res.json();
        const modal = document.getElementById('security-lockdown-modal');
        const reasonEl = document.getElementById('lockdown-reason');
        
        if (status.lockdown) {
            modal.style.display = 'flex';
            reasonEl.innerText = status.reason;
        } else {
            modal.style.display = 'none';
        }
    } catch (e) { console.error("Erro ao verificar segurança:", e); }
}

async function unlockSystem() {
    try {
        const res = await fetch('/api/security/unlock', { method: 'POST' });
        if (res.ok) {
            document.getElementById('security-lockdown-modal').style.display = 'none';
            fetchProjects();
        }
    } catch (e) { alert("Erro ao destravar sistema."); }
}

function switchView(viewId) {
    document.querySelectorAll('.spa-view').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    
    const navMap = {
        'view-dashboard': 'nav-dashboard',
        'view-softwares': 'nav-softwares',
        'view-factory': 'nav-factory',
        'view-billing': 'nav-billing',
        'view-audit': 'nav-audit',
        'view-stability': 'nav-stability'
    };
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNavId = navMap[viewId];
    if (activeNavId) document.getElementById(activeNavId).classList.add('active');

    if (viewId === 'view-softwares') renderSoftwares();
    if (viewId === 'view-billing') renderBilling(currentProjects);
    if (viewId === 'view-audit') fetchAuditLogs();
    if (viewId === 'view-stability') renderStabilityMonitor();
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

async function fetchAuditLogs() {
    try {
        const res = await fetch('/api/audit');
        const logs = await res.json();
        const feed = document.getElementById('audit-feed');
        if (!feed) return;
        
        feed.innerHTML = logs.map(l => `
            <div class="log-entry">
                <span class="log-time" style="color: #8b949e;">[${new Date(l.timestamp).toLocaleTimeString()}]</span>
                <span style="color: ${l.type === 'success' ? '#3fb950' : '#58a6ff'}; font-weight:600;">[${l.project}]</span> 
                ${l.message}
            </div>
        `).join('');

        document.getElementById('total-actions').innerText = logs.length;
        const totalTokens = currentProjects.reduce((acc, p) => acc + (p.Tokens || 0), 0);
        document.getElementById('total-tokens-spent').innerText = totalTokens.toLocaleString();
    } catch (e) {
        console.error("Erro ao buscar auditoria:", e);
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
        card.innerHTML = `<div class="agent-status-light" id="agent-${a.name.replace(/\s+/g, '-')}"></div><div class="agent-name">${a.name}</div>`;
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
            <div class="agent-tag">${a.category}</div>
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
    const pending = projects.find(p => p.Status === 'AWAITING_APPROVAL');
    const gate = document.getElementById('governance-gate');
    const btnApprove = document.getElementById('btn-approve-deploy');
    const btnView = document.getElementById('btn-view-staging');
    
    if (pending) {
        gate.style.display = 'flex';
        const isPlanning = pending.Active_Agent === 'Aprovador';
        
        if (isPlanning) {
            document.getElementById('approval-msg').innerText = `O Plano de Trabalho para "${pending.Title}" está pronto para revisão.`;
            btnApprove.innerText = 'AUTORIZAR EXECUÇÃO';
            btnView.innerText = 'REVISAR BACKLOG';
        } else {
            document.getElementById('approval-msg').innerText = `O projeto "${pending.Title}" atingiu o portão de segurança SRE.`;
            btnApprove.innerText = 'APROVAR DEPLOY';
            btnView.innerText = 'VER ARQUIVOS';
        }
        
        btnApprove.onclick = () => approveProject(pending.Id, isPlanning);
        btnView.onclick = () => viewStaging(pending.Id, isPlanning);
    } else {
        gate.style.display = 'none';
    }
}

async function viewStaging(id, isPlanning) {
    const listEl = document.getElementById('staging-file-list');
    const titleEl = document.querySelector('#modal-staging h3');
    const descEl = document.querySelector('#modal-staging p');
    
    document.getElementById('modal-staging').style.display = 'flex';
    
    if (isPlanning) {
        titleEl.innerText = 'Revisão de Planejamento (Backlog)';
        descEl.innerText = 'Estas são as tarefas que a squad planejou executar:';
        listEl.innerHTML = 'Carregando planejamento...';
        
        const project = currentProjects.find(p => p.Id === id);
        if (project && project.Backlog) {
            try {
                const tasks = JSON.parse(project.Backlog);
                listEl.innerHTML = tasks.map(t => `<div style="padding: 5px 0; border-bottom: 1px solid #30363d;">
                    <strong style="color:var(--accent-primary);">[${t.agent}]</strong> ${t.task}
                </div>`).join('');
            } catch(e) { listEl.innerHTML = 'Erro ao ler backlog.'; }
        }
    } else {
        titleEl.innerText = 'Inspeção de Quarentena (Staging)';
        descEl.innerText = 'Estes são os arquivos que o sistema pretende sobrescrever na produção:';
        listEl.innerHTML = 'Carregando lista de quarentena...';
        try {
            const res = await fetch(`/api/staging/${id}`);
            const data = await res.json();
            if (data.files && data.files.length > 0) {
                listEl.innerHTML = data.files.map(f => `<div style="padding: 2px 0;">📄 ${f}</div>`).join('');
            } else {
                listEl.innerHTML = '<span style="color: grey;">Nenhum arquivo físico alterado detectado.</span>';
            }
        } catch(e) { listEl.innerHTML = 'Falha ao ler staging.'; }
    }
}


async function approveProject(id, isPlanning) {
    const btn = document.getElementById('btn-approve-deploy');
    const oldText = btn.innerText;
    btn.innerText = 'PROCESSANDO...';
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/tasks/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                projectId: id, 
                type: isPlanning ? 'PLANNING' : 'DEPLOY' 
            })
        });
        if (res.ok) {
            alert(isPlanning ? 'Execução Autorizada! A squad começará a codificar em breve.' : 'Implantação Autorizada! O orquestrador finalizará o processo.');
            await fetchProjects();
        }
    } catch(e) { alert('Erro ao autorizar.'); }
    
    btn.disabled = false;
    btn.innerText = oldText;
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
    const totals = billingData.totals || { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 };
    
    Object.keys(projects).forEach(title => {
        const p = projects[title];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${title}</td>
            <td><span class="status-tag status-done">ATIVA</span></td>
            <td>${(p.breakdown.deepseek || 0).toLocaleString()}</td>
            <td>${(p.breakdown.mistral || 0).toLocaleString()}</td>
            <td>${(p.breakdown.gemini || 0).toLocaleString()}</td>
            <td>${(p.breakdown.openai || 0).toLocaleString()}</td>
            <td>${(p.breakdown.claude || 0).toLocaleString()}</td>
            <td style="font-weight: 700; color: #1D9E75;">${(p.tokens || 0).toLocaleString()}</td>
            <td style="font-weight: 700; color: #238636;">$${(p.cost || 0).toFixed(2)}</td>
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
        labels: ['DeepSeek', 'Mistral', 'Gemini', 'OpenAI', 'Claude'],
        datasets: [{
            data: [data.deepseek, data.mistral, data.gemini, data.openai, data.claude],
            backgroundColor: ['#1D9E75', '#FF8C00', '#0078D4', '#6B3FA0', '#D43F3F'],
            borderWidth: 0
        }]
    };
    if (llmChartInstance) { llmChartInstance.data = chartData; llmChartInstance.update(); }
    else { llmChartInstance = new Chart(ctx, { type: 'pie', data: chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#8b949e' } } } } }); }
}

function renderKanban(projectList) {
    const cols = { 
        'PENDING': document.getElementById('col-todo'), 
        'AWAITING_APPROVAL': document.getElementById('col-todo'), 
        'IN_PROGRESS': document.getElementById('col-doing'),
        'APPROVED_FOR_DEPLOY': document.getElementById('col-doing'),
        'DONE': document.getElementById('col-done')
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
        
        if (p.Backlog) {
            try {
                const tasks = typeof p.Backlog === 'string' ? JSON.parse(p.Backlog) : p.Backlog;
                if (Array.isArray(tasks) && tasks.length > 0) {
                    const doneTasks = tasks.filter(t => t.status === 'DONE').length;
                    const perc = Math.round((doneTasks / tasks.length) * 100);
                    
                    progressHtml = `
                        <div class="progress-container">
                            <div class="progress-fill" style="width: ${perc}%"></div>
                        </div>
                    `;

                    backlogHtml = `
                        <div class="card-backlog">
                            ${tasks.map(t => `
                                <div class="backlog-item ${t.status === 'DONE' ? 'done' : 'pending'}">
                                    <span style="color: #c9d1d9;">• ${t.agent}</span>
                                    <span>${t.status === 'DONE' ? '✅' : '🕒'}</span>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            } catch(e) {}
        }

        cardEl.innerHTML = `
            <div style="font-weight: 600; color: var(--text-bright);">${p.Title}</div>
            ${progressHtml}
            <div class="card-meta">
                <span>#${p.Id.toString().substring(0,6)}</span>
                <span>${(p.Tokens || 0).toLocaleString()} tokens</span>
            </div>
            ${p.Status === 'AWAITING_APPROVAL' ? `<div style="font-size: 10px; color:#ffab00; margin-top:5px; font-weight:700;">⚠️ REVISÃO REQUERIDA</div>` : ''}
            ${p.Status === 'APPROVED_FOR_DEPLOY' ? `<div style="font-size: 10px; color:#3fb950; margin-top:5px; font-weight:700;">✅ APROVADO</div>` : ''}
            ${p.Active_Agent ? `<div style="font-size: 10px; color:var(--accent-primary); margin-top:5px; font-weight:700;">● ${p.Active_Agent}</div>` : ''}
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

function setupEventListeners() {
    document.getElementById('nav-dashboard').onclick = () => switchView('view-dashboard');
    document.getElementById('nav-softwares').onclick = () => switchView('view-softwares');
    document.getElementById('nav-factory').onclick = () => switchView('view-factory');
    document.getElementById('nav-billing').onclick = () => switchView('view-billing');
    document.getElementById('nav-audit').addEventListener('click', () => switchView('view-audit'));
    document.getElementById('nav-stability').addEventListener('click', () => switchView('view-stability'));
    document.getElementById('nav-docs').addEventListener('click', () => { document.getElementById('chat-modal').style.display = 'flex'; startInterview(); });
    document.getElementById('close-modal').onclick = () => { document.getElementById('chat-modal').style.display = 'none'; currentInterviewStage = 'start'; };
    document.getElementById('btn-send').onclick = () => sendChatMessage();
    document.getElementById('btn-unlock-system').onclick = () => unlockSystem();
    document.getElementById('theme-toggle').onclick = () => toggleTheme();
    
    // Auto-refresh audit when in view
    setInterval(() => {
        if (document.getElementById('view-audit').style.display !== 'none') {
            fetchAuditLogs();
        }
    }, 10000);
    document.getElementById('chat-input').onkeypress = (e) => { if (e.key === 'Enter') sendChatMessage(); };
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
                message: 'Iniciando protocolo de ajuste interno no DIYAPP.', 
                history: chatHistory, 
                stage: 'start',
                evolution: true // Signal meta-evolution mode
            }) 
        });
        const data = await res.json();
        document.getElementById(loadingId).remove();
        addMessage('agent', data.reply);
        chatHistory.push({ role: 'assistant', content: data.reply });
        currentInterviewStage = data.nextStage;
        isMetaInterview = true; // Mark session as meta-evolution
    } catch (e) { document.getElementById(loadingId).innerText = "Falha ao iniciar."; }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const icon = document.getElementById('theme-icon');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (icon) icon.innerText = '☀️';
    } else {
        document.body.classList.remove('light-mode');
        if (icon) icon.innerText = '🌙';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    const icon = document.getElementById('theme-icon');
    if (isLight) {
        icon.innerText = '☀️';
        localStorage.setItem('theme', 'light');
    } else {
        icon.innerText = '🌙';
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
        addMessage('agent', data.reply);
        if (currentInterviewStage === 'start') {
            projectDraft.title = msg || 'Nova Melhoria';
        }
        if (msg.toUpperCase().includes('DIYAPP') || msg.toUpperCase().includes('SISTEMA') || isMetaInterview) {
            isMetaInterview = true; // Auto-detect or persist meta intent
            console.log('[INTERFACE] Modo Meta-Evolução Persistido.');
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
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerText = text;
    if (id) div.id = id;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function createProject() {
    let title = projectDraft.title || 'Novo Projeto Squad';
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
