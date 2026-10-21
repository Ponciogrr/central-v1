// Tipos de entrega (solicitações de entrega).
// Os valores devem espelhar o CHECK da coluna `deliveries.status` (migração 001).

export type StatusEntrega = 'aguardando' | 'aceita' | 'em_rota' | 'entregue' | 'cancelada'
