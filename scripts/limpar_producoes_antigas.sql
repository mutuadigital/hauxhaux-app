-- ============================================================
-- Limpeza: excluir produções anteriores a 21/05/2026
-- com reversão de estoque para as CONFIRMADAS
-- ============================================================
-- ATENÇÃO: Execute em uma transação e verifique os SELECTs
-- antes de confirmar com COMMIT.
-- ============================================================

BEGIN;

-- 1. Ver o que será afetado
SELECT id, "codigoLote", "produtoId", status, "dataProducao", "quantidadeRealizada"
FROM "producoes"
WHERE "dataProducao" < '2026-05-21'
ORDER BY "dataProducao";

-- 2. Reverter estoque das produções CONFIRMADAS
--    2a. Remover a quantidade produzida do estoque de produtos
UPDATE "estoque_produtos" ep
SET "quantidadeAtual" = ep."quantidadeAtual" - p."quantidadeRealizada"
FROM "producoes" p
WHERE p."produtoId" = ep."produtoId"
  AND p.status = 'CONFIRMADA'
  AND p."dataProducao" < '2026-05-21'
  AND p."quantidadeRealizada" IS NOT NULL
  AND p."quantidadeRealizada" > 0;

--    2b. Devolver os insumos consumidos ao estoque
UPDATE "estoque_insumos" ei
SET "quantidadeAtual" = ei."quantidadeAtual" + pci."quantidadeReal"
FROM "producoes_consumo_insumos" pci
INNER JOIN "producoes" p ON p.id = pci."producaoId"
WHERE pci."insumoId" = ei."insumoId"
  AND p.status = 'CONFIRMADA'
  AND p."dataProducao" < '2026-05-21'
  AND pci."quantidadeReal" IS NOT NULL
  AND pci."quantidadeReal" > 0;

--    2c. Registrar movimentos de ajuste para rastreabilidade
INSERT INTO "movimentos_estoque_produtos"
    ("id", "produtoId", "tipoMovimento", "origemTipo", "origemId", "quantidade", "sinal", "criadoPor", "criadoEm")
SELECT
    gen_random_uuid()::text,
    p."produtoId",
    'AJUSTE_SAIDA',
    'LIMPEZA_HISTORICA',
    p.id,
    p."quantidadeRealizada",
    'SAIDA',
    'sistema',
    NOW()
FROM "producoes" p
WHERE p.status = 'CONFIRMADA'
  AND p."dataProducao" < '2026-05-21'
  AND p."quantidadeRealizada" IS NOT NULL
  AND p."quantidadeRealizada" > 0;

INSERT INTO "movimentos_estoque_insumos"
    ("id", "insumoId", "tipoMovimento", "origemTipo", "origemId", "quantidade", "sinal", "criadoPor", "criadoEm")
SELECT
    gen_random_uuid()::text,
    pci."insumoId",
    'AJUSTE_ENTRADA',
    'LIMPEZA_HISTORICA',
    p.id,
    pci."quantidadeReal",
    'ENTRADA',
    'sistema',
    NOW()
FROM "producoes_consumo_insumos" pci
INNER JOIN "producoes" p ON p.id = pci."producaoId"
WHERE p.status = 'CONFIRMADA'
  AND p."dataProducao" < '2026-05-21'
  AND pci."quantidadeReal" IS NOT NULL
  AND pci."quantidadeReal" > 0;

-- 3. Excluir os registros de consumo dos itens
DELETE FROM "producoes_consumo_insumos"
WHERE "producaoId" IN (
    SELECT id FROM "producoes" WHERE "dataProducao" < '2026-05-21'
);

-- 4. Excluir as produções
DELETE FROM "producoes"
WHERE "dataProducao" < '2026-05-21';

-- 5. Verificar resultado
SELECT COUNT(*) AS producoes_restantes FROM "producoes";
SELECT COUNT(*) AS producoes_excluidas_seriam
FROM (SELECT 1) t; -- referência: quantas foram excluídas

-- Se tudo estiver correto:
COMMIT;

-- Se algo deu errado, rode:
-- ROLLBACK;
