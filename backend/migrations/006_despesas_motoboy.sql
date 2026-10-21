-- Migração 006 — despesas do motoboy (contabilidade pessoal, opcional).
-- Aditiva e NÃO destrutiva: apenas CREATE TABLE/INDEX IF NOT EXISTS.
-- Nenhuma tabela existente é alterada e nenhum dado é apagado.
--
-- `courier_expenses` — lançamentos de despesa DECLARADOS pelo próprio motoboy
-- (combustível, manutenção, etc.). São informações PESSOAIS informadas pelo
-- motoboy; NÃO são despesas verificadas pela plataforma. Cada linha pertence a
-- UM motoboy (courier_id) e só ele pode ver/editar/excluir a linha — a
-- identidade vem SEMPRE do middleware de autenticação, nunca do app.
--
-- `expense_date` é a data declarada da despesa (dia, sem hora). `category` é
-- limitado às opções do produto; `amount` reutiliza numeric(10,2) como as demás
-- tabelas monetárias.

CREATE TABLE IF NOT EXISTS courier_expenses (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id   uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category     text          NOT NULL
               CHECK (category IN ('gasolina', 'oleo', 'manutencao', 'outros')),
  amount       numeric(10,2) NOT NULL
               CHECK (amount >= 0 AND amount <= 99999999.99),
  expense_date date          NOT NULL,
  notes        text,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_courier      ON courier_expenses (courier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_courier_date ON courier_expenses (courier_id, expense_date);
