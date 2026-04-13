import requests
import logging

class LearnWorldsAPI:
    def __init__(self):
        self.base_url = "https://vanusagrando.learnworlds.com/api/v2"
        self.headers = {
            "Authorization": "Bearer SEU_TOKEN_AQUI",  # Substituir pelo token real
            "Content-Type": "application/json"
        }
        logging.info("LearnWorldsAPI configurada com base_url: %s", self.base_url)

    def verificar_matricula(self, email: str, produto: str) -> bool:
        logging.info("Verificando matrícula para email: %s no produto: %s", email, produto)
        try:
            # Implementação real: chamar endpoint de usuários da LearnWorlds
            response = requests.get(f"{self.base_url}/users", headers=self.headers, params={"email": email})
            response.raise_for_status()
            # Supondo que a resposta inclui uma chave 'matriculado'
            return response.json().get('matriculado', False)
        except requests.RequestException as e:
            logging.error("Erro na requisição de verificação de matrícula: %s", str(e))
            return False

    def buscar_conteudo(self, email: str, pergunta: str) -> str:
        logging.info("Busca de conteúdo iniciada para email: %s", email)
        try:
            response = requests.get(f"{self.base_url}/conteudos", headers=self.headers, params={"email": email, "pergunta": pergunta})
            response.raise_for_status()
            return response.json().get("conteudo", "Nenhum conteúdo disponível")
        except requests.RequestException as e:
            logging.error("Erro ao buscar conteúdo: %s", str(e))
            raise