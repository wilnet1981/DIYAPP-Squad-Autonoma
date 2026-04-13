require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

async function onboard() {
    const scope = fs.readFileSync('data/temp_scope_vanusa.txt', 'utf8');
    const nocoBaseUrl = process.env.NOCODB_BASE_URL || 'https://app.nocodb.com';
    const nocoToken = process.env.NOCODB_TOKEN;
    const tableId = process.env.NOCODB_TABLE_ID;

    const payload = {
        Title: "Assistente WhatsApp - Vanusa Gràndo Mentoria",
        Status: "IN_PROGRESS",
        Description: "Assistente inteligente para leads e clientes com integração LearnWorlds.",
        Project_Goal: "Redução de atendimento manual (Vanusa Gràndo Mentoria).",
        Technical_Specs: scope,
        Tokens: 0,
        Active_Agent: "Product Manager"
    };

    try {
        const res = await axios.post(`${nocoBaseUrl}/api/v2/tables/${tableId}/records`, payload, {
            headers: { 'xc-token': nocoToken, 'Content-Type': 'application/json' }
        });
        console.log("SUCESSO: Projeto Vanusa Onboarded (ID: " + res.data.Id + ")");
    } catch (e) {
        console.error("ERRO:", e.response?.data || e.message);
    }
}

onboard();
