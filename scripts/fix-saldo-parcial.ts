/**
 * Script de correção: recalcula saldoAberto e status de todas as contasReceber
 * usando valorRepasse (líquido) como base, em vez de valorTotal (bruto).
 *
 * Executar com: npx tsx scripts/fix-saldo-parcial.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const contas = await prisma.contaReceber.findMany({
        where: {
            status: { in: ['PARCIAL', 'EM_ABERTO'] },
        },
    })

    console.log(`Verificando ${contas.length} conta(s) com status PARCIAL ou EM_ABERTO...`)

    let atualizadas = 0

    for (const conta of contas) {
        const valorRepasse = Number(conta.valorRepasse)
        const valorRecebido = Number(conta.valorRecebido)
        const saldoCorreto = valorRepasse - valorRecebido

        let novoStatus: string
        if (saldoCorreto <= 0) {
            novoStatus = 'RECEBIDO'
        } else if (valorRecebido > 0) {
            novoStatus = 'PARCIAL'
        } else {
            novoStatus = 'EM_ABERTO'
        }

        if (novoStatus !== conta.status || Math.abs(saldoCorreto - Number(conta.saldoAberto)) > 0.001) {
            console.log(
                `  [ATUALIZAR] Conta ${conta.id}: status ${conta.status} → ${novoStatus} | saldo ${conta.saldoAberto} → ${saldoCorreto.toFixed(2)} (repasse: ${valorRepasse}, recebido: ${valorRecebido})`
            )
            await prisma.contaReceber.update({
                where: { id: conta.id },
                data: {
                    saldoAberto: saldoCorreto,
                    status: novoStatus,
                },
            })
            atualizadas++
        }
    }

    console.log(`\nConcluído. ${atualizadas} conta(s) atualizada(s).`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
