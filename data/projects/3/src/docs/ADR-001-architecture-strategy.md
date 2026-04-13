```markdown
# ADR-001: Arquitetura Inicial e Estratégia de Fluxos Conversacionais

**Data**: 2024-05-20
**Status**: Aceita
**Autores**: Tech Lead

## CONTEXTO
O assistente precisa lidar com fluxos distintos para leads e clientes, além de integrar-se com a LearnWorlds para acesso a conteúdos. A solução deve ser:
- **Modular**: Para facilitar a adição de novos fluxos ou integrações.
- **Testável**: Cobertura mínima de 80% desde o início.
- **Escalável**: Suportar múltiplos canais (WhatsApp, Web, etc.) no futuro.

## DECISÃO
Adotar uma arquitetura baseada em **camadas** e **padrões de projeto**:
1. **Core**: Lógica de negócio pura (independente de frameworks).
   - **Domain**: Modelos de `User`, `Product`, `Content`.
   - **Services**: `UserService`, `ContentService` (regras de negócio).
   - **Strategies**: Fluxos conversacionais (`LeadStrategy`, `ClientStrategy`) usando o padrão **Strategy** para permitir troca dinâmica de algoritmos.
2. **Adapters**: Integrações externas (LearnWorlds, WhatsApp). Inicialmente simuladas offline.
3. **Interface**: Ponto de entrada para interações (WhatsApp simulado).

## OPÇÕES CONSIDERADAS
- **Opção A**: Arquitetura monolítica com lógica acoplada ao WhatsApp.
  - Prós: Simplicidade inicial.
  - Contras: Dificuldade para escalar ou adicionar novos canais.
- **Opção B**: Arquitetura em camadas com separação de responsabilidades.
  - Prós: Testabilidade, modularidade, escalabilidade.
  - Contras: Complexidade inicial ligeiramente maior.
- **Opção escolhida**: **B** — Justificativa: O projeto tem potencial para crescer (novos canais, fluxos, integrações). A complexidade inicial é justificada pela manutenibilidade a longo prazo.

## CONSEQUÊNCIAS
**Positivas**:
- Facilidade para adicionar novos fluxos ou integrações.
- Testes unitários isolados para cada camada.
- Reutilização de lógica de negócio em múltiplos canais.

**Negativas**:
- Overhead inicial para configurar a estrutura.
- Necessidade de disciplina para manter a separação de camadas.

**Riscos**:
- Acoplamento acidental entre camadas. Mitigação: Revisões de PR e testes de integração.

## REVISÃO
Reavaliar em 3 meses ou após a Fase 3 (Construção).
```