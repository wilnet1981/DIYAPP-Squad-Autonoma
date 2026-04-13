```js
document.getElementById('message-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const userInput = document.getElementById('user-input').value;
    
    if(userInput.trim() !== '') {
        addUserMessage(userInput);
        getBotResponse(userInput);
        document.getElementById('user-input').value = '';
    }
});

function addUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.textContent = message;
    document.getElementById('messages').appendChild(messageDiv);
}

function getBotResponse(userInput) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';

    const response = "Procurando por dicas do LinkedIn. Um momento..."; // Exemplo de resposta estática
    messageDiv.textContent = response;
    document.getElementById('messages').appendChild(messageDiv);
}