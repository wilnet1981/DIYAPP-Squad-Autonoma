
// Mock Data for Quotas (Based on platform_config.json)
const config = {
    dailyTokenLimit: 500000,
    dailyUsed: 320000,
    weeklyTokenLimit: 2500000,
    weeklyUsed: 1200000,
    monthlyTokenLimit: 10000000,
    monthlyUsed: 4500000
};

// Agent List (Simplified - in prod we'd fetch squad_roles.json)
const agents = [
    "PM", "PO", "Squad Leader", "Tech Leader", "UX Designer", 
    "Frontend", "Backend", "Infra", "SRE", "Segurança", 
    "Compliance", "Aprovador", "QA", "Especialista LLM", "AI Ops", 
    "Data Engineer", "Inovação", "Tech Writer", "Melhoria Contínua"
];

const cards = [
    { title: "Refatorar Módulo de Login", status: "todo", tokens: "4k" },
    { title: "Criar Landing Page para E-commerce", status: "doing", tokens: "12k" },
    { title: "Dashboard de Vendas v2", status: "doing", tokens: "8k" },
    { title: "Integrar API do Stripe", status: "done", tokens: "15k" }
];

// Initialize UI
function init() {
    updateQuotas();
    renderAgents();
    renderKanban();
    simulateActivity();
}

function updateQuotas() {
    // Daily
    const dailyPerc = (config.dailyUsed / config.dailyTokenLimit) * 100;
    document.getElementById('daily-bar').style.width = dailyPerc + '%';
    document.getElementById('daily-perc').innerText = Math.round(dailyPerc) + '%';
    document.getElementById('daily-label').innerText = `${config.dailyUsed.toLocaleString()} / ${(config.dailyTokenLimit/1000)}k tokens`;

    // Weekly
    const weeklyPerc = (config.weeklyUsed / config.weeklyTokenLimit) * 100;
    document.getElementById('weekly-bar').style.width = weeklyPerc + '%';
    document.getElementById('weekly-perc').innerText = Math.round(weeklyPerc) + '%';
    document.getElementById('weekly-label').innerText = `${config.weeklyUsed.toLocaleString()} / ${(config.weeklyTokenLimit/1000000)}M tokens`;

    // Monthly
    const monthlyPerc = (config.monthlyUsed / config.monthlyTokenLimit) * 100;
    document.getElementById('monthly-bar').style.width = monthlyPerc + '%';
    document.getElementById('monthly-perc').innerText = Math.round(monthlyPerc) + '%';
    document.getElementById('monthly-label').innerText = `${config.monthlyUsed.toLocaleString()} / ${(config.monthlyTokenLimit/1000000)}M tokens`;
}

function renderAgents() {
    const grid = document.getElementById('agent-grid');
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

function renderKanban() {
    cards.forEach(card => {
        const colId = `col-${card.status}`;
        const container = document.getElementById(colId);
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.innerHTML = `
            <div>${card.title}</div>
            <div class="card-meta">
                <span>ID: #${Math.floor(Math.random()*9000)+1000}</span>
                <span>${card.tokens} tokens</span>
            </div>
        `;
        container.appendChild(cardEl);
    });
}

function simulateActivity() {
    setInterval(() => {
        const randomAgent = agents[Math.floor(Math.random() * agents.length)];
        const light = document.getElementById(`agent-${randomAgent.replace(/\s+/g, '-')}`);
        
        if (light) {
            light.classList.add('active');
            
            // Increment usage slightly
            config.dailyUsed += Math.floor(Math.random() * 500);
            updateQuotas();

            setTimeout(() => {
                light.classList.remove('active');
            }, 3000);
        }
    }, 1500);
}

document.addEventListener('DOMContentLoaded', init);
