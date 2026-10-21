export type Papel = 'pessoa' | 'lojista' | 'motoboy' | 'admin'

export type StatusEntrega = 'aguardando' | 'aceita' | 'em_rota' | 'entregue' | 'cancelada'

export interface Ponto {
  nome: string
  lat?: number
  lng?: number
}

export interface Entrega {
  id: string
  descricao: string
  remetente: string
  contato: string
  retirada: Ponto
  destino: Ponto
  status: StatusEntrega
  criadoPor: Papel
  criadoPorId?: string
  criadoEm: string
  aceitaPor?: string
  aceitaPorId?: string
  recusadoPor?: string[]
  ofertaParaId?: string
  ofertaExpiraEm?: string
  valor?: string
  observacoes?: string
  motivoCancelamento?: string
  posicaoMotoboy?: { lat: number; lng: number }
  atualizadoEm?: string
}

export interface EstadoApp {
  papel: Papel | null
  sessaoId: string | null
  motoboyOnline: boolean
  motoboyNome: string
  entregas: Entrega[]
}

export const LABEL_STATUS: Record<StatusEntrega, string> = {
  aguardando: 'Aguardando',
  aceita: 'Aceita',
  em_rota: 'Em rota',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

export const LABEL_PAPEL: Record<Papel, string> = {
  pessoa: 'Pessoa Física',
  lojista: 'Lojista',
  motoboy: 'Motoboy',
  admin: 'Administrador',
}

export const CENTRO_PADRAO = { lat: -23.5505, lng: -46.6333 } // São Paulo
