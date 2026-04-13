const orchestrator = require('./services/orchestrator');
const security = require('./services/security_monitor');

console.log('--- DIAGNÓSTICO DO ORQUESTRADOR ---');
try {
    // Tenta rodar um ciclo manualmente para ver se explode
    orchestrator.getMetrics();
    console.log('Status do Orquestrador:', orchestrator.getMetrics());
} catch (e) {
    console.error('ERRO NO ORQUESTRADOR:', e);
}
