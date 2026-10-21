-- Migração 004 — coordenadas opcionais das entregas (T3, mapa)
-- O endereço textual continua sendo o dado principal e obrigatório. As colunas
-- abaixo guardam a localização marcada opcionalmente pelo usuário no mapa
-- (Leaflet + OpenStreetMap). Todos os quatro campos são OPCIONAIS: entregas
-- antigas e novas sem coordenadas continuam válidas (ficam NULL).
-- Sem CHECK rígido de par: a exigência de lat+lng juntas é validada na API.
-- Aditiva e não destrutiva: apenas ADD COLUMN IF NOT EXISTS; nenhum registro
-- existente é alterado e nenhuma migração anterior é modificada.

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_lat  numeric(9,6);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_lng  numeric(9,6);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS dropoff_lat numeric(9,6);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS dropoff_lng numeric(9,6);
