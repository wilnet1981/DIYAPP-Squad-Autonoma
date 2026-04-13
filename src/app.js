```javascript
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const billingTableBody = document.getElementById('billing-table').querySelector('tbody');

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    function renderBillingData(data) {
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.transactionId}</td>
                <td>${new Date(item.date).toLocaleDateString()}</td>
                <td>${parseFloat(item.amount).toFixed(2)}</td>
                <td>${convertTokens(item.tokens)}</td>
            `;
            billingTableBody.appendChild(row);
        });
    }

    function convertTokens(tokens) {
        if (typeof tokens === 'string') {
            return parseInt(tokens, 10);
        }
        return tokens;
    }

    const sampleData = [
        { transactionId: '1234', date: '2023-09-01', amount: '30', tokens: '1000' },
        { transactionId: '5678', date: '2023-09-02', amount: '45', tokens: 1200 }
    ];

    renderBillingData(sampleData);
});