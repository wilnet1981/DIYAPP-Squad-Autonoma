import logging
from src.integrations.learnworlds.api import LearnWorldsAPI
from src.utils.whatsapp import enviar_mensagem

logging.basicConfig(level=logging.INFO)

class FluxoCliente:
    def __init__(self):
        self.learnworlds = LearnWorldsAPI()
        self.produto = "Mentoria de Carreira para Executivos"
        logging.info("FluxoCliente iniciado para %s", self.produto)

    def identificar_cliente(self, email: str) -> bool:
        logging.info("Verificando matrícula para cliente com email: %s", email)
        matricula = self.learnworlds.verificar_matricula(email, self.produto)
        if matricula:
            logging.info("Cliente verificado: %s", email)
        else:
            logging.warning("Cliente não encontrado: %s", email)
        return matricula

    def buscar_conteudo(self, email: str, pergunta: str) -> str:
        logging.info("Buscando conteúdo para email: %s, pergunta: %s", email, pergunta)
        try:
            resposta = self.learnworlds.buscar_conteudo(email, pergunta)
            logging.info("Conteúdo encontrado e retornado para pergunta: %s", pergunta)
            return resposta
        except Exception as e:
            logging.error("Erro ao buscar conteúdo: %s", str(e))
            raise

    def responder_cliente(self, numero_whatsapp: str, resposta: str):
        logging.info("Enviando resposta para número: %s", numero_whatsapp)
        enviar_mensagem(numero_whatsapp, resposta)

# Exemplo de uso:
# fluxo = FluxoCliente()
# if fluxo.identificar_cliente("cliente@email.com"):
#     resposta = fluxo.buscar_conteudo("cliente@email.com", "cover letter")
#     fluxo.responder_cliente("5511999999999", resposta)