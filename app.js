function renderAgents() {
    const grid = document.getElementById('agent-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    agents.forEach(agent => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        
        // Status light (todos ativos)
        const statusLight = document.createElement('div');
        statusLight.className = 'agent-status-light active';
        
        // Nome do agente
        const nameEl = document.createElement('div');
        nameEl.className = 'agent-name';
        nameEl.textContent = agent.name;
        
        // Descrição do agente
        const descEl = document.createElement('div');
        descEl.className = 'agent-desc';
        descEl.textContent = agent.desc;
        descEl.style.fontSize = '10px';
        descEl.style.color = 'var(--text-secondary)';
        descEl.style.marginTop = '6px';
        descEl.style.lineHeight = '1.3';
        
        // Role (opcional, para mostrar a categoria)
        const roleEl = document.createElement('div');
        roleEl.className = 'agent-role';
        roleEl.textContent = agent.role;
        roleEl.style.fontSize = '9px';
        roleEl.style.color = 'var(--accent-primary)';
        roleEl.style.marginTop = '4px';
        roleEl.style.fontWeight = '500';
        roleEl.style.textTransform = 'uppercase';
        roleEl.style.letterSpacing = '0.05em';
        
        card.appendChild(statusLight);
        card.appendChild(nameEl);
        card.appendChild(roleEl);
        card.appendChild(descEl);
        
        grid.appendChild(card);
    });
}