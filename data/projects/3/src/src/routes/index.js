const express = require('express');
   const router = express.Router();

   // Rota exemplo para iniciar integração com o WhatsApp
   router.post('/webhook', (req, res) => {
     // Lógica para tratar mensagens do WhatsApp
     res.send('Mensagem recebida e processada');
   });

   module.exports = router;