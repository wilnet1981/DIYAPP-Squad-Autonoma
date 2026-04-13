```typescript
import { Content } from '../domain/User';

export class ContentService {
  private static readonly CONTENTS: Record<string, Content[]> = {
    'mentoria-carreira': [
      {
        id: 'linkedin-tips',
        title: 'Dicas para LinkedIn',
        type: 'link',
        url: 'https://learnworlds.com/vanusa-grando/linkedin-tips',
        description: 'Aprenda a otimizar seu perfil no LinkedIn para atrair oportunidades.',
      },
    ],
  };

  /**
   * Busca conteúdos por palavra-chave (simulação offline).
   * @param query Termo de busca (ex: "LinkedIn").
   * @returns Conteúdos encontrados.
   */
  public async searchContents(query: string): Promise<Content[]> {
    const lowerQuery = query.toLowerCase();
    const allContents = Object.values(ContentService.CONTENTS).flat();
    return allContents.filter(content =>
      content.title.toLowerCase().includes(lowerQuery) ||
      content.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Busca conteúdos por ID do produto (simulação offline).
   * @param productId ID do produto (ex: "mentoria-carreira").
   * @returns Conteúdos associados ao produto.
   */
  public async getContentsByProduct(productId: string): Promise<Content[]> {
    return ContentService.CONTENTS[productId] || [];
  }
}
```