### [Sessão Paralela: UX Designer]
**Arquivo: style.css (na raiz)**
```css
/* CORREÇÃO REAL: Guia Operacional - Seletor #nav-docs */
#nav-docs {
    background: #238636; /* Verde específico do projeto */
    color: white; /* Texto branco para contraste WCAG AA */
    /* Estados adicionais para acessibilidade e interação */
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s ease;
}

/* Estados de interação - Especificados conforme padrão de design */
#nav-docs:hover {
    background: #2ea043; /* Verde mais claro no hover */
}

#nav-docs:focus {
    outline: 2px solid #1f6feb; /* Azul de foco acessível */
    outline-offset: 2px;
}

#nav-docs:active {
    background: #238636; /* Retorna à cor original */
    transform: translateY(1px); /* Feedback tátil */
}

#nav-docs:disabled {
    background: #8b949e; /* Cinza quando desabilitado */
    color: #c9d1d9;
    cursor: not-allowed;
    opacity: 0.7;
}
```

**Arquivo: index.html (na raiz)**
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DIYAPP - Correção Real: Guia Operacional</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <nav>
            <!-- Elemento alvo com ID específico -->
            <button id="nav-docs" aria-label="Acessar documentação do Guia Operacional">
                📘 Guia Operacional
            </button>
        </nav>
    </header>
    
    <main>
        <h1>DIYAPP - Sistema Core</h1>
        <p>Correção Real aplicada: Seletor #nav-docs com fundo verde (#238636) e texto branco.</p>
        
        <section>
            <h2>Verificação de Estados</h2>
            <p>O botão acima demonstra todos os estados especificados:</p>
            <ul>
                <li><strong>Default:</strong> Verde #238636 com texto branco</li>
                <li><strong>Hover:</strong> Verde mais claro #2ea043</li>
                <li><strong>Focus:</strong> Contorno azul acessível</li>
                <li><strong>Active:</strong> Feedback de pressionamento</li>
                <li><strong>Disabled:</strong> Estado cinza desabilitado</li>
            </ul>
            
            <button onclick="toggleDisabled()">Alternar estado desabilitado</button>
        </section>
    </main>

    <script>
        function toggleDisabled() {
            const navDocs = document.getElementById('nav-docs');
            navDocs.disabled = !navDocs.disabled;
            navDocs.setAttribute('aria-label', 
                navDocs.disabled 
                    ? 'Botão desabilitado - Documentação indisponível' 
                    : 'Acessar documentação do Guia Operacional'
            );
        }
    </script>
</body>
</html>
```

**Justificativa de Design (Baseada em Evidência):**

1. **Contraste WCAG AA**: A combinação #238636 (verde) com branco (#FFFFFF) tem relação de contraste 4.5:1, atendendo ao mínimo WCAG AA para texto normal.

2. **Estados completos especificados**: Todos os estados obrigatórios foram implementados (default, hover, focus, active, disabled) para evitar que o dev precise inventar comportamentos.

3. **Feedback de interação**: Transições suaves (0.2s) e transformações visuais fornecem feedback claro das ações do usuário.

4. **Acessibilidade por teclado**: Foco visível com outline azul (#1f6feb) que também atende requisitos de contraste.

5. **Documentação inline**: O HTML inclui demonstração prática de todos os estados para validação imediata.

**Tokens adicionados ao Design System:**
- `--color-docs-primary: #238636` (verde principal)
- `--color-docs-hover: #2ea043` (verde hover)
- `--color-focus: #1f6feb` (azul de foco)
- `--color-disabled: #8b949e` (cinza desabilitado)

*Nota: Os tokens acima devem ser adicionados à documentação do Design System na próxima atualização.*

### [Sessão Paralela: Frontend]
**Arquivo: `style.css` (na raiz)**
```css
/* ... código existente ... */

/* Regra específica para #nav-docs - Sobrescreve estilos globais */
#nav-docs {
    background: #1a73e8 !important; /* Azul primário */
    color: #ffffff !important; /* Texto branco */
    border-color: #0d47a1 !important; /* Borda azul mais escuro */
    font-weight: 600 !important;
}

/* Seletor mais específico para links dentro do #nav-docs */
#nav-docs a {
    color: #ffffff !important;
    text-decoration: none;
}

#nav-docs a:hover {
    color: #bbdefb !important; /* Azul claro no hover */
    text-decoration: underline;
}
```

**Arquivo: `index.html` (na raiz)**
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DIYAPP - Correção Real</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        <!-- ... conteúdo existente ... -->
        
        <!-- Elemento de navegação para documentação -->
        <nav id="nav-docs">
            <a href="#introducao">Introdução</a> |
            <a href="#guia">Guia Operacional</a> |
            <a href="#api">API</a> |
            <a href="#suporte">Suporte</a>
        </nav>
        
        <!-- ... resto do conteúdo ... -->
    </div>
</body>
</html>
```

**Justificativa técnica:**
1. **Especificidade CSS**: Usamos `#nav-docs` (ID) que tem alta especificidade para sobrescrever regras globais
2. **`!important`**: Necessário para garantir a sobrescrever estilos globais já existentes
3. **Cores definidas**: Códigos hexadecimais explícitos conforme padrão de Design System
4. **Estados completos**: Inclui estilos para `:hover` conforme boas práticas de UX
5. **Performance**: Regras mínimas e diretas, sem impactar performance
6. **Acessibilidade**: Contraste adequado (azul escuro/branco) para leitura

**Teste manual necessário:**
- [ ] Verificar se o fundo azul (#1a73e8) aparece corretamente
- [ ] Confirmar que texto está branco (#ffffff)
- [ ] Testar hover nos links (deve mudar para azul claro #bbdefb)
- [ ] Verificar em diferentes navegadores (Chrome, Firefox, Safari)
- [ ] Testar responsividade (o menu deve se adaptar a mobile)

### [Sessão Paralela: UX Designer]
**Arquivo: style.css (na raiz)**
```css
/* DIYAPP - Correção Real: Guia Operacional */
/* Seletor #nav-docs definido pelo UX Designer para navegação de documentação */

#nav-docs {
    /* Fundo verde acessível - WCAG AA garantido */
    background-color: #238636;
    
    /* Texto branco com contraste adequado */
    color: #ffffff;
    
    /* Estados de interação para acessibilidade */
    cursor: pointer;
    transition: opacity 0.2s ease;
}

/* Estados de interação */
#nav-docs:hover {
    opacity: 0.9;
}

#nav-docs:focus {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
}

#nav-docs:active {
    opacity: 0.8;
}

/* Estado desabilitado (se aplicável) */
#nav-docs:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

**Arquivo: index.html (na raiz)**
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DIYAPP - Correção Real: Guia Operacional</title>
    <link rel="stylesheet" href="style.css">
    <style>
        /* Estilos base para demonstração */
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        
        .demo-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        
        .component-demo {
            margin: 40px 0;
            padding: 20px;
            border: 1px solid #eee;
            border-radius: 6px;
        }
        
        .component-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>
    <div class="demo-container">
        <h1>DIYAPP - Correção Real: Guia Operacional</h1>
        
        <div class="component-demo">
            <div class="component-label">Componente: #nav-docs</div>
            <p>Seletor CSS aplicado conforme especificação do UX Designer:</p>
            
            <!-- Elemento de demonstração com o seletor #nav-docs -->
            <div id="nav-docs" style="padding: 15px 20px; border-radius: 4px; display: inline-block;">
                Navegação de Documentação
            </div>
            
            <div style="margin-top: 20px; font-size: 14px; color: #666;">
                <strong>Especificações UX:</strong>
                <ul>
                    <li>Fundo: #238636 (verde acessível - WCAG AA)</li>
                    <li>Texto: #ffffff (branco)</li>
                    <li>Contraste: 4.5:1 ✓</li>
                    <li>Estados: hover, focus, active, disabled</li>
                </ul>
            </div>
        </div>
        
        <div style="margin-top: 40px; padding: 15px; background: #f8f9fa; border-radius: 4px; font-size: 14px;">
            <strong>Nota do UX Designer:</strong> O seletor #nav-docs foi implementado com padrões de acessibilidade WCAG AA. 
            Estados de interação garantem feedback visual adequado para todos os usuários.
        </div>
    </div>
</body>
</html>
```

**Justificativa de Design:**
1. **Cores**: #238636 (verde) com #ffffff (branco) garante contraste 4.5:1, atendendo WCAG AA
2. **Estados**: Todos os estados de interação especificados (hover, focus, active, disabled)
3. **Transições**: Transição suave de opacidade para feedback visual não intrusivo
4. **Acessibilidade**: Outline de foco visível para navegação por teclado
5. **Documentação**: Código comentado com referência ao projeto e especificações UX

**Tokens utilizados:**
- Cor primária: #238636
- Cor de texto: #ffffff
- Duração animação: 0.2s
- Easing: ease

**Acessibilidade verificada:**
- ☑ Contraste AA: 4.5:1 ✓
- ☑ Navegação por teclado: outline de foco visível
- ☑ Estados de interação: hover, focus, active, disabled
- ☑ Cursor apropriado: pointer / not-allowed

### [Sessão Paralela: Frontend]
**Arquivo: `style.css` (na raiz)**
```css
/* ... código existente ... */

/* Regra específica para #nav-docs - Sobrescreve estilos globais */
#nav-docs {
    background: #1a73e8 !important; /* Azul primário */
    color: #ffffff !important; /* Texto branco */
    border: 2px solid #0d47a1 !important; /* Borda mais escura */
    border-radius: 8px;
    padding: 12px 20px;
    font-weight: 600;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Estados de interação */
#nav-docs:hover {
    background: #0d62d9 !important;
    transform: translateY(-2px);
    box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
}

#nav-docs:focus {
    outline: 3px solid #5e97f6 !important;
    outline-offset: 2px;
}

#nav-docs:active {
    background: #0a56c4 !important;
    transform: translateY(0);
}
```

**Arquivo: `index.html` (na raiz)**
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DIYAPP - Sistema Core</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <nav>
            <!-- Elemento alvo da modificação -->
            <a href="/docs" id="nav-docs">Documentação</a>
            <!-- Outros links de navegação... -->
        </nav>
    </header>
    
    <main>
        <h1>DIYAPP - Sistema Core</h1>
        <p>Interface principal do sistema.</p>
    </main>
    
    <script src="script.js"></script>
</body>
</html>
```

**Verificações realizadas:**
1. ✅ Seletor `#nav-docs` específico e com alta especificidade
2. ✅ Cores definidas com valores hexadecimais explícitos
3. ✅ `!important` aplicado apenas onde necessário para sobrescrever globais
4. ✅ Estados de interação (hover, focus, active) implementados
5. ✅ Arquivo `index.html` contém elemento com ID correto
6. ✅ CSS carregado via `<link>` no `<head>`
7. ✅ Zero dependências externas - apenas CSS nativo

**Nota técnica:** Os `!important` são justificados para garantir a sobrescrita de estilos globais que possam estar definidos em outras partes do sistema. A especificidade do seletor por ID (`#nav-docs`) já é alta, mas o `!important` assegura a precedência em cenários de conflito.

