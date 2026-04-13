const express = require('express');
const router = express.Router();

// Mock database de usuários
let users = [
    { id: 1, name: 'William Martins', email: 'william@diyapp.com', role: 'admin' },
    { id: 2, name: 'Admin do Sistema', email: 'admin@diyapp.com', role: 'admin' },
    { id: 3, name: 'João Silva', email: 'joao@example.com', role: 'member' }
];

// Listar usuários
router.get('/', (req, res) => {
    res.json({ users });
});

// Adicionar usuário
router.post('/', (req, res) => {
    const { name, email } = req.body;
    const newUser = {
        id: users.length + 1,
        name,
        email,
        role: 'member'
    };
    users.push(newUser);
    res.status(201).json(newUser);
});

module.exports = router;
