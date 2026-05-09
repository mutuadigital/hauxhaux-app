import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma } from '@prisma/client'

// PATCH — edit a sale item (quantity and/or date)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { parceiroId: true } })
    if (!user?.parceiroId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const parceiroId = user.parceiroId

    const { id } = await params
    const body = await req.json()
    const { quantidade, dataVenda } = body as { quantidade?: number; dataVenda?: string }

    const item = await prisma.fechamentoItem.findUnique({
        where: { id },
        include: { fechamento: { select: { parceiroId: true, id: true } }, produto: { select: { precoPadrao: true } } },
    })
    if (!item || item.fechamento.parceiroId !== parceiroId)
        return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const oldQtd = Number(item.quantidadeConsumida)
        const newQtd = quantidade ?? oldQtd
        const diff = newQtd - oldQtd
        const vlr = Number(item.valorUnitario)

        // If quantity changed, update consigned stock
        if (diff !== 0) {
            await tx.estoqueConsignado.update({
                where: { parceiroId_produtoId: { parceiroId, produtoId: item.produtoId } },
                data: { quantidadeAtual: { decrement: diff as unknown as Decimal } },
            })
        }

        // Recalculate values
        const parceiro = await tx.parceiro.findUnique({ where: { id: parceiroId }, select: { percentualComissao: true } })
        const comissaoPct = Number(parceiro?.percentualComissao ?? 0)
        const novoTotal = vlr * newQtd
        const novaComissao = (novoTotal * comissaoPct) / 100
        const novoRepasse = novoTotal - novaComissao

        await tx.fechamentoItem.update({
            where: { id },
            data: {
                quantidadeConsumida: newQtd as unknown as Decimal,
                valorTotal: novoTotal as unknown as Decimal,
                valorComissao: novaComissao as unknown as Decimal,
                valorRepasse: novoRepasse as unknown as Decimal,
                saldoFinal: { decrement: diff as unknown as Decimal },
                ...(dataVenda && { dataVenda: new Date(dataVenda) }),
            },
        })

        // Recalculate fechamento totals
        const allItens = await tx.fechamentoItem.findMany({
            where: { fechamentoId: item.fechamento.id, excluido: false },
        })
        const totalQtd = allItens.reduce((s, i) => s + Number(i.quantidadeConsumida), 0)
        const totalVal = allItens.reduce((s, i) => s + Number(i.valorTotal), 0)
        await tx.fechamento.update({
            where: { id: item.fechamento.id },
            data: {
                totalQuantidade: totalQtd as unknown as Decimal,
                totalValor: totalVal as unknown as Decimal,
            },
        })
    })

    return NextResponse.json({ ok: true })
}

// DELETE (soft) — mark as excluido, restore stock, recalculate fechamento
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { parceiroId: true } })
    if (!user?.parceiroId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const parceiroId = user.parceiroId

    const { id } = await params

    const item = await prisma.fechamentoItem.findUnique({
        where: { id },
        include: { fechamento: { select: { parceiroId: true, id: true, status: true } } },
    })
    if (!item || item.fechamento.parceiroId !== parceiroId)
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (item.excluido)
        return NextResponse.json({ error: 'Já excluída' }, { status: 400 })

    const qtd = Number(item.quantidadeConsumida)

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Soft delete
        await tx.fechamentoItem.update({
            where: { id },
            data: { excluido: true, excluidoEm: new Date() },
        })

        // Restore consigned stock
        await tx.estoqueConsignado.update({
            where: { parceiroId_produtoId: { parceiroId, produtoId: item.produtoId } },
            data: { quantidadeAtual: { increment: qtd as unknown as Decimal } },
        })

        // Recalculate fechamento totals (excluding deleted items)
        const allItens = await tx.fechamentoItem.findMany({
            where: { fechamentoId: item.fechamento.id, excluido: false },
        })
        const totalQtd = allItens.reduce((s, i) => s + Number(i.quantidadeConsumida), 0)
        const totalVal = allItens.reduce((s, i) => s + Number(i.valorTotal), 0)
        await tx.fechamento.update({
            where: { id: item.fechamento.id },
            data: {
                totalQuantidade: totalQtd as unknown as Decimal,
                totalValor: totalVal as unknown as Decimal,
            },
        })
    })

    return NextResponse.json({ ok: true })
}
