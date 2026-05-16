import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const venda = await prisma.vendaDireta.findUnique({ where: { id }, include: { itens: true } })
    if (!venda) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.$transaction([
        prisma.contaReceber.updateMany({ where: { vendaDiretaId: id }, data: { status: 'CANCELADO' } }),
        ...venda.itens.map((item) =>
            prisma.estoqueProduto.update({ where: { produtoId: item.produtoId }, data: { quantidadeAtual: { increment: item.quantidade } } })
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
    const { dataVenda, clienteId, clienteNome, clienteDoc, observacoes, desconto, valorFrete, itens } = body as {
        dataVenda?: string; clienteId?: string; clienteNome?: string; clienteDoc?: string
        observacoes?: string; desconto?: number; valorFrete?: number
        itens?: { produtoId: string; quantidade: number; valorUnit: number }[]
    }

    const venda = await prisma.vendaDireta.findUnique({ where: { id }, include: { itens: true } })
    if (!venda) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (itens && itens.length > 0) {
        const subtotal = itens.reduce((s, i) => s + i.quantidade * i.valorUnit, 0)
        const descontoVal = Math.max(0, desconto ?? Number(venda.desconto))
        const freteVal = Math.max(0, valorFrete ?? Number(venda.valorFrete))
        const novoTotal = subtotal - descontoVal + freteVal

        await prisma.$transaction(async (tx) => {
            for (const oldItem of venda.itens) {
                await tx.estoqueProduto.update({ where: { produtoId: oldItem.produtoId }, data: { quantidadeAtual: { increment: oldItem.quantidade } } })
            }
            await tx.vendaDiretaItem.deleteMany({ where: { vendaId: id } })
            for (const item of itens) {
                await tx.vendaDiretaItem.create({
                    data: { vendaId: id, produtoId: item.produtoId, quantidade: item.quantidade, valorUnit: item.valorUnit, valorTotal: item.quantidade * item.valorUnit },
                })
                await tx.estoqueProduto.update({ where: { produtoId: item.produtoId }, data: { quantidadeAtual: { decrement: item.quantidade } } })
            }
            await tx.vendaDireta.update({
                where: { id },
                data: {
                    valorTotal: novoTotal, desconto: descontoVal, valorFrete: freteVal,
                    ...(dataVenda && { dataVenda: new Date(dataVenda) }),
                    ...(clienteId !== undefined && { clienteId: clienteId || null }),
                    ...(clienteNome !== undefined && { clienteNome: clienteNome || null }),
                    ...(clienteDoc !== undefined && { clienteDoc: clienteDoc || null }),
                    ...(observacoes !== undefined && { observacoes: observacoes || null }),
                },
            })
            await tx.contaReceber.updateMany({
                where: { vendaDiretaId: id, status: { not: 'CANCELADO' } },
                data: { valorTotal: novoTotal, valorRepasse: novoTotal, saldoAberto: novoTotal },
            })
        })
    } else {
        const updateData: Record<string, unknown> = {}
        if (dataVenda) updateData.dataVenda = new Date(dataVenda)
        if (clienteId !== undefined) updateData.clienteId = clienteId || null
        if (clienteNome !== undefined) updateData.clienteNome = clienteNome || null
        if (clienteDoc !== undefined) updateData.clienteDoc = clienteDoc || null
        if (observacoes !== undefined) updateData.observacoes = observacoes || null
        if (desconto !== undefined) updateData.desconto = Math.max(0, desconto)
        if (valorFrete !== undefined) updateData.valorFrete = Math.max(0, valorFrete)

        if (desconto !== undefined || valorFrete !== undefined) {
            const subtotal = venda.itens.reduce((s, i) => s + Number(i.valorTotal), 0)
            const d = desconto !== undefined ? Math.max(0, desconto) : Number(venda.desconto)
            const f = valorFrete !== undefined ? Math.max(0, valorFrete) : Number(venda.valorFrete)
            updateData.valorTotal = subtotal - d + f
        }

        await prisma.vendaDireta.update({ where: { id }, data: updateData })
    }

    return NextResponse.json({ ok: true })
}
