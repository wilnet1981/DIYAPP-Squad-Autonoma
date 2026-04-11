
let config = {
    dailyTokenLimit: 500000,
    dailyUsed: 0,
    weeklyTokenLimit: 2500000,
    weeklyUsed: 0,
    monthlyTokenLimit: 10000000,
    monthlyUsed: 0
};

const agents = [
    "PM", "PO", "Squad Leader", "Tech Leader", "UX Designer", 
    "Frontend", "Backend", "Infra", "SRE", "Segurança", 
    "Compliance", "Aprovador", "QA", "Especialista LLM", "AI Ops", 
    "Data Engineer", "Inovação", "Tech Writer", "Melhoria Contínua"
];

let currentInterviewStage = 'start';
let projectDraft = { title: '', goal: '', specs: '' };

// Initialize UI
async function init() {
    await fetchProjects();
    renderAgents();
    setupEventListeners();
    simulateActivity();
}

async function fetchProjects() {
    try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        renderKanban(data.list || []);
        
        // Mock update tokens based on database
        if (data.list) {
            config.dailyUsed = data.list.reduce((acc, p) => acc + (p.Tokens || 0), 0);
            updateQuotas();
        }
    } catch (e) {
        console.error("Erro ao carregar projetos do NocoDB:", e);
    }
}

function updateQuotas() {
    const updateBar = (id, used, limit, labelId, percId) => {
        const perc = Math.min((used / limit) * 100, 100);
        document.getElementById(id).style.width = perc + '%';
        document.getElementById(percId).innerText = Math.round(perc) + '%';
        document.getElementById(labelId).innerText = `${used.toLocaleString()} / ${(limit/1000).toLocaleString()}k tokens`;
    };

    updateBar('daily-bar', config.dailyUsed, config.dailyTokenLimit, 'daily-label', 'daily-perc');
    updateBar('weekly-bar', config.weeklyUsed, config.weeklyTokenLimit, 'weekly-label', 'weekly-perc');
    updateBar('monthly-bar', config.monthlyUsed, config.monthlyTokenLimit, 'monthly-label', 'monthly-perc');
}

function renderAgents() {
    const grid = document.getElementById('agent-grid');
    grid.innerHTML = '';
    agents.forEach(name => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.innerHTML = `
            <div class="agent-status-light" id="agent-${name.replace(/\s+/g, '-')}"></div>
            <div class="agent-name">${name}</div>
        `;
        grid.appendChild(card);
    });
}

function renderKanban(projectList) {
    const cols = { 
        'PENDING': document.getElementById('col-todo'),
        'IN_PROGRESS': document.getElementById('col-doing'),
        'DONE': document.getElementById('col-done')
    };

    // Clear columns
    Object.values(cols).forEach(c => {
        const header = c.querySelector('.col-header');
        c.innerHTML = '';
        c.appendChild(header);
    });

    projectList.forEach(p => {
        const container = cols[p.Status] || cols['PENDING'];
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.innerHTML = `
            <div>${p.Title}</div>
            <div class="card-meta">
                <span>ID: #${p.Id || '000'}</span>
                <span>${(p.Tokens || 0).toLocaleString()} tokens</span>
            </div>
        `;
        container.appendChild(cardEl);
    });
}

// CHAT LOGIC
function setupEventListeners() {
    document.getElementById('btn-new-app').onclick = () => {
        document.getElementById('chat-modal').style.display = 'flex';
        startInterview();
    };

    document.getElementById('close-modal').onclick = () => {
        document.getElementById('chat-modal').style.display = 'none';
        currentInterviewStage = 'start';
    };

    document.getElementById('btn-send').onclick = () => sendChatMessage();
    document.getElementById('chat-input').onkeypress = (e) => {
        if (e.key === 'Enter') sendChatMessage();
    };
}

async function startInterview() {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = '';
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '', stage: 'start' })
    });
    const data = await res.json();
    addMessage('agent', data.reply);
    currentInterviewStage = data.nextStage;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    addMessage('user', msg);
    input.value = '';

    // Capture first message as title
    if (currentInterviewStage === 'gathering_goal') projectDraft.title = msg;
    if (currentInterviewStage === 'gathering_features') projectDraft.goal = msg;
    if (currentInterviewStage === 'gathering_tech') projectDraft.specs = msg;

    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, stage: currentInterviewStage })
    });
    const data = await res.json();
    addMessage('agent', data.reply);
    currentInterviewStage = data.nextStage;

    if (currentInterviewStage === 'done') {
        setTimeout(async () => {
            await createProject();
            document.getElementById('chat-modal').style.display = 'none';
            await fetchProjects();
        }, 2000);
    }
}

function addMessage(type, text) {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerText = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function createProject() {
    await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: projectDraft.title || 'Novo App',
            description: projectDraft.goal.substring(0, 50) + '...',
            goal: projectDraft.goal,
            specs: projectDraft.specs
        })
    });
}

function simulateActivity() {
    setInterval(() => {
        const active = agents[Math.floor(Math.random() * agents.length)];
        const el = document.getElementById(`agent-${active.replace(/\s+/g, '-')}`);
        if (el) {
            el.classList.add('active');
            setTimeout(() => el.classList.remove('active'), 2000);
        }
    }, 3000);
}

document.addEventListener('DOMContentLoaded', init);
