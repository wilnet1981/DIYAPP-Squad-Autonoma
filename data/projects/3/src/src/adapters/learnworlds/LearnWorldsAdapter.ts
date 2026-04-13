```typescript
import { Content } from '../../core/domain/User';

/**
 * Adapter para integração com a API da LearnWorlds (simulado offline).
 */
export class LearnWorldsAdapter {
  /**
   * Busca conteúdos por palavra-chave (simulação).
   * @param query Termo de busca.
   * @returns Conteúdos encontrados.
   */
  public async searchContents(query: string): Promise<Content[]> {
    // Simulação de chamada à API da LearnWorlds
    console.log(`[LearnWorldsAdapter] Buscando conteúdos para: "${query}"`);
    return [
      {
        id: 'linkedin-tips',
        title: 'Dicas para LinkedIn',
        type: 'link',
        url: 'https://learnworlds.com/vanusa-grando/linkedin-tips',
        description: 'Aprenda a otimizar seu perfil no LinkedIn.',
      },
    ];
  }
}
```