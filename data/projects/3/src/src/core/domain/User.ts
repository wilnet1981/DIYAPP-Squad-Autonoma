```typescript
export type UserRole = 'lead' | 'client';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  products?: Product[]; // Produtos adquiridos (apenas para clientes)
}

export interface Product {
  id: string;
  name: string;
  description: string;
  contents?: Content[]; // Conteúdos associados ao produto
}

export interface Content {
  id: string;
  title: string;
  type: 'video' | 'pdf' | 'link';
  url: string;
  description?: string;
}
```