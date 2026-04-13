const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOCK_FILE = path.join(__dirname, '../data/security_lock.json');
const HISTORY_FILE = path.join(__dirname, '../data/file_history.json');

let securityStatus = {
    lockdown: false,
    reason: '',
    detectedAt: null,
    violator: null
};

function init() {
    if (!fs.existsSync(path.dirname(LOCK_FILE))) {
        fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
    }
    if (fs.existsSync(LOCK_FILE)) {
        try {
            securityStatus = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
        } catch (e) {}
    }
}

function getStatus() {
    return securityStatus;
}

function checkFileWrite(projectId, fileName, content) {
    init();
    if (securityStatus.lockdown) return false;

    const hash = crypto.createHash('md5').update(content).digest('hex');
    let history = {};

    if (fs.existsSync(HISTORY_FILE)) {
        try {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        } catch (e) {}
    }

    const key = `${projectId}:${fileName}`;
    if (!history[key]) {
        history[key] = { hashes: [], count: 0 };
    }

    const lastHash = history[key].hashes[history[key].hashes.length - 1];
    
    if (lastHash === hash) {
        history[key].count++;
        console.log(`[SECURITY] Repetição detectada para ${fileName} (${history[key].count}/3)`);
    } else {
        history[key].count = 0; // Reset if different
    }

    history[key].hashes.push(hash);
    if (history[key].hashes.length > 5) history[key].hashes.shift();

    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    // TRIGGER LOCKDOWN: Se repetir 3 vezes o MESMO conteúdo (IA travada)
    if (history[key].count >= 3) {
        triggerLockdown(`Loop de codificação detectado no arquivo: ${fileName}`, projectId);
        return false;
    }

    return true;
}

function triggerLockdown(reason, projectId) {
    securityStatus = {
        lockdown: true,
        reason: reason,
        detectedAt: new Date().toISOString(),
        violator: projectId
    };
    fs.writeFileSync(LOCK_FILE, JSON.stringify(securityStatus, null, 2));
    console.error(`[!!! SECURITY LOCKDOWN !!!] ${reason}`);
}

function unlock() {
    securityStatus = {
        lockdown: false,
        reason: '',
        detectedAt: null,
        violator: null
    };
    if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
    fs.writeFileSync(LOCK_FILE, JSON.stringify(securityStatus, null, 2));
    console.log('[SECURITY] Lockdown removido pelo Arquiteto.');
}

module.exports = {
    checkFileWrite,
    getStatus,
    unlock,
    triggerLockdown
};
