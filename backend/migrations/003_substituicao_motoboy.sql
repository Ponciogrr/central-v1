-- Migração 003 — substituição do motoboy (regra 4, T1.1)
-- Quando o motoboy designado cancela a ATRIBUIÇÃO, a solicitação do cliente é
-- preservada: a entrega volta para 'aguardando' e entra na busca de substituto.
-- Estes campos registram o cancelamento da atribuição e são DISTINTOS de
-- cancel_reason / cancelled_by_id, que continuam exclusivos do cancelamento
-- definitivo pelo solicitante (regras 5 e 6) e da coluna status 'cancelada'.
-- Aditiva e não destrutiva: apenas ADD COLUMN IF NOT EXISTS; entregas antigas
-- ficam com awaiting_substitute = false e os demais campos NULL.
-- O CHECK de status NÃO é alterado.

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS assignment_cancelled_by_id uuid REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS assignment_cancel_reason  text;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS assignment_cancelled_at  timestamptz;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS awaiting_substitute      boolean NOT NULL DEFAULT false;
