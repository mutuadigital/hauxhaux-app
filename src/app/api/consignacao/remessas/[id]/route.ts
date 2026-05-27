import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// PATCH: Edit remessa — header fields + optional items (with stock adjustment)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { dataEnvio, observacoes, status, itens } = body

    const remessa = await prisma.remessaConsignacao.findUnique({
        where: { id },
        include: { itens: true },
    })
    if (!remessa) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
        // ── Stock adjustment when items are being edited ──────────────────
        if (itens !== undefined) {
            const newItems: { produtoId: string; quantidade: number; valorReferencia?: number | null }[] = itens

            // Build maps for quick lookup
            const oldMap = new Map(remessa.itens.map(i => [i.produtoId, Number(i.quantidade)]))
            const newMap = new Map(newItems.map(i => [i.produtoId, Number(i.quantidade)]))

            const allProdutoIds = new Set([...oldMap.keys(), ...newMap.keys()])

            for (const produtoId of allProdutoIds) {
                const oldQty = oldMap.get(produtoId) ?? 0
                const newQty = newMap.get(produtoId) ?? 0
                const delta = newQty - oldQty // positive = more sent, negative = returned

                if (delta === 0) continue

                // Adjust internal stock (reverse of what was sent)
                await tx.estoqueProduto.update({
                    where: { produtoId },
                    data: { quantidadeAtual: { decrement: delta } }, // delta>0 decrements, delta<0 increments
                })

                // Adjust consigned stock
                const existing = await tx.estoqueConsignado.findUnique({
                    where: { parceiroId_produtoId: { parceiroId: remessa.parceiroId, produtoId } },
                })
                if (existing) {
                    await tx.estoqueConsignado.update({
                        where: { parceiroId_produtoId: { parceiroId: remessa.parceiroId, produtoId } },
                        data: { quantidadeAtual: { increment: delta } },
                    })
                } else if (delta > 0) {
                    await tx.estoqueConsignado.create({
                        data: { parceiroId: remessa.parceiroId, produtoId, quantidadeAtual: delta },
                    })
                }

                // Record movement
                await tx.movimentoEstoqueProduto.create({
                    data: {
                        produtoId,
                        tipoMovimento: 'CONSIGNACAO_SAIDA',
                        origemTipo: 'REMESSA',
                        origemId: id,
                        parceiroId: remessa.parceiroId,
                        quantidade: Math.abs(delta),
                        sinal: delta >= 0 ? 'SAIDA' : 'ENTRADA',
                        criadoPor: session.user?.id ?? null,
                    },
                })
            }

            // Replace items
            await tx.remessaConsignacaoItem.deleteMany({ where: { remessaId: id } })
            if (newItems.length > 0) {
                await tx.remessaConsignacaoItem.createMany({
                    data: newItems.map(i => ({
                        remessaId: id,
                        produtoId: i.produtoId,
                        quantidade: i.quantidade,
                        valorReferencia: i.valorReferencia ?? null,
                    })),
                })
            }
        }

        // ── Update header fields ──────────────────────────────────────────
        await tx.remessaConsignacao.update({
            where: { id },
            data: {
                ...(dataEnvio && { dataEnvio: new Date(dataEnvio) }),
                ...(observacoes !== undefined && { observacoes: observacoes || null }),
                ...(status && { status }),
            },
        })
    })

    const updated = await prisma.remessaConsignacao.findUnique({
        where: { id },
        include: {
            parceiro: { select: { nome: true } },
            itens: { include: { produto: { select: { nome: true, unidadeMedida: true } } } },
        },
    })
    return NextResponse.json(updated)
}

// DELETE: Reverse all stock movements and delete the remessa
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const remessa = await prisma.remessaConsignacao.findUnique({
        where: { id },
        include: { itens: true },
    })
    if (!remessa) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
        // Reverse stock for each item
        for (const item of remessa.itens) {
            const qty = Number(item.quantidade)

            // Return to internal stock
            await tx.estoqueProduto.update({
                where: { produtoId: item.produtoId },
                data: { quantidadeAtual: { increment: qty } },
            })

            // Remove from consigned stock
            const consignado = await tx.estoqueConsignado.findUnique({
                where: { parceiroId_produtoId: { parceiroId: remessa.parceiroId, produtoId: item.produtoId } },
            })
            if (consignado) {
                await tx.estoqueConsignado.update({
                    where: { parceiroId_produtoId: { parceiroId: remessa.parceiroId, produtoId: item.produtoId } },
                    data: { quantidadeAtual: { decrement: qty } },
                })
            }

            // Record reversal movement
            await tx.movimentoEstoqueProduto.create({
                data: {
                    produtoId: item.produtoId,
                    tipoMovimento: 'DEVOLUCAO_ENTRADA',
                    origemTipo: 'REMESSA_CANCELADA',
                    origemId: id,
                    parceiroId: remessa.parceiroId,
                    quantidade: qty,
                    sinal: 'ENTRADA',
                    criadoPor: session.user?.id ?? null,
                },
            })
        }

        // Delete remessa (cascade deletes items)
        await tx.remessaConsignacao.delete({ where: { id } })
    })

    return NextResponse.json({ ok: true })
}
