document.getElementById('start-chat').onclick = function() {
    const question = prompt("Pergunte algo ao assistente:");
    const response = getResponse(question);
    alert(response);
};

function getResponse(question) {
    const responses = {
        "Onde posso ver dicas do LinkedIn?": "Você pode acessar nossas dicas de LinkedIn diretamente na plataforma LearnWorlds. Entre no módulo de Dicas de Carreira para mais detalhes."
    };

    return responses[question] || "Desculpe, não entendi a pergunta. Por favor, tente novamente.";
}