-- ============================================================
-- Migration: StatusRemessa — adicionar EM_SEPARACAO e ENVIADA,
--            remover CONFIRMADA (migrar dados existentes)
-- Executar no servidor de produção ANTES do deploy do código.
-- ============================================================

-- 1. Adicionar novos valores ao enum existente
ALTER TYPE "StatusRemessa" ADD VALUE IF NOT EXISTS 'EM_SEPARACAO';
ALTER TYPE "StatusRemessa" ADD VALUE IF NOT EXISTS 'ENVIADA';

-- 2. Migrar todos os registros CONFIRMADA → ENVIADA
--    (necessário antes de remover o valor do enum)
UPDATE "remessas_consignacao"
  SET status = 'ENVIADA'::"StatusRemessa"
  WHERE status = 'CONFIRMADA'::"StatusRemessa";

UPDATE "devolucoes_consignacao"
  SET status = 'ENVIADA'::"StatusRemessa"
  WHERE status = 'CONFIRMADA'::"StatusRemessa";

-- 3. Recriar o enum sem o valor CONFIRMADA
--    (PostgreSQL não suporta DROP VALUE diretamente)
ALTER TYPE "StatusRemessa" RENAME TO "StatusRemessa_old";

CREATE TYPE "StatusRemessa" AS ENUM ('RASCUNHO', 'EM_SEPARACAO', 'ENVIADA', 'CANCELADA');

-- 4. Atualizar colunas para usar o novo tipo
ALTER TABLE "remessas_consignacao"
  ALTER COLUMN status TYPE "StatusRemessa"
  USING status::text::"StatusRemessa";

ALTER TABLE "devolucoes_consignacao"
  ALTER COLUMN status TYPE "StatusRemessa"
  USING status::text::"StatusRemessa";

-- 5. Atualizar default da tabela remessas_consignacao
ALTER TABLE "remessas_consignacao"
  ALTER COLUMN status SET DEFAULT 'EM_SEPARACAO'::"StatusRemessa";

-- 6. Remover enum antigo
DROP TYPE "StatusRemessa_old";

-- Verificação final
SELECT 'remessas_consignacao' AS tabela, status, COUNT(*) FROM "remessas_consignacao" GROUP BY status
UNION ALL
SELECT 'devolucoes_consignacao', status, COUNT(*) FROM "devolucoes_consignacao" GROUP BY status;
