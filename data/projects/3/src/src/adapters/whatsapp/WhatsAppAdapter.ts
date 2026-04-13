```typescript
import { Message, Response } from '../../core/domain/Message';

/**
 * Adapter para interação com o WhatsApp (simulado).
 */
export class WhatsAppAdapter {
  /**
   * Envia uma mensagem para o usuário (simulação).
   * @param userId ID do usuário.
   * @param response Resposta do assistente.
   */
  public async sendMessage(userId: string, response: Response): Promise<void> {
    console.log(`[WhatsApp] Mensagem para ${userId}:`);
    console.log(`> ${response.text}`);
    if (response.options) {
      console.log(`Opções: ${response.options.join(' | ')}`);
    }
  }

  /**
   * Recebe uma mensagem do usuário (simulação).
   * @param userId ID do usuário.
   * @param text Texto da mensagem.
   * @returns Mensagem formatada.
   */
  public receiveMessage(userId: string, text: string): Message {
    return {
      userId,
      text,
      timestamp: new Date(),
    };
  }
}
```