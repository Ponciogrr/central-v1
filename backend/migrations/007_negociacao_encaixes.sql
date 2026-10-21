-- Migração 007 — negociação de valor do encaixe (regra 10)
-- Aditiva e NÃO destrutiva: apenas ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- Nenhum dado é apagado e nenhum tipo/constraint existente é alterado.
--
-- Novo fluxo de negociação (decisão do proprietário, out/2026):
--   1. O solicitante (lojista/pessoa física) informa o VALOR que propõe pagar
--      ao pedir o encaixe (coluna `amount` — deixou de ser snapshot da rota).
--   2. O motoboy pode aceitar, recusar ou enviar uma CONTRAPROPOSTA
--      (`counter_amount` + `counter_at`).
--   3. Havendo contraproposta, o cliente aceita (→ 'aceito'; valor acordado =
--      counter_amount) ou recusa (→ 'recusado').
-- O status continua entre os valores originais ('pendente' | 'aceito' |
-- 'recusado' | 'cancelado'); a negociação pendente de decisão do cliente é
-- 'pendente' COM counter_amount preenchido. Não existe preço mínimo por
-- quilômetro e nenhuma coluna guarda quilometragem obrigatória.

ALTER TABLE route_fittings ADD COLUMN IF NOT EXISTS counter_amount numeric(10,2);
ALTER TABLE route_fittings ADD COLUMN IF NOT EXISTS counter_at    timestamptz;
