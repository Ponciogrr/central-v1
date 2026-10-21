// Erro de aplicação com status HTTP. A mensagem é sempre segura para o cliente
// (não inclui SQL, segredos, URLs ou detalhes de infraestrutura).

export class ErroHttp extends Error {
  readonly status: number
  readonly codigo: string

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.name = 'ErroHttp'
    this.status = status
    this.codigo = codigo
  }
}

// Banco ausente ou indisponível → 503 (mensagem neutra).
export function servicoIndisponivel(): ErroHttp {
  return new ErroHttp(503, 'SERVICO_INDISPONIVEL', 'Serviço temporariamente indisponível.')
}
