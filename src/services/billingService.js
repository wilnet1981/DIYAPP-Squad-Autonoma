**
```javascript
export async function processBilling(data) {
    // Validação de entrada
    if (typeof data.tokenCount !== 'number') {
        throw new Error('Invalid token count');
    }

    // Logica de faturamento
    const billingAmount = calculateBilling(data.tokenCount);
    
    return {
        success: true,
        amount: billingAmount
    };
}

function calculateBilling(tokenCount) {
    const ratePerToken = 0.05; // Exemplo de tarifa
    return tokenCount * ratePerToken;
}
```