// Cliente da API do backend (banco de dados real).
// O endereço vem de VITE_API_URL (.env) com padrão local http://localhost:3000.
// Nenhum segredo do servidor fica aqui — apenas o código de acesso digitado pelo usuário.

const URL_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
)

export class ErroApi extends Error {
  readonly codigo: string
  readonly status: number

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.codigo = codigo
  }
}

export type ContaTipo = 'admin' | 'motoboy' | 'lojista' | 'pessoa_fisica'

export interface UsuarioSessao {
  id: string
  nome: string | null
  papel: ContaTipo
  ativo: boolean
}

export interface RespostaLogin {
  token: string
  tipo: string
  expiraEm: string
  usuario: UsuarioSessao
}

export interface UsuarioAdmin {
  id: string
  nome: string | null
  papel: ContaTipo
  telefone: string | null
  ativo: boolean
  criadoEm: string
}

export interface SolicitacaoReativacao {
  id: string
  usuarioId: string
  nome: string | null
  papel: ContaTipo
  criadoEm: string
}

async function requisitar<T>(
  caminho: string,
  opcoes: { metodo?: string; token?: string; corpo?: unknown } = {},
): Promise<T> {
  const { metodo = 'GET', token, corpo } = opcoes

  let resposta: Response
  try {
    resposta = await fetch(`${URL_BASE}${caminho}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    throw new ErroApi(
      0,
      'SEM_CONEXAO',
      'Não foi possível falar com o servidor. Verifique se a API está em execução.',
    )
  }

  let dados: unknown = null
  try {
    dados = await resposta.json()
  } catch {
    // resposta sem corpo JSON — segue com null
  }

  if (!resposta.ok) {
    const corpoErro = (dados ?? {}) as { erro?: string; codigo?: string }
    throw new ErroApi(
      resposta.status,
      corpoErro.codigo ?? 'ERRO',
      corpoErro.erro ?? `Erro ${resposta.status} do servidor.`,
    )
  }

  return dados as T
}

/** Mensagens amigáveis em pt-BR para os erros mais comuns. Nenhuma inclui segredo. */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroApi) {
    switch (erro.codigo) {
      case 'CREDENCIAL_INVALIDA':
        return 'Código não encontrado. Procure o administrador se você perdeu o código.'
      case 'CONTA_DESATIVADA':
        return erro.message
      case 'AUTH_INDISPONIVEL':
        return 'Autenticação indisponível no servidor. Fale com o administrador do sistema.'
      case 'NAO_AUTENTICADO':
        return 'Sessão expirada ou inválida. Entre novamente.'
      case 'SEM_CONEXAO':
        return erro.message
      default:
        return erro.message
    }
  }
  return 'Erro inesperado. Tente novamente.'
}

export async function login(codigo: string): Promise<RespostaLogin> {
  return requisitar<RespostaLogin>('/auth/login', { metodo: 'POST', corpo: { codigo } })
}

export async function buscarMeuUsuario(token: string): Promise<UsuarioSessao> {
  const r = await requisitar<{ usuario: UsuarioSessao }>('/auth/me', { token })
  return r.usuario
}

export async function listarUsuarios(token: string): Promise<UsuarioAdmin[]> {
  const r = await requisitar<{ usuarios: UsuarioAdmin[]; total: number }>('/admin/users?limite=200', {
    token,
  })
  return r.usuarios
}

export async function criarUsuario(
  token: string,
  dados: { nome: string; tipoConta: ContaTipo; telefone?: string },
): Promise<{ usuario: UsuarioAdmin; codigo: string }> {
  return requisitar<{ usuario: UsuarioAdmin; codigo: string }>('/admin/users', {
    metodo: 'POST',
    token,
    corpo: dados,
  })
}

export async function definirStatusUsuario(token: string, id: string, ativo: boolean): Promise<void> {
  await requisitar(`/admin/users/${id}/status`, { metodo: 'PATCH', token, corpo: { ativo } })
}

export async function substituirCodigo(
  token: string,
  id: string,
): Promise<{ usuario: UsuarioAdmin; codigo: string }> {
  return requisitar<{ usuario: UsuarioAdmin; codigo: string }>(`/admin/users/${id}/replace-code`, {
    metodo: 'POST',
    token,
  })
}

export async function listarReativacoes(token: string): Promise<SolicitacaoReativacao[]> {
  const r = await requisitar<{ solicitacoes: SolicitacaoReativacao[] }>('/admin/reactivations', {
    token,
  })
  return r.solicitacoes
}

export async function aprovarReativacao(token: string, id: string): Promise<void> {
  await requisitar(`/admin/reactivations/${id}/approve`, { metodo: 'POST', token })
}

export async function recusarReativacao(token: string, id: string, motivo?: string): Promise<void> {
  await requisitar(`/admin/reactivations/${id}/reject`, {
    metodo: 'POST',
    token,
    corpo: motivo ? { motivo } : {},
  })
}
