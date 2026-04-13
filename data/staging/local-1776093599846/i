ndex.html]
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DIYAPP — Sistema Core</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <div class="app-container">
        <!-- Cabeçalho do Sistema -->
        <header class="main-header">
            <h1><i class="fas fa-tools"></i> DIYAPP — Sistema Core</h1>
            <p class="subtitle">Squad Integrada | Painel de Controle Operacional</p>
        </header>

        <!-- Barra de Navegação de Guias -->
        <nav class="tabs-navigation">
            <button class="tab-btn active" data-tab="tab-dashboard">
                <i class="fas fa-home"></i> Dashboard
            </button>
            <button class="tab-btn" data-tab="tab-operacional">
                <i class="fas fa-cogs"></i> <strong>Guia Operacional</strong>
            </button>
            <button class="tab-btn" data-tab="tab-relatorios">
                <i class="fas fa-chart-bar"></i> Relatórios
            </button>
            <button class="tab-btn" data-tab="tab-config">
                <i class="fas fa-sliders-h"></i> Configurações
            </button>
        </nav>

        <!-- Conteúdo das Guias -->
        <main class="tabs-content">
            <!-- Guia Dashboard (inicialmente ativa) -->
            <section id="tab-dashboard" class="tab-pane active">
                <h2><i class="fas fa-home"></i> Dashboard</h2>
                <p>Visão geral do sistema e métricas principais.</p>
                <div class="card">
                    <h3>Botão de Exemplo (Dashboard)</h3>
                    <p>Este botão deve manter sua cor original (azul).</p>
                    <button class="btn btn-primary">Salvar Rascunho</button>
                </div>
            </section>

            <!-- Guia Operacional (ALVO DA TAREFA) -->
            <section id="tab-operacional" class="tab-pane">
                <h2><i class="fas fa-cogs"></i> Guia Operacional</h2>
                <p>Área para execução de processos e fluxos de trabalho críticos.</p>
                
                <div class="card">
                    <h3>Processo: Aprovação de Documentos</h3>
                    <p>Revise os detalhes abaixo e prossiga para a próxima etapa.</p>
                    
                    <div class="form-group">
                        <label for="doc-name">Nome do Documento:</label>
                        <input type="text" id="doc-name" value="Relatório Trimestral Q3" readonly>
                    </div>
                    
                    <div class="form-group">
                        <label for="doc-status">Status:</label>
                        <input type="text" id="doc-status" value="Aguardando Aprovação" readonly>
                    </div>
                    
                    <div class="button-group">
                        <!-- BOTÃO ALVO DA TAREFA: "Avançar" na Guia Operacional -->
                        <button id="btn-avancar-operacional" class="btn btn-avancar">
                            <i class="fas fa-arrow-right"></i> Avançar
                        </button>
                        <button class="btn btn-secondary">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </div>

                <div class="card">
                    <h3>Outros Botões no Sistema (Para Teste de Regressão)</h3>
                    <p>Estes botões NÃO devem ser alterados pela mudança no botão "Avançar".</p>
                    <div class="button-group">
                        <button class="btn btn-primary">Primário (Azul)</button>
                        <button class="btn btn-secondary">Secundário (Cinza)</button>
                        <button class="btn btn-danger">Perigo (Vermelho)</button>
                        <button class="btn btn-warning">Aviso (Laranja)</button>
                        <button class="btn btn-success">Sucesso (Verde Original)</button>
                        <button class="btn btn-info">Informação (Azul Claro)</button>
                    </div>
                </div>
            </section>

            <!-- Outras Guias -->
            <section id="tab-relatorios" class="tab-pane">
                <h2><i class="fas fa-chart-bar"></i> Relatórios</h2>
                <p>Geração e visualização de relatórios analíticos.</p>
                <button class="btn btn-primary">Gerar Relatório</button>
            </section>

            <section id="tab-config" class="tab-pane">
                <h2><i class="fas fa-sliders-h"></i> Configurações</h2>
                <p>Ajustes do sistema e preferências.</p>
                <button class="btn btn-primary">Salvar Configurações</button>
            </section>
        </main>

        <!-- Rodapé com Status de Teste -->
        <footer class="main-footer">
            <div class="test-status">
                <h3><i class="fas fa-vial"></i> Status dos Testes de Aceite (QA)</h3>
                <ul id="test-results">
                    <!-- Os resultados dos testes serão injetados aqui via JavaScript -->
                    <li><i class="fas fa-hourglass-half"></i> Testes não executados.</li>
                </ul>
            </div>
            <p class="copyright">© 2023 DIYAPP — Sistema Core. Todos os direitos reservados.</p>
        </footer>
    </div>

    <script src="script.js"></script>
</body>
</html>