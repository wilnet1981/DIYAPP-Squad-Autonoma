const orchestrator = require('../services/orchestrator');
const store = require('../services/store');
const fs = require('fs');

console.log('--- TESTE DE BATIMENTO INDUSTRIAL ---');
console.log('Ambiente:', process.env.NODE_ENV || 'development');

async function test() {
    try {
        console.log('1. Testando Store...');
        const projects = await store.getProjects();
        console.log(`Sucesso! Projetos encontrados: ${projects.length}`);

        console.log('2. Testando Ciclo do Orquestrador...');
        // Modifiquei o start para ser visível aqui
        await orchestrator.start();
        console.log('Cuidado: O start() acima é assíncrono e deve ter disparado logs.');
        
    } catch (e) {
        console.error('!!! ERRO FATAL NO TESTE !!!');
        console.error(e);
    }
}

test();
