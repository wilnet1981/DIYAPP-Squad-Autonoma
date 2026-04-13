**
```javascript
import { processBilling } from '../services/billingService.js';

export async function handleBillingRequest(req, res) {
    try {
        const result = await processBilling(req.body);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}