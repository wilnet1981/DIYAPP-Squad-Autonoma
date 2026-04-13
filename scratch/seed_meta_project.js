const axios = require('axios');
require('dotenv').config();

const nocoBaseUrl = process.env.NOCODB_BASE_URL;
const nocoToken = process.env.NOCODB_TOKEN;
const tableId = process.env.NOCODB_TABLE_ID;

const nocoApi = axios.create({
    baseURL: nocoBaseUrl,
    headers: { 'xc-token': nocoToken, 'Content-Type': 'application/json' }
});

const payload = {
    Title: "DIYAPP Evolution - V2 Core",
    Description: "IA criando o futuro da própria plataforma.",
    Status: "PENDING",
    Project_Goal: "Refatorar o sistema de faturamento e tornar o Dashboard premium.",
    Technical_Specs: "Refine o app.js e style.css. Adicione suporte a temas escuros melhores, transições suaves e conserte a renderização de colunas de tokens (que as vezes chegam como string)."
};

async function seed() {
    try {
        const res = await nocoApi.post(`/api/v2/tables/${tableId}/records`, payload);
        console.log('Projeto Semente criado com sucesso:', res.data.Id);
    } catch (e) {
        console.error('Falha ao criar semente:', e.response ? e.response.data : e.message);
    }
}

seed();
