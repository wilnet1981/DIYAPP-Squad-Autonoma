const fs = require('fs');
const path = require('path');

const BILLING_FILE = path.join(__dirname, '../data/billing.json');

// Prices per 1M tokens (estimated average Input + Output)
const PRICES = {
    'deepseek': 0.20,
    'mistral': 0.60,
    'gemini': 0.50,
    'openai': 1.50,
    'claude': 3.00,
    'none': 0
};

function init() {
    if (!fs.existsSync(path.dirname(BILLING_FILE))) {
        fs.mkdirSync(path.dirname(BILLING_FILE), { recursive: true });
    }
    if (!fs.existsSync(BILLING_FILE)) {
        fs.writeFileSync(BILLING_FILE, JSON.stringify({ totals: {}, projects: {} }, null, 2));
    }
}

function registerTokens(projectId, projectTitle, provider, amount) {
    init();
    try {
        const data = JSON.parse(fs.readFileSync(BILLING_FILE, 'utf8'));
        const prov = provider.toLowerCase();
        let matched = 'deepseek';
        if (prov.includes('mistral')) matched = 'mistral';
        if (prov.includes('gemini') || prov.includes('google')) matched = 'gemini';
        if (prov.includes('gpt') || prov.includes('openai')) matched = 'openai';
        if (prov.includes('claude') || prov.includes('anthropic')) matched = 'claude';
        
        // 1. Update Provider Totals
        if (!data.totals[matched]) data.totals[matched] = 0;
        data.totals[matched] += amount;

        // 2. Update Project Totals (Consolidated by Base Name)
        // We group versions like "DIYAPP Evolution - V3" into "DIYAPP Evolution"
        const baseTitle = projectTitle.split(' - V')[0].trim();
        if (!data.projects[baseTitle]) {
            data.projects[baseTitle] = { 
                tokens: 0, 
                cost: 0, 
                breakdown: { deepseek: 0, mistral: 0, gemini: 0, openai: 0, claude: 0 },
                lastUpdate: new Date().toISOString()
            };
        }
        
        data.projects[baseTitle].tokens += amount;
        data.projects[baseTitle].breakdown[matched] += amount;
        
        // Calculate Cost
        const cost = (amount / 1000000) * PRICES[matched];
        data.projects[baseTitle].cost += cost;
        data.projects[baseTitle].lastUpdate = new Date().toISOString();

        fs.writeFileSync(BILLING_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('[BILLING ERROR]', e.message); }
}

function getReport() {
    init();
    try {
        return JSON.parse(fs.readFileSync(BILLING_FILE, 'utf8'));
    } catch(e) { return { totals: {}, projects: {} }; }
}

module.exports = { registerTokens, getReport };
