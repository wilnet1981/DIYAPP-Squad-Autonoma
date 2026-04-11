require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// NocoDB Configuration
const nocoBaseUrl = process.env.NOCODB_BASE_URL || 'https://app.nocodb.com';
const nocoToken = process.env.NOCODB_TOKEN;
const tableId = process.env.NOCODB_TABLE_ID;

const nocoApi = axios.create({
    baseURL: nocoBaseUrl,
    headers: {
        'xc-token': nocoToken,
        'Content-Type': 'application/json'
    }
});

// API Routes
app.get('/api/projects', async (req, res) => {
    try {
        // If no token, return mock data
        if (!nocoToken || nocoToken.includes('REPLACE')) {
            return res.json({ list: [] });
        }
        
        const response = await nocoApi.get(`/api/v2/tables/${tableId}/records`, {
            params: { limit: 25, sort: '-CreatedAt' }
        });
        res.json(response.data);
    } catch (error) {
        console.error('NocoDB Error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar projetos no NocoDB' });
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        const { title, description, goal, specs } = req.body;
        
        const payload = {
            Title: title,
            Status: 'PENDING',
            Description: description,
            Project_Goal: goal,
            Technical_Specs: specs,
            Tokens: 0,
            Active_Agent: 'Squad Leader'
        };

        if (!nocoToken || nocoToken.includes('REPLACE')) {
            console.log('Mock Mode: Saving project locally (simulated)', payload);
            return res.json({ id: 'mock-' + Date.now(), ...payload });
        }

        const response = await nocoApi.post(`/api/v2/tables/${tableId}/records`, payload);
        res.json(response.data);
    } catch (error) {
        console.error('NocoDB Save Error:', error.message);
        res.status(500).json({ error: 'Erro ao salvar projeto no NocoDB' });
    }
});

// AI Mock Interview logic
app.post('/api/chat', (req, res) => {
    const { message, history, stage } = req.body;
    
    // Simple logic for the PM/PO Interview
    let reply = "";
    let nextStage = stage;

    if (stage === 'start') {
        reply = "Olá! Eu sou o PM da sua squad. Recebi sua ideia inicial. Pode me contar mais sobre o objetivo principal desse software? Quem será o usuário final?";
        nextStage = 'gathering_goal';
    } else if (stage === 'gathering_goal') {
        reply = "Entendido. E em termos de funcionalidades principais, o que não pode faltar na primeira versão (MVP)?";
        nextStage = 'gathering_features';
    } else if (stage === 'gathering_features') {
        reply = "Ótimo. Agora vou passar para o nosso PO para detalhar a parte técnica. Você tem alguma preferência de stack tecnológica ou alguma integração específica?";
        nextStage = 'gathering_tech';
    } else {
        reply = "Excelente! Já tenho informações suficientes para iniciarmos. Vou criar o projeto no Kanban e a squad começará a trabalhar agora mesmo.";
        nextStage = 'done';
    }

    res.json({ reply, nextStage });
});

app.listen(PORT, () => {
    console.log(`DIYAPP Server rodando em http://localhost:${PORT}`);
});
