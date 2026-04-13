const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

/**
 * Carrega a instrução de um papel e extrai o texto puro para o System Prompt.
 * @param {string} roleFileName Nome do arquivo (ex: pm_instruction.html)
 * @returns {string} O texto limpo das instruções do papel.
 */
function loadSystemPrompt(roleFileName) {
    try {
        const filePath = path.join(__dirname, '../Roles', roleFileName);
        if (!fs.existsSync(filePath)) {
            console.error(`Aviso: Arquivo de role não encontrado: ${roleFileName}`);
            return "Você é um assistente de IA sênior em uma squad autônoma.";
        }

        const html = fs.readFileSync(filePath, 'utf8');
        const $ = cheerio.load(html);

        // Removemos scripts e estilos para economizar tokens
        $('script, style, .layout-sidebar, .card-header').remove();

        // Extraímos o texto total
        let text = $('body').text();

        // Limpeza básica de espaços extras
        text = text.replace(/\s\s+/g, ' ').trim();

        return text;
    } catch (error) {
        console.error(`Erro ao carregar prompt para ${roleFileName}:`, error);
        return "Você é um assistente de IA sênior.";
    }
}

module.exports = { loadSystemPrompt };
