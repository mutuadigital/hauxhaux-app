import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma } from '@prisma/client'

// Close fechamento: receives final items with quantities (prices are locked from remessa).
// Adjusts consigned stock, saves items with commission calc, creates ContaReceber with valorRepasse.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { dataVencimento, observacoes, itens } = body as {
        dataVencimento?: string
        observacoes?: string
        itens: { produtoId: string; quantidadeConsumida: number; valorUnitario: number }[]
    }

    const fechamento = await prisma.fechamento.findUnique({
        where: { id },
        include: {
            parceiro: { select: { percentualComissao: true } },
            itens: true,
        },
    })
    if (!fechamento) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    if (fechamento.status === 'FECHADO') return NextResponse.json({ error: 'Já fechado' }, { status: 409 })

    const percentualComissao = Number(fechamento.parceiro.percentualComissao ?? 0)
    const validItems = (itens ?? []).filter(i => i.produtoId && Number(i.quantidadeConsumida) > 0)
    const totalValor = validItems.reduce((s, i) => s + Number(i.quantidadeConsumida) * Number(i.valorUnitario), 0)
    const totalQtd = validItems.reduce((s, i) => s + Number(i.quantidadeConsumida), 0)

    // Totals net of commission — this is what HauxHaux receives
    const totalComissao = totalValor * (percentualComissao / 100)
    const totalRepasse = totalValor - totalComissao

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Recreate items with commission calculations
        await tx.fechamentoItem.deleteMany({ where: { fechamentoId: id } })

        for (const item of validItems) {
            const qtd = Number(item.quantidadeConsumida)
            const vlr = Number(item.valorUnitario)
            const itemTotal = qtd * vlr
            const itemComissao = itemTotal * (percentualComissao / 100)
            const itemRepasse = itemTotal - itemComissao

            const estoqueAtual = await tx.estoqueConsignado.findUnique({
                where: { parceiroId_produtoId: { parceiroId: fechamento.parceiroId, produtoId: item.produtoId } },
            })
            const saldoInicial = Number(estoqueAtual?.quantidadeAtual ?? 0)

            await tx.fechamentoItem.create({
                data: {
                    fechamentoId: id,
                    produtoId: item.produtoId,
                    saldoInicial: saldoInicial as unknown as Decimal,
                    quantidadeEnviada: 0,
                    quantidadeDevolvida: 0,
                    quantidadeConsumida: qtd,
                    saldoFinal: Math.max(0, saldoInicial - qtd) as unknown as Decimal,
                    valorUnitario: vlr as unknown as Decimal,
                    valorTotal: itemTotal as unknown as Decimal,
                    valorComissao: itemComissao as unknown as Decimal,
                    valorRepasse: itemRepasse as unknown as Decimal,
                },
            })

            // 2. Deduct from EstoqueConsignado
            await tx.estoqueConsignado.upsert({
                where: { parceiroId_produtoId: { parceiroId: fechamento.parceiroId, produtoId: item.produtoId } },
                create: { parceiroId: fechamento.parceiroId, produtoId: item.produtoId, quantidadeAtual: 0 },
                update: { quantidadeAtual: { decrement: qtd } },
            })
        }

        // 3. Close fechamento
        await tx.fechamento.update({
            where: { id },
            data: {
                status: 'FECHADO',
                dataFechamento: new Date(),
                totalValor,
                totalQuantidade: totalQtd,
                atualizadoPor: session.user?.id ?? null,
            },
        })

        // 4. Create ContaReceber (valorTotal = bruto, valorRepasse = líquido para HauxHaux)
        if (totalRepasse > 0) {
            await tx.contaReceber.create({
                data: {
                    fechamentoId: id,
                    parceiroId: fechamento.parceiroId,
                    descricao: `Competência ${String(fechamento.competenciaMes).padStart(2, '0')}/${fechamento.competenciaAno}`,
                    dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
                    valorTotal: totalValor as unknown as Decimal,
                    valorComissao: totalComissao as unknown as Decimal,
                    valorRepasse: totalRepasse as unknown as Decimal,
                    valorRecebido: 0,
                    saldoAberto: totalRepasse as unknown as Decimal,
                    status: 'EM_ABERTO',
                    observacoes: observacoes || null,
                },
            })
        }
    })

    return NextResponse.json({ ok: true })
}
