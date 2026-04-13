```python
import unittest
from unittest.mock import patch
from src.integrations.learnworlds.api import LearnWorldsAPI

class TestLearnWorldsAPI(unittest.TestCase):

    @patch('src.integrations.learnworlds.api.requests.get')
    def test_verificar_matricula(self, mock_get):
        """Teste para verificar se o usuário está matriculado em um produto"""
        
        # Configura o mock para retornar uma resposta bem-sucedida
        mock_get.return_value.ok = True
        mock_get.return_value.json.return_value = {
            "users": [{"email": "cliente@email.com", "courses": [{"name": "Mentoria de Carreira para Executivos"}]}]
        }

        api = LearnWorldsAPI()
        matriculado = api.verificar_matricula("cliente@email.com", "Mentoria de Carreira para Executivos")
        self.assertTrue(matriculado)
```