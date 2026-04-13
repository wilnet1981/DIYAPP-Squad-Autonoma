ESTES_GHERKIN.md]
# Testes de Aceite Gherkin - Botão "Avançar" na Guia Operacional

## Cenário 1: Botão visível na guia operacional com fundo verde e texto branco
**Dado que** estou na página do sistema Core DIYAPP  
**E** naveguei para a "Guia Operacional"  
**Quando** visualizo o botão "Avançar"  
**Então** o botão deve estar visível e interativo  
**E** deve ter cor de fundo verde (#27ae60)  
**E** deve ter texto na cor branca (#ffffff)

## Cenário 2: Verificar contraste de cores (WCAG AA)
**Dado que** estou na guia operacional  
**E** o botão "Avançar" está visível  
**Quando** verifico o contraste entre o texto e o fundo  
**Então** a razão de contraste deve ser de pelo menos 4.5:1 (WCAG AA)  
**E** o botão deve ter um estado de foco visível para navegação por teclado

## Cenário 3: Garantir que a alteração não quebre outros botões do sistema
**Dado que** estou em qualquer guia do sistema (Dashboard, Relatórios, Configurações)  
**Quando** visualizo os botões primários nessas guias  
**Então** eles devem manter a cor azul original (#3498db)  
**E** os botões secundários devem manter a cor cinza (#95a5a6)  
**E** todos os botões devem permanecer funcionais e estilizados corretamente

## Script de Teste Automatizado (Pseudocódigo para CI)