const axios = require('axios');
require('dotenv').config();

const nocoBaseUrl = process.env.NOCODB_BASE_URL;
const nocoToken = process.env.NOCODB_TOKEN;
const tableId = process.env.NOCODB_TABLE_ID;

const nocoApi = axios.create({
    baseURL: nocoBaseUrl,
    headers: { 'xc-token': nocoToken, 'Content-Type': 'application/json' }
});

async function diagnostic() {
    try {
        const res = await nocoApi.get(`/api/v2/tables/${tableId}/records`, { params: { limit: 1 } });
        console.log('--- DIAGNÓSTICO DE REGISTRO NOCODB ---');
        console.log(JSON.stringify(res.data.list[0], null, 2));
    } catch (e) {
        console.error('Falha no diagnóstico:', e.response ? e.response.data : e.message);
    }
}

diagnostic();
