```javascript
const express = require('express');
const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint simulado para receber a mensagem do usuário e responder
app.post('/api/message', (req, res) => {
    const userInput = req.body.message;

    // Simulação de resposta (será melhorada na fase de construção de fluxos)
    let response = "Acesso rápido ao conteúdo que você perguntou está sendo configurado!";
    res.json({ message: response });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});