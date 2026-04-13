tyle.css]
/* ===== RESET & BASE ===== */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

body {
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    color: #333;
    min-height: 100vh;
    padding: 20px;
}

.app-container {
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

/* ===== HEADER ===== */
.main-header {
    background: linear-gradient(90deg, #2c3e50, #4a6491);
    color: white;
    padding: 24px 32px;
    border-bottom: 5px solid #3498db;
}

.main-header h1 {
    font-size: 2.2rem;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.subtitle {
    font-size: 1rem;
    opacity: 0.9;
    font-weight: 300;
}

/* ===== TABS NAVIGATION ===== */
.tabs-navigation {
    display: flex;
    background: #f8f9fa;
    border-bottom: 2px solid #dee2e6;
    padding: 0 20px;
}

.tab-btn {
    flex: 1;
    padding: 18px 24px;
    background: transparent;
    border: none;
    border-bottom: 4px solid transparent;
    font-size: 1rem;
    font-weight: 500;
    color: #6c757d;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.tab-btn:hover {
    background: #e9ecef;
    color: #495057;
}

.tab-btn.active {
    color: #3498db;
    border-bottom-color: #3498db;
    background: white;
    font-weight: 600;
}

/* ===== TABS CONTENT ===== */
.tabs-content {
    padding: 32px;
}

.tab-pane {
    display: none;
    animation: fadeIn 0.5s ease;
}

.tab-pane.active {
    display: block;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.tab-pane h2 {
    color: #2c3e50;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid #ecf0f1;
    display: flex;
    align-items: center;
    gap: 12px;
}

/* ===== CARDS ===== */
.card {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    border-left: 6px solid #3498db;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.card h3 {
    color: #2c3e50;
    margin-bottom: 16px;
    font-size: 1.3rem;
}

/* ===== FORM ===== */
.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #495057;
}

.form-group input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #ced4da;
    border-radius: 8px;
    font-size: 1rem;
    transition: border 0.3s;
}

.form-group input:focus {
    outline: none;
    border-color: #3498db;
}

/* ===== BOTÕES BASE ===== */
.btn {
    padding: 14px 28px;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-width: 140px;
}

.button-group {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 24px;
}

/* Botões do Sistema (NÃO ALTERAR) */
.btn-primary {
    background-color: #3498db;
    color: white;
}
.btn-primary:hover {
    background-color: #2980b9;
}

.btn-secondary {
    background-color: #6c757d;
    color: white;
}
.btn-secondary:hover {
    background-color: #5a6268;
}

.btn-danger {
    background-color: #e74c3c;
    color: white;
}
.btn-danger:hover {
    background-color: #c0392b;
}

.btn-warning {
    background-color: #f39c12;
    color: white;
}
.btn-warning:hover {
    background-color: #d68910;
}

.btn-success {
    background-color: #27ae60; /* Verde original do sistema */
    color: white;
}
.btn-success:hover {
    background-color: #219653;
}

.btn-info {
    background-color: #17a2b8;
    color: white;
}
.btn-info:hover {
    background-color: #138496;
}

/* ===== BOTÃO ALVO: "Avançar" na Guia Operacional ===== */
/* MODIFICAÇÃO SOLICITADA: Verde com texto branco */
#btn-avancar-operacional.btn-avancar {
    background-color: #28a745; /* Verde */
    color: #ffffff; /* Branco */
    border: 2px solid #28a745;
}

#btn-avancar-operacional.btn-avancar:hover {
    background-color: #218838; /* Verde mais escuro no hover */
    border-color: #1e7e34;
}

/* ===== FOOTER & TEST STATUS ===== */
.main-footer {
    background: #2c3e50;
    color: white;
    padding: 32px;
    margin-top: 40px;
}

.test-status {
    background: rgba(255, 255, 255, 0.1);
    padding: 24px;
    border-radius: 12px;
    margin-bottom: 24px;
}

.test-status h3 {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}

#test-results {
    list-style: none;
}

#test-results li {
    padding: 12px 16px;
    margin-bottom: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: background 0.3s;
}

#test-results li.pass {
    background: rgba(40, 167, 69, 0.2);
    color: #90ee90;
}
#test-results li.fail {
    background: rgba(220, 53, 69, 0.2);
    color: #ffcccb;
}

.copyright {
    text-align: center;
    opacity: 0.7;
    font-size: 0.9rem;
    margin-top: 20px;
}