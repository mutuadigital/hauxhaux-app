import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const venda = await prisma.vendaDireta.findUnique({
        where: { id },
        include: { itens: true },
    })
    if (!venda) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.$transaction([
        prisma.contaReceber.updateMany({
            where: { vendaDiretaId: id },
            data: { status: 'CANCELADO' },
        }),
        // Restore stock for each sold item
        ...venda.itens.map((item) =>
            prisma.estoqueProduto.update({
                where: { produtoId: item.produtoId },
                data: { quantidadeAtual: { increment: item.quantidade } },
            })
        ),
        prisma.vendaDireta.delete({ where: { id } }),
    ])

    return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { dataVenda, clienteNome, clienteDoc, observacoes, itens } = body as {
        dataVenda?: string
        clienteNome?: string
        clienteDoc?: string
        observacoes?: string
        itens?: { produtoId: string; quantidade: number; valorUnit: number }[]
    }

    const venda = await prisma.vendaDireta.findUnique({
        where: { id },
        include: { itens: true },
    })
    if (!venda) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // If items are being updated, do full stock reconciliation
    if (itens && itens.length > 0) {
        const novoTotal = itens.reduce((s, i) => s + i.quantidade * i.valorUnit, 0)

        await prisma.$transaction(async (tx) => {
            // 1. Restore stock from original items
            for (const oldItem of venda.itens) {
                await tx.estoqueProduto.update({
                    where: { produtoId: oldItem.produtoId },
                    data: { quantidadeAtual: { increment: oldItem.quantidade } },
                })
            }

            // 2. Delete old items
            await tx.vendaDiretaItem.deleteMany({ where: { vendaId: id } })

            // 3. Create new items and deduct stock
            for (const item of itens) {
                await tx.vendaDiretaItem.create({
                    data: {
                        vendaId: id,
                        produtoId: item.produtoId,
                        quantidade: item.quantidade,
                        valorUnit: item.valorUnit,
                        valorTotal: item.quantidade * item.valorUnit,
                    },
                })
                await tx.estoqueProduto.update({
                    where: { produtoId: item.produtoId },
                    data: { quantidadeAtual: { decrement: item.quantidade } },
                })
            }

            // 4. Update venda header + total
            await tx.vendaDireta.update({
                where: { id },
                data: {
                    valorTotal: novoTotal,
                    ...(dataVenda && { dataVenda: new Date(dataVenda) }),
                    ...(clienteNome !== undefined && { clienteNome: clienteNome || null }),
                    ...(clienteDoc !== undefined && { clienteDoc: clienteDoc || null }),
                    ...(observacoes !== undefined && { observacoes: observacoes || null }),
                },
            })

            // 5. Update conta a receber to reflect new total
            await tx.contaReceber.updateMany({
                where: { vendaDiretaId: id, status: { not: 'CANCELADO' } },
                data: {
                    valorTotal: novoTotal,
                    valorRepasse: novoTotal,
                    saldoAberto: novoTotal,
                },
            })
        })
    } else {
        // Header-only update
        await prisma.vendaDireta.update({
            where: { id },
            data: {
                ...(dataVenda && { dataVenda: new Date(dataVenda) }),
                ...(clienteNome !== undefined && { clienteNome: clienteNome || null }),
                ...(clienteDoc !== undefined && { clienteDoc: clienteDoc || null }),
                ...(observacoes !== undefined && { observacoes: observacoes || null }),
            },
        })
    }

    return NextResponse.json({ ok: true })
}
