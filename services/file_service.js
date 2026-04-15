const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

async function extractTextFromFile(filePath, mimeType) {
    try {
        if (mimeType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            return data.text;
        } 
        
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        }

        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') {
            const workbook = xlsx.readFile(filePath);
            let text = "";
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                text += `\n--- Sheet: ${sheetName} ---\n`;
                text += xlsx.utils.sheet_to_txt(sheet);
            });
            return text;
        }

        if (mimeType === 'application/json' || mimeType === 'text/csv' || mimeType.startsWith('text/')) {
            return fs.readFileSync(filePath, 'utf8');
        }
        
        if (mimeType.startsWith('image/')) {
            return `[IMAGEM DETECTADA: ${path.basename(filePath)}] - O usuário anexou uma imagem como referência visual.`;
        }

        return `[Arquivo do tipo ${mimeType} anexado, mas sem extrator de texto configurado.]`;
    } catch (e) {
        console.error('[FILE SERVICE] Erro na extração:', e.message);
        return `[Erro ao ler arquivo: ${e.message}]`;
    }
}

module.exports = { extractTextFromFile };
