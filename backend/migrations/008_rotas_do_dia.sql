-- Migração 008 — Rotas do Dia (feature nova, não existia nas regras 1–81)
-- Aditiva e NÃO destrutiva: apenas CREATE TABLE/INDEX IF NOT EXISTS.
-- Nenhuma tabela existente é alterada e nenhum dado é apagado.
--
-- `daily_routes` — rota de serviço com DATA, publicada pelo solicitante
-- (lojista ou pessoa física) e contratada por UM motoboy.
-- A diferença para `routes` (regras 10–14) é o dia: a rota do dia tem data,
-- valor e um ciclo de estados próprio (rascunho → publicada → contratada →
-- em andamento → concluída), em vez de ficar aberta para negotiation de
-- encaixe. As duas features convivem: `routes` continua sendo o mercado de
-- rotas abertas dos motoboys; `daily_routes` é o pedido de serviço com data.
--
-- Estados (CHECK do banco):
--   rascunho      — criada pelo solicitante, ainda não visível para motoboys
--   publicada     — visível para motoboys (data >= hoje, sem motoboy)
--   contratada    — um motoboy aceitou (data e valor travados)
--   em_andamento  — o motoboy contracted iniciou o serviço
--   concluida     — serviço concluído pelo motoboy
--   cancelada     — cancelada (guarda o motivo e quem cancelou)
-- O histórico é preservado: cancelamento/conclusão não apagam a linha.

-- =========================================================
-- daily_routes — Rotas do Dia
-- =========================================================
CREATE TABLE IF NOT EXISTS daily_routes (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quem publicou (lojista ou pessoa_fisica).
  publisher_id           uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Motoboy que contratou (NULL enquanto a rota está aberta).
  contracted_courier_id  uuid          REFERENCES users (id) ON DELETE SET NULL,
  title                  text          NOT NULL,
  origin                 text          NOT NULL,
  destination            text          NOT NULL,
  -- Dia do serviço (data, sem hora).
  service_date           date          NOT NULL,
  -- Horário de saída em texto livre ("08:30", "tarde", "a combinar").
  departure_time         text,
  -- Paradas/serviços extras em texto livre.
  stops                  text,
  -- Descrição do que precisa ser feito.
  description            text,
  -- Valor oferecido pelo solicitante e valor efetivamente acordado
  -- (podem diferir quando o motoboy negocia no atendimento).
  offered_amount         numeric(10,2),
  agreed_amount          numeric(10,2),
  -- Contraproposta do motoboy no momento do aceite (fica registrada para
  -- auditoria; o valor acordado passa a ser este).
  counter_amount         numeric(10,2),
  counter_at             timestamptz,
  status                 text          NOT NULL DEFAULT 'rascunho'
                         CHECK (status IN ('rascunho', 'publicada', 'contratada',
                                           'em_andamento', 'concluida', 'cancelada')),
  cancel_reason          text,
  cancelled_by_id        uuid          REFERENCES users (id) ON DELETE SET NULL,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now(),
  published_at           timestamptz,
  contracted_at          timestamptz,
  started_at             timestamptz,
  completed_at           timestamptz,
  ended_at               timestamptz
);

CREATE INDEX IF NOT EXISTS idx_daily_routes_publisher ON daily_routes (publisher_id);
CREATE INDEX IF NOT EXISTS idx_daily_routes_courier   ON daily_routes (contracted_courier_id);
CREATE INDEX IF NOT EXISTS idx_daily_routes_status    ON daily_routes (status);
CREATE INDEX IF NOT EXISTS idx_daily_routes_date      ON daily_routes (service_date);

-- Um mesmo solicitante não publica duas vezes a mesma rota no mesmo dia
-- (evita duplicidade acidental no app).
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_routes_publish_once
  ON daily_routes (publisher_id, service_date, origin, destination)
  WHERE status <> 'cancelada';
