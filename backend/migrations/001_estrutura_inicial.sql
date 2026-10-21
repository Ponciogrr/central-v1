-- Migração 001 — estrutura inicial da Central de Motoboys
-- Tabelas essenciais: users, deliveries, delivery_offers, reactivation_requests.
-- Aplicada pelo comando `npm run migrate` (ver src/db/migrate.ts).
-- Não há dados fictícios: nenhuma tabela é populada aqui.

-- =========================================================
-- users — contas (admin, motoboy, lojista, pessoa_fisica)
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text,
  phone            text,
  account_type     text        NOT NULL
                   CHECK (account_type IN ('admin', 'motoboy', 'lojista', 'pessoa_fisica')),
  -- Hash do código de acesso. O código original NUNCA é gravado em texto puro.
  access_code_hash text        NOT NULL UNIQUE,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_account_type ON users (account_type);

-- =========================================================
-- deliveries — solicitações de entrega
-- =========================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id     uuid          NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  courier_id       uuid          REFERENCES users (id) ON DELETE SET NULL,
  pickup_address   text          NOT NULL,
  dropoff_address  text          NOT NULL,
  -- Dinheiro em decimal (nunca ponto flutuante).
  amount           numeric(10,2),
  notes            text,
  status           text          NOT NULL DEFAULT 'aguardando'
                   CHECK (status IN ('aguardando', 'aceita', 'em_rota', 'entregue', 'cancelada')),
  cancel_reason    text,
  cancelled_by_id  uuid          REFERENCES users (id) ON DELETE SET NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  accepted_at      timestamptz,
  started_at       timestamptz,
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_deliveries_requester ON deliveries (requester_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier   ON deliveries (courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status    ON deliveries (status);

-- =========================================================
-- delivery_offers — ofertas exclusivas enviadas a um motoboy
-- =========================================================
CREATE TABLE IF NOT EXISTS delivery_offers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id   uuid        NOT NULL REFERENCES deliveries (id) ON DELETE CASCADE,
  courier_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente', 'aceita', 'recusada', 'expirada')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  responded_at  timestamptz
);

-- Uma entrega tem no máximo UMA oferta pendente por vez (oferta exclusiva).
CREATE UNIQUE INDEX IF NOT EXISTS uq_offers_one_pending
  ON delivery_offers (delivery_id)
  WHERE status = 'pendente';

-- Impede reenviar oferta ao mesmo motoboy para a mesma entrega
-- (já pendente ou já recusada por ele).
CREATE UNIQUE INDEX IF NOT EXISTS uq_offers_active_or_refused
  ON delivery_offers (delivery_id, courier_id)
  WHERE status IN ('pendente', 'recusada');

CREATE INDEX IF NOT EXISTS idx_offers_courier ON delivery_offers (courier_id);

-- =========================================================
-- reactivation_requests — solicitação de reativação de conta
-- Regra do projeto: guardar SOMENTE o estado atual (sem histórico).
-- =========================================================
CREATE TABLE IF NOT EXISTS reactivation_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  status           text        NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'aprovada', 'recusada')),
  rejection_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
