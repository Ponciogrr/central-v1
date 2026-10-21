// Cliente HTTP da API da Central de Motoboys (app Expo).
//
// O endereço vem de EXPO_PUBLIC_API_URL (arquivo mobile/.env). NUNCA coloque
// segredos do servidor aqui: tudo que começa com EXPO_PUBLIC_ vai para o app.
// Códigos de acesso e tokens NÃO são registrados em log.

export type Papel = 'admin' | 'motoboy' | 'lojista' | 'pessoa_fisica'

export interface UsuarioApi {
  id: string
  nome: string | null
  papel: Papel
  ativo: boolean
}

export interface SessaoApi {
  token: string
  tipo: string
  expiraEm: string
  usuario: UsuarioApi
}

// Erro com mensagem já pronta para o usuário (sem detalhes internos/segredos).
export class ErroApi extends Error {
  readonly codigo: string
  readonly status: number | null

  constructor(mensagem: string, codigo: string, status: number | null) {
    super(mensagem)
    this.name = 'ErroApi'
    this.codigo = codigo
    this.status = status
  }
}

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '')

function endereco(caminho: string): string {
  if (!BASE) {
    throw new ErroApi(
      'O endereço da API não está configurado no aplicativo. Defina EXPO_PUBLIC_API_URL no arquivo mobile/.env.',
      'SEM_CONFIGURACAO',
      null,
    )
  }
  return BASE + caminho
}

async function requisitar(caminho: string, opcoes?: RequestInit): Promise<unknown> {
  let resposta: Response
  try {
    resposta = await fetch(endereco(caminho), opcoes)
  } catch {
    throw new ErroApi(
      'Não foi possível falar com o servidor. Confira a conexão e se a API está ligada.',
      'SEM_CONEXAO',
      null,
    )
  }

  let corpo: unknown = null
  try {
    corpo = await resposta.json()
  } catch {
    corpo = null
  }

  if (!resposta.ok) {
    const dados = (corpo ?? {}) as { erro?: unknown; codigo?: unknown }
    const mensagem =
      typeof dados.erro === 'string' && dados.erro.trim().length > 0
        ? dados.erro
        : 'Não foi possível concluir a operação.'
    const codigo = typeof dados.codigo === 'string' ? dados.codigo : 'ERRO_DESCONHECIDO'
    throw new ErroApi(mensagem, codigo, resposta.status)
  }

  return corpo
}

// POST /auth/login — envia SOMENTE o código; o papel é sempre decidido pelo servidor.
export async function login(codigo: string): Promise<SessaoApi> {
  const corpo = await requisitar('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo: codigo.trim() }),
  })
  return corpo as SessaoApi
}

// GET /auth/me — devolve o usuário atual segundo o servidor (papel atualizado).
export async function buscarMeuUsuario(token: string): Promise<UsuarioApi> {
  const corpo = (await requisitar('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })) as { usuario?: UsuarioApi }
  if (!corpo?.usuario) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.usuario
}

// ---------------------------------------------------------------------------
// Entregas (M4.2)
// ---------------------------------------------------------------------------

export type StatusEntrega = 'aguardando' | 'aceita' | 'em_rota' | 'entregue' | 'cancelada'

export interface EntregaApi {
  id: string
  status: StatusEntrega
  coleta: string
  destino: string
  valor: number | null
  observacoes: string | null
  criadoEm: string
  aceitaEm: string | null
  iniciadaEm: string | null
  concluidaEm: string | null
  motivoCancelamento: string | null
  aguardandoSubstituto: boolean
  motivoCancelamentoSubstituto: string | null
}

export interface DadosNovaEntrega {
  coleta: string
  destino: string
  valor: number | null
  observacoes: string | null
}

// Mensagem pronta para exibir ao usuário, sem detalhes internos.
export function mensagemDeErro(falha: unknown): string {
  if (falha instanceof ErroApi) return falha.message
  return 'Não foi possível concluir a operação. Tente novamente.'
}

function cabecalhoAutorizacao(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

// POST /deliveries — cria solicitação (lojista/pessoa_fisica). O servidor decide
// o solicitante pelo token; nada de identidade enviada pelo app.
export async function criarEntrega(
  token: string,
  dados: DadosNovaEntrega,
): Promise<EntregaApi> {
  const corpo = (await requisitar('/deliveries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify(dados),
  })) as { entrega?: EntregaApi }
  if (!corpo?.entrega) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.entrega
}

// GET /deliveries — somente as entregas que o usuário pode consultar.
export async function listarEntregas(token: string): Promise<EntregaApi[]> {
  const corpo = (await requisitar('/deliveries', {
    headers: cabecalhoAutorizacao(token),
  })) as { entregas?: EntregaApi[] }
  return corpo?.entregas ?? []
}

// POST /deliveries/:id/cancel — cancelamento; motivo obrigatório após a aceitação.
export async function cancelarEntrega(
  token: string,
  id: string,
  motivo?: string,
): Promise<EntregaApi> {
  const corpo = (await requisitar(`/deliveries/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({ motivo: motivo?.trim() || null }),
  })) as { entrega?: EntregaApi }
  if (!corpo?.entrega) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.entrega
}

// ---------------------------------------------------------------------------
// Disponibilidade e ofertas (M4.3) — painel do motoboy
// ---------------------------------------------------------------------------

export interface OfertaApi {
  id: string
  entregaId: string
  coleta: string
  destino: string
  valor: number | null
  observacoes: string | null
  expiraEm: string
  criadaEm: string
}

export interface PainelMotoboyApi {
  online: boolean
  ofertas: OfertaApi[]
  entregaAtiva: EntregaApi | null
}

// GET /courier/painel — estado do painel do motoboy (disponibilidade, ofertas e
// entrega ativa). É a chamada usada na consulta periódica do app.
export async function buscarPainelMotoboy(token: string): Promise<PainelMotoboyApi> {
  const corpo = (await requisitar('/courier/painel', {
    headers: cabecalhoAutorizacao(token),
  })) as Partial<PainelMotoboyApi>
  return {
    online: corpo?.online === true,
    ofertas: corpo?.ofertas ?? [],
    entregaAtiva: corpo?.entregaAtiva ?? null,
  }
}

// POST /courier/availability — entra ou sai de serviço.
export async function definirDisponibilidade(token: string, online: boolean): Promise<boolean> {
  const corpo = (await requisitar('/courier/availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({ online }),
  })) as { online?: boolean }
  return corpo?.online === true
}

// POST /courier/offers/:id/accept — aceita uma oferta e devolve a entrega aceita.
export async function aceitarOferta(token: string, id: string): Promise<EntregaApi> {
  const corpo = (await requisitar(`/courier/offers/${id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({}),
  })) as { entrega?: EntregaApi }
  if (!corpo?.entrega) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.entrega
}

// POST /courier/deliveries/:id/start — inicia a rota de uma entrega aceita.
export async function iniciarEntrega(token: string, id: string): Promise<EntregaApi> {
  const corpo = (await requisitar(`/courier/deliveries/${id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({}),
  })) as { entrega?: EntregaApi }
  if (!corpo?.entrega) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.entrega
}

// POST /courier/deliveries/:id/complete — finaliza a entrega em rota.
export async function finalizarEntrega(token: string, id: string): Promise<EntregaApi> {
  const corpo = (await requisitar(`/courier/deliveries/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({}),
  })) as { entrega?: EntregaApi }
  if (!corpo?.entrega) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.entrega
}

// POST /courier/deliveries/:id/cancel — cancelamento pelo motoboy (regra 4).
// Motivo sempre obrigatório; o servidor exige que a entrega seja do motoboy.
export async function cancelarEntregaMotoboy(
  token: string,
  id: string,
  motivo: string,
): Promise<EntregaApi> {
  const corpo = (await requisitar(`/courier/deliveries/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({ motivo: motivo.trim() }),
  })) as { entrega?: EntregaApi }
  if (!corpo?.entrega) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.entrega
}

// POST /courier/offers/:id/decline — recusa uma oferta.
export async function recusarOferta(token: string, id: string): Promise<void> {
  await requisitar(`/courier/offers/${id}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({}),
  })
}

// GET /motoboys/online-count — quantidade de motoboys online (lojista/pessoa).
export async function contarMotoboysOnline(token: string): Promise<number> {
  const corpo = (await requisitar('/motoboys/online-count', {
    headers: cabecalhoAutorizacao(token),
  })) as { online?: number }
  return typeof corpo?.online === 'number' ? corpo.online : 0
}

// ---------------------------------------------------------------------------
// Rotas e encaixes (regras 10–14)
// ---------------------------------------------------------------------------

export type StatusRota = 'publicada' | 'encerrada' | 'cancelada'
export type StatusEncaixe = 'pendente' | 'aceito' | 'recusado' | 'cancelado'

export interface RotaApi {
  id: string
  destino: string
  saidaPrevista: string | null
  retornoPrevisto: string | null
  extensao: string | null
  aceitaEncaixes: boolean
  status: StatusRota
  criadaEm: string
  atualizadaEm: string
  encerradaEm: string | null
}

export interface DadosRota {
  destino: string
  saidaPrevista: string | null
  retornoPrevisto: string | null
  extensao: string | null
  aceitaEncaixes: boolean
}

// Visão do solicitante: inclui o destino da rota e a origem/destino do pedido.
// `valor` é a PROPOSTA do solicitante; `valorContraproposta` é o contra-oferta
// do motoboy (aguardando decisão do cliente); `valorAcordado` só existe quando
// o encaixe está 'aceito' (= contraproposta, quando houve, senão a proposta).
export interface EncaixeSolicitanteApi {
  id: string
  rotaId: string
  destinoRota: string | null
  coleta: string
  destino: string
  valor: number | null
  valorContraproposta: number | null
  contrapropostaEm: string | null
  valorAcordado: number | null
  observacoes: string | null
  status: StatusEncaixe
  criadoEm: string
  respondidoEm: string | null
  canceladoEm: string | null
}

// Visão do motoboy: igual, sem identificar o solicitante (privacidade).
export type EncaixeMotoboyApi = Omit<EncaixeSolicitanteApi, 'destinoRota'>

export interface DadosEncaixe {
  rotaId: string
  coleta: string
  destino: string
  valor: number
  observacoes: string | null
}

// --- Motoboy ---

export async function listarMinhasRotas(
  token: string,
  apenasPublicadas = false,
): Promise<RotaApi[]> {
  const sufixo = apenasPublicadas ? '?apenasPublicadas=true' : ''
  const corpo = (await requisitar(`/routes/mine${sufixo}`, {
    headers: cabecalhoAutorizacao(token),
  })) as { rotas?: RotaApi[] }
  return corpo?.rotas ?? []
}

export async function criarRota(token: string, dados: DadosRota): Promise<RotaApi> {
  const corpo = (await requisitar('/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify(dados),
  })) as { rota?: RotaApi }
  if (!corpo?.rota) throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  return corpo.rota
}

export async function atualizarRota(
  token: string,
  id: string,
  dados: DadosRota,
): Promise<RotaApi> {
  const corpo = (await requisitar(`/routes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify(dados),
  })) as { rota?: RotaApi }
  if (!corpo?.rota) throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  return corpo.rota
}

// Encerra (regra 13) ou cancela uma rota; cancela os encaixes pendentes no servidor.
export async function encerrarRota(
  token: string,
  id: string,
  acao: 'close' | 'cancel',
): Promise<RotaApi> {
  const corpo = (await requisitar(`/routes/${id}/${acao}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({}),
  })) as { rota?: RotaApi }
  if (!corpo?.rota) throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  return corpo.rota
}

export async function listarEncaixesRecebidos(token: string): Promise<EncaixeMotoboyApi[]> {
  const corpo = (await requisitar('/fittings/received', {
    headers: cabecalhoAutorizacao(token),
  })) as { encaixes?: EncaixeMotoboyApi[] }
  return corpo?.encaixes ?? []
}

export async function responderEncaixe(
  token: string,
  id: string,
  acao: 'accept' | 'decline',
): Promise<EncaixeMotoboyApi> {
  const corpo = (await requisitar(`/fittings/${id}/${acao}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({}),
  })) as { encaixe?: EncaixeMotoboyApi }
  if (!corpo?.encaixe) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.encaixe
}

// POST /fittings/:id/counter — contraproposta do motoboy: envia outro valor e
// o pedido fica aguardando a decisão do cliente (aceitar/recusar).
export async function contraproporEncaixe(
  token: string,
  id: string,
  valor: number,
): Promise<EncaixeMotoboyApi> {
  const corpo = (await requisitar(`/fittings/${id}/counter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({ valor }),
  })) as { encaixe?: EncaixeMotoboyApi }
  if (!corpo?.encaixe) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.encaixe
}

// --- Lojista / pessoa física ---

export async function listarRotasDisponiveis(token: string): Promise<RotaApi[]> {
  const corpo = (await requisitar('/routes/available', {
    headers: cabecalhoAutorizacao(token),
  })) as { rotas?: RotaApi[] }
  return corpo?.rotas ?? []
}

export async function solicitarEncaixe(
  token: string,
  dados: DadosEncaixe,
): Promise<EncaixeSolicitanteApi> {
  const corpo = (await requisitar('/fittings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify(dados),
  })) as { encaixe?: EncaixeSolicitanteApi }
  if (!corpo?.encaixe) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.encaixe
}

export async function listarMeusEncaixes(token: string): Promise<EncaixeSolicitanteApi[]> {
  const corpo = (await requisitar('/fittings/mine', {
    headers: cabecalhoAutorizacao(token),
  })) as { encaixes?: EncaixeSolicitanteApi[] }
  return corpo?.encaixes ?? []
}

export async function cancelarEncaixe(
  token: string,
  id: string,
): Promise<EncaixeSolicitanteApi> {
  const corpo = (await requisitar(`/fittings/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({}),
  })) as { encaixe?: EncaixeSolicitanteApi }
  if (!corpo?.encaixe) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.encaixe
}

// POST /fittings/:id/accept-counter — cliente aceita a contraproposta do
// motoboy → encaixe 'aceito' com o valor acordado.
export async function aceitarContraproposta(
  token: string,
  id: string,
): Promise<EncaixeSolicitanteApi> {
  const corpo = (await requisitar(`/fittings/${id}/accept-counter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({}),
  })) as { encaixe?: EncaixeSolicitanteApi }
  if (!corpo?.encaixe) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.encaixe
}

// POST /fittings/:id/reject-counter — cliente recusa a contraproposta →
// encaixe 'recusado' (encerra sem acordo).
export async function recusarContraproposta(
  token: string,
  id: string,
): Promise<EncaixeSolicitanteApi> {
  const corpo = (await requisitar(`/fittings/${id}/reject-counter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({}),
  })) as { encaixe?: EncaixeSolicitanteApi }
  if (!corpo?.encaixe) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.encaixe
}

// ---------------------------------------------------------------------------
// Contabilidade do motoboy: resumo financeiro e despesas pessoais (opcionais)
// ---------------------------------------------------------------------------

export const CATEGORIAS_DESPESA = ['gasolina', 'oleo', 'manutencao', 'outros'] as const
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number]

export interface ResumoDiarioApi {
  data: string // 'AAAA-MM-DD'
  valor: number
  quantidade: number
}

export interface ResumoFinanceiroApi {
  totalEntregas: number
  quantidadeEntregas: number
  totalDespesas: number
  quantidadeDespesas: number
  saldoEstimado: number
  porDia: ResumoDiarioApi[]
}

export interface DespesaApi {
  id: string
  categoria: CategoriaDespesa
  valor: number
  data: string // 'AAAA-MM-DD'
  observacao: string | null
  criadaEm: string
  atualizadaEm: string
}

export interface DadosDespesa {
  categoria: CategoriaDespesa
  valor: number
  data: string // 'AAAA-MM-DD'
  observacao: string | null
}

// GET /courier/financial-summary — resumo das entregas concluídas + despesas no período.
export async function buscarResumoFinanceiro(
  token: string,
  inicio: string,
  fim: string,
): Promise<ResumoFinanceiroApi> {
  const corpo = (await requisitar(
    `/courier/financial-summary?inicio=${inicio}&fim=${fim}`,
    { headers: cabecalhoAutorizacao(token) },
  )) as { resumo?: ResumoFinanceiroApi }
  if (!corpo?.resumo) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.resumo
}

// GET /courier/expenses — despesas do próprio motoboy.
export async function listarDespesas(token: string): Promise<DespesaApi[]> {
  const corpo = (await requisitar('/courier/expenses', {
    headers: cabecalhoAutorizacao(token),
  })) as { despesas?: DespesaApi[] }
  return corpo?.despesas ?? []
}

// POST /courier/expenses — registra uma despesa.
export async function criarDespesa(token: string, dados: DadosDespesa): Promise<DespesaApi> {
  const corpo = (await requisitar('/courier/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify(dados),
  })) as { despesa?: DespesaApi }
  if (!corpo?.despesa) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.despesa
}

// PATCH /courier/expenses/:id — edita uma despesa do próprio motoboy.
export async function atualizarDespesa(
  token: string,
  id: string,
  dados: DadosDespesa,
): Promise<DespesaApi> {
  const corpo = (await requisitar(`/courier/expenses/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify(dados),
  })) as { despesa?: DespesaApi }
  if (!corpo?.despesa) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.despesa
}

// DELETE /courier/expenses/:id — exclui uma despesa do próprio motoboy.
export async function excluirDespesa(token: string, id: string): Promise<void> {
  await requisitar(`/courier/expenses/${id}`, {
    method: 'DELETE',
    headers: cabecalhoAutorizacao(token),
  })
}

// ---------------------------------------------------------------------------
// Administração (painel /admin — web e app). Todos os endpoints exigem
// administrador autenticado; o servidor valida o papel a cada chamada.
// ---------------------------------------------------------------------------

export interface UsuarioAdminApi {
  id: string
  nome: string | null
  papel: Papel
  telefone: string | null
  ativo: boolean
  criadoEm: string
}

export interface ResultadoCodigoAdmin {
  usuario: UsuarioAdminApi
  codigo: string
  aviso: string
}

export interface SolicitacaoReativacaoApi {
  id: string
  usuarioId: string
  nome: string | null
  papel: Papel
  criadoEm: string
}

export type TipoContaCriavel = 'motoboy' | 'lojista' | 'pessoa_fisica'

// GET /admin/users — lista usuários (o servidor nunca devolve o hash do código).
export async function listarUsuariosAdmin(
  token: string,
  opcoes?: { limite?: number; deslocamento?: number },
): Promise<{ usuarios: UsuarioAdminApi[]; total: number }> {
  const params = new URLSearchParams()
  if (opcoes?.limite) params.set('limite', String(opcoes.limite))
  if (opcoes?.deslocamento) params.set('deslocamento', String(opcoes.deslocamento))
  const consulta = params.toString()
  const corpo = (await requisitar(`/admin/users${consulta ? `?${consulta}` : ''}`, {
    headers: cabecalhoAutorizacao(token),
  })) as { usuarios?: UsuarioAdminApi[]; total?: number }
  return { usuarios: corpo.usuarios ?? [], total: corpo.total ?? 0 }
}

// POST /admin/users — cria usuário (motoboy/lojista/pessoa_fisica); o código
// aparece UMA vez na resposta e nunca é guardado pelo aplicativo.
export async function criarUsuarioAdmin(
  token: string,
  dados: { nome: string; telefone: string; tipoConta: TipoContaCriavel },
): Promise<ResultadoCodigoAdmin> {
  const corpo = (await requisitar('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify(dados),
  })) as ResultadoCodigoAdmin
  return corpo
}

// PATCH /admin/users/:id/status — ativa ou desativa a conta.
export async function statusUsuarioAdmin(
  token: string,
  id: string,
  ativo: boolean,
): Promise<UsuarioAdminApi> {
  const corpo = (await requisitar(`/admin/users/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({ ativo }),
  })) as { usuario?: UsuarioAdminApi }
  if (!corpo?.usuario) {
    throw new ErroApi('Resposta inesperada do servidor.', 'RESPOSTA_INVALIDA', null)
  }
  return corpo.usuario
}

// POST /admin/users/:id/replace-code — novo código de acesso (aparece UMA vez).
export async function substituirCodigoAdmin(token: string, id: string): Promise<ResultadoCodigoAdmin> {
  const corpo = (await requisitar(`/admin/users/${id}/replace-code`, {
    method: 'POST',
    headers: cabecalhoAutorizacao(token),
  })) as ResultadoCodigoAdmin
  return corpo
}

// GET /admin/reactivations — solicitações de reativação pendentes.
export async function listarReativacoesAdmin(token: string): Promise<SolicitacaoReativacaoApi[]> {
  const corpo = (await requisitar('/admin/reactivations', {
    headers: cabecalhoAutorizacao(token),
  })) as { solicitacoes?: SolicitacaoReativacaoApi[] }
  return corpo.solicitacoes ?? []
}

// POST /admin/reactivations/:id/approve — aprova e ativa a conta.
export async function aprovarReativacaoAdmin(token: string, id: string): Promise<void> {
  await requisitar(`/admin/reactivations/${id}/approve`, {
    method: 'POST',
    headers: cabecalhoAutorizacao(token),
  })
}

// POST /admin/reactivations/:id/reject — recusa (motivo opcional); conta
// permanece desativada.
export async function recusarReativacaoAdmin(
  token: string,
  id: string,
  motivo?: string,
): Promise<void> {
  await requisitar(`/admin/reactivations/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAutorizacao(token) },
    body: JSON.stringify({ motivo: motivo ?? '' }),
  })
}
