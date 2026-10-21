-- Migração 005 — rotas e encaixes (regras 10–14)
-- Aditiva e NÃO destrutiva: apenas CREATE TABLE/INDEX IF NOT EXISTS.
-- Nenhuma tabela existente é alterada e nenhum dado é apagado.
--
-- `routes` — rota publicada por um motoboy. Permanece disponível para encaixes
-- até que o motoboy a encerre ou cancele (regra 12).
-- Campos de horário/retorno/extensão são TEXTO LIVRE informado pelo motoboy
-- (as regras 10–20 não definem formato). O destino é obrigatório.
-- O valor do encaixe é definido pelo motoboy na rota (decisão de produto).
--
-- `route_fittings` — pedido de encaixe feito por lojista/pessoa física para
-- uma rota. Estados: pendente | aceito | recusado | cancelado (regra 10–14).
-- O solicitante informa origem e destino (regra 10).

-- =========================================================
-- routes — rotas publicadas pelos motoboys
-- =========================================================
CREATE TABLE IF NOT EXISTS routes (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id       uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  destination      text          NOT NULL,
  departure_time   text,
  return_forecast  text,
  distance         text,
  accepts_fittings boolean       NOT NULL DEFAULT true,
  fitting_amount   numeric(10,2),
  status           text          NOT NULL DEFAULT 'publicada'
                   CHECK (status IN ('publicada', 'encerrada', 'cancelada')),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  ended_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_routes_courier ON routes (courier_id);
CREATE INDEX IF NOT EXISTS idx_routes_status  ON routes (status);

-- =========================================================
-- route_fittings — pedidos de encaixe vinculados a uma rota
-- =========================================================
CREATE TABLE IF NOT EXISTS route_fittings (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id         uuid          NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  requester_id     uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  pickup_address   text          NOT NULL,
  dropoff_address  text          NOT NULL,
  amount           numeric(10,2),
  notes            text,
  status           text          NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'aceito', 'recusado', 'cancelado')),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  responded_at     timestamptz,
  cancelled_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_fittings_route     ON route_fittings (route_id);
CREATE INDEX IF NOT EXISTS idx_fittings_requester ON route_fittings (requester_id);

-- Impede que o mesmo solicitante tenha MAIS DE UM encaixe pendente na mesma rota
-- (evita pedidos duplicados). Depois de recusado/cancelado ele pode pedir de novo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fittings_one_pending
  ON route_fittings (route_id, requester_id)
  WHERE status = 'pendente';
