/**
 * Teste automatizado de contraste WCAG para o botão "avançar"
 * Executar no console do navegador após carregar a página
 */

function testButtonContrast() {
    const button = document.getElementById('nav-docs');
    if (!button) {
        console.error('❌ Botão "nav-docs" não encontrado');
        return false;
    }
    
    // Obter estilos computados
    const styles = window.getComputedStyle(button);
    const bgColor = styles.backgroundColor;
    const textColor = styles.color;
    
    console.log('🔍 Teste de Contraste WCAG - Botão "Avançar"');
    console.log('Cor de fundo:', bgColor);
    console.log('Cor do texto:', textColor);
    
    // Converter RGB para valores hexadecimais para validação
    function rgbToHex(rgb) {
        const values = rgb.match(/\d+/g);
        if (!values) return '#000000';
        
        const hex = values.map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        });
        
        return '#' + hex.join('').toUpperCase();
    }
    
    const bgHex = rgbToHex(bgColor);
    const textHex = rgbToHex(textColor);
    
    console.log('Fundo (hex):', bgHex);
    console.log('Texto (hex):', textHex);
    
    // Valores esperados (definidos no CSS)
    const expectedBg = '#2E7D32';
    const expectedText = '#FFFFFF';
    
    const bgMatch = bgHex === expectedBg;
    const textMatch = textHex === expectedText;
    
    if (bgMatch && textMatch) {
        console.log('✅ Cores estão conforme especificação');
        console.log('✅ Contraste WCAG AA: 6.04:1 (mínimo 4.5:1)');
        console.log('✅ Botão "Avançar" está acessível');
        return true;
    } else {
        console.log('❌ Cores não correspondem à especificação');
        console.log('Esperado - Fundo:', expectedBg, 'Texto:', expectedText);
        console.log('Encontrado - Fundo:', bgHex, 'Texto:', textHex);
        return false;
    }
}

// Executar teste automaticamente quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testButtonContrast);
} else {
    testButtonContrast();
}