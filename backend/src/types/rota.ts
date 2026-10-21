// Tipos de rota e encaixe (regras 10–14).
// Os valores espelham o CHECK das colunas criadas na migração 005.

export type StatusRota = 'publicada' | 'encerrada' | 'cancelada'

export type StatusEncaixe = 'pendente' | 'aceito' | 'recusado' | 'cancelado'
