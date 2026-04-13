**
```javascript
export function logRequest(req, res, next) {
    console.log(JSON.stringify({
        level: 'info',
        correlation_id: req.headers['x-correlation-id'] || 'N/A',
        user_id: req.user ? req.user.id : 'guest',
        endpoint: req.method + ' ' + req.originalUrl,
        timestamp: new Date().toISOString(),
    }));
    next();
}