const express = require('express');
const router = express.Router();

// Exemplo de endpoint para verificar o status do servidor
router.get('/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

module.exports = router;