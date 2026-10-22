// Tipos das Rotas do Dia (feature própria, fora das regras 1–81).
// Os valores espelham o CHECK das colunas criadas na migração 008.

export type StatusRotaDia =
  | 'rascunho'
  | 'publicada'
  | 'contratada'
  | 'em_andamento'
  | 'concluida'
  | 'cancelada'

// Estados em que a rota ainda pode ser aceita por um motoboy.
export const ROTA_DIA_ABERTA: StatusRotaDia = 'publicada'
