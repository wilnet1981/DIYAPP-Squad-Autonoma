```typescript
import { ContentService } from '../../../src/core/services/ContentService';

describe('ContentService', () => {
  let contentService: ContentService;

  beforeEach(() => {
    contentService = new ContentService();
  });

  describe('searchContents', () => {
    it('should return LinkedIn tips when searching for "LinkedIn"', async () => {
      const contents = await contentService.searchContents('LinkedIn');
      expect(contents.length).toBeGreaterThan(0);
      expect(contents[0].title).toContain('LinkedIn');
    });

    it('should return empty array when no contents match the query', async () => {
      const contents = await contentService.searchContents('NonExistentQuery');
      expect(contents.length).toBe(0);
    });
  });

  describe('getContentsByProduct', () => {
    it('should return contents for "mentoria-carreira"', async () => {
      const contents = await contentService.getContentsByProduct('mentoria-carreira');
      expect(contents.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown product', async () => {
      const contents = await contentService.getContentsByProduct('unknown-product');
      expect(contents.length).toBe(0);
    });
  });
});
```