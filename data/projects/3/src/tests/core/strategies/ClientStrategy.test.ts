```typescript
import { ClientStrategy } from '../../../src/core/strategies/ClientStrategy';
import { Message } from '../../../src/core/domain/Message';

describe('ClientStrategy', () => {
  let clientStrategy: ClientStrategy;

  beforeEach(() => {
    clientStrategy = new ClientStrategy();
  });

  describe('processMessage', () => {
    it('should return LinkedIn tips when user asks for "dicas do LinkedIn"', async () => {
      const message: Message = {
        userId: 'client-123',
        text: 'Onde posso ver dicas do LinkedIn?',
        timestamp: new Date(),
      };
      const response = await clientStrategy.processMessage(message);
      expect(response.text).toContain('Dicas para LinkedIn');
      expect(response.text).toContain('https://learnworlds.com');
    });

    it('should return generic response for unknown queries', async () => {
      const message: Message = {
        userId: 'client-123',
        text: 'Pergunta desconhecida',
        timestamp: new Date(),
      };
      const response = await clientStrategy.processMessage(message);
      expect(response.text).toContain('Como posso te ajudar hoje?');
    });
  });
});
```