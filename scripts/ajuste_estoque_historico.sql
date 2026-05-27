-- ============================================================
-- AJUSTE COMPLETO DE ESTOQUE — 27/05/2026
-- Objetivo:
--   1. Zerar estoque consignado (reverter todas as remessas passadas)
--   2. Definir estoque interno = exatamente o que foi produzido em 21/05/2026
--   3. Excluir todas as produções anteriores a 21/05/2026
--   4. Excluir movimentos históricos antigos (opcional, comentado)
--
-- Execute SEMPRE dentro de um BEGIN/COMMIT e confira os
-- SELECTs de verificação ANTES de confirmar.
-- ============================================================

BEGIN;

-- ── ANÁLISE PRÉVIA (somente leitura) ────────────────────────────────────────

-- A) Produções do dia 21/05/2026 (nossas "metas" de estoque)
SELECT
    pr.id            AS producao_id,
    pr."codigoLote",
    pt.nome          AS produto,
    pr."quantidadeRealizada",
    pt."unidadeMedida",
    pr.status
FROM "producoes" pr
JOIN "produtos"  pt ON pt.id = pr."produtoId"
WHERE pr."dataProducao"::date = '2026-05-21'
ORDER BY pt.nome;

-- B) Estoque consignado atual (por parceiro + produto)
SELECT
    p.nome           AS parceiro,
    pt.nome          AS produto,
    ec."quantidadeAtual"
FROM "estoque_consignado" ec
JOIN "parceiros" p  ON p.id  = ec."parceiroId"
JOIN "produtos"  pt ON pt.id = ec."produtoId"
WHERE ec."quantidadeAtual" != 0
ORDER BY p.nome, pt.nome;

-- C) Estoque interno atual
SELECT
    pt.nome          AS produto,
    ep."quantidadeAtual"
FROM "estoque_produtos" ep
JOIN "produtos" pt ON pt.id = ep."produtoId"
ORDER BY pt.nome;

-- ── PASSO 1: Zerar estoque consignado e registrar reversão ──────────────────

-- 1a. Criar movimentos de reversão para cada item consignado não-zero
INSERT INTO "movimentos_estoque_produtos"
    ("id", "produtoId", "tipoMovimento", "origemTipo", "origemId",
     "parceiroId", "quantidade", "sinal", "observacao", "criadoPor", "criadoEm")
SELECT
    gen_random_uuid()::text,
    ec."produtoId",
    'AJUSTE_ENTRADA',
    'AJUSTE_HISTORICO',
    'ajuste-2026-05-27',
    ec."parceiroId",
    ec."quantidadeAtual",
    'ENTRADA',
    'Reversão de estoque consignado histórico — ajuste 27/05/2026',
    'sistema',
    NOW()
FROM "estoque_consignado" ec
WHERE ec."quantidadeAtual" > 0;

-- 1b. Zerar todo o estoque consignado
UPDATE "estoque_consignado"
SET "quantidadeAtual" = 0,
    "atualizadoEm"   = NOW()
WHERE "quantidadeAtual" != 0;

-- ── PASSO 2: Ajustar estoque interno para = produções de 21/05/2026 ─────────
-- Para cada produto com produção em 21/05/2026:
--   delta = quantidadeRealizada(21/05) - quantidadeAtual
--   Aplica o delta (positivo = incrementa, negativo = decrementa)

-- 2a. Registrar movimentos de ajuste
INSERT INTO "movimentos_estoque_produtos"
    ("id", "produtoId", "tipoMovimento", "origemTipo", "origemId",
     "quantidade", "sinal", "observacao", "criadoPor", "criadoEm")
SELECT
    gen_random_uuid()::text,
    pr."produtoId",
    CASE WHEN (pr."quantidadeRealizada" - ep."quantidadeAtual") >= 0
         THEN 'AJUSTE_ENTRADA' ELSE 'AJUSTE_SAIDA' END,
    'AJUSTE_HISTORICO',
    'ajuste-2026-05-27',
    ABS(pr."quantidadeRealizada" - ep."quantidadeAtual"),
    CASE WHEN (pr."quantidadeRealizada" - ep."quantidadeAtual") >= 0
         THEN 'ENTRADA' ELSE 'SAIDA' END,
    'Ajuste para meta de produção 21/05/2026',
    'sistema',
    NOW()
FROM (
    -- Pega a maior quantidadeRealizada de produções do dia 21/05 por produto
    SELECT "produtoId", SUM("quantidadeRealizada") AS "quantidadeRealizada"
    FROM "producoes"
    WHERE "dataProducao"::date = '2026-05-21'
      AND status = 'CONFIRMADA'
      AND "quantidadeRealizada" IS NOT NULL
    GROUP BY "produtoId"
) pr
JOIN "estoque_produtos" ep ON ep."produtoId" = pr."produtoId"
WHERE pr."quantidadeRealizada" IS DISTINCT FROM ep."quantidadeAtual";

-- 2b. Aplicar o ajuste no estoque
UPDATE "estoque_produtos" ep
SET "quantidadeAtual" = sub."quantidadeRealizada",
    "atualizadoEm"   = NOW()
FROM (
    SELECT "produtoId", SUM("quantidadeRealizada") AS "quantidadeRealizada"
    FROM "producoes"
    WHERE "dataProducao"::date = '2026-05-21'
      AND status = 'CONFIRMADA'
      AND "quantidadeRealizada" IS NOT NULL
    GROUP BY "produtoId"
) sub
WHERE ep."produtoId" = sub."produtoId";

-- ── PASSO 3: Excluir produções anteriores a 21/05/2026 ──────────────────────

-- 3a. Excluir consumo de insumos das produções antigas
DELETE FROM "producoes_consumo_insumos"
WHERE "producaoId" IN (
    SELECT id FROM "producoes"
    WHERE "dataProducao"::date < '2026-05-21'
);

-- 3b. Excluir as produções antigas
DELETE FROM "producoes"
WHERE "dataProducao"::date < '2026-05-21';

-- ── VERIFICAÇÃO FINAL ────────────────────────────────────────────────────────

-- Estoque interno após ajuste
SELECT
    pt.nome          AS produto,
    ep."quantidadeAtual" AS estoque_interno,
    pt."unidadeMedida"
FROM "estoque_produtos" ep
JOIN "produtos" pt ON pt.id = ep."produtoId"
ORDER BY pt.nome;

-- Estoque consignado (deve ser 0 para todos)
SELECT
    p.nome  AS parceiro,
    pt.nome AS produto,
    ec."quantidadeAtual"
FROM "estoque_consignado" ec
JOIN "parceiros" p  ON p.id  = ec."parceiroId"
JOIN "produtos"  pt ON pt.id = ec."produtoId"
WHERE ec."quantidadeAtual" != 0;
-- (espera-se 0 linhas)

-- Produções restantes (somente >= 21/05/2026)
SELECT
    "codigoLote", "dataProducao"::date, status, "quantidadeRealizada"
FROM "producoes"
ORDER BY "dataProducao" DESC;

-- Se tudo estiver correto:
COMMIT;

-- Se algo deu errado, rode:
-- ROLLBACK;
