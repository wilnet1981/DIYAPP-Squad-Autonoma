const express = require('express');
   const app = express();
   const port = process.env.PORT || 3000;

   app.use(express.json());

   app.get('/', (req, res) => {
     res.send('Assistente WhatsApp da Vanusa Gràndo Mentoria');
   });

   app.listen(port, () => {
     console.log(`Servidor rodando na porta ${port}`);
   });