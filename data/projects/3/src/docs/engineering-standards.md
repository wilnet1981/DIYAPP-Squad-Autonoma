```markdown
# Engineering Standards — Novo App

## 1. Estrutura de Repositório
- `/src/core`: Lógica de negócio pura (sem dependências de frameworks).
- `/src/adapters`: Integrações externas (LearnWorlds, WhatsApp, etc.).
- `/tests`: Testes unitários e de integração (mesma estrutura de `/src`).
- `/docs`: ADRs e documentação técnica.

## 2. Padrões de Código
- **Nomenclatura**:
  - Arquivos: `kebab-case` (ex: `user-service.ts`).
  - Classes: `PascalCase` (ex: `UserService`).
  - Funções/variáveis: `camelCase` (ex: `getUserByEmail`).
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/).
  - Ex: `feat: add user classification strategy`.
- **Testes**:
  - Cobertura mínima de 80%.
  - Nomes de testes: `should [expected behavior] when [scenario]`.
  - Ex: `should return LinkedIn tips when user asks for dicas do LinkedIn`.

## 3. Padrões de API
- **LearnWorlds Adapter**:
  - Métodos devem retornar `Promise<Type>` para lidar com chamadas assíncronas.
  - Simular erros (ex: `404 Not Found`) para testes de resiliência.
- **WhatsApp Adapter**:
  - Mensagens devem ser formatadas em Markdown ou texto simples.
  - Limite de 4096 caracteres por mensagem (limite do WhatsApp).

## 4. Estratégia de Branching
- `main`: Código em produção (protegida, requer PR e revisão).
- `develop`: Integração de features (protegida, requer PR).
- `feature/*`: Desenvolvimento de features (ex: `feature/lead-classification`).
- `hotfix/*`: Correções urgentes (merge direto para `main` e `develop`).

## 5. Dependências
- Novas dependências devem ser justificadas no PR.
- Verificar licenças (priorizar MIT, Apache 2.0).
- Checar vulnerabilidades com `npm audit`.

## 6. Documentação
- Todo PR deve atualizar a documentação relevante (ADRs, README, etc.).
- Decisões técnicas significativas devem ser documentadas em ADRs.
```