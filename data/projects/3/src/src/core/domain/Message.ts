```typescript
export interface Message {
  userId: string;
  text: string;
  timestamp: Date;
}

export interface Response {
  text: string;
  options?: string[]; // Opções para o usuário (ex: ["Ver mais dicas", "Falar com humano"])
}
```