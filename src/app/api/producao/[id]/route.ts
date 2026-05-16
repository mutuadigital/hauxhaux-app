import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// PATCH: Edit a production order (only RASCUNHO can be edited)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { status, produtoId, codigoLote, quantidadePrevista, dataProducao, composicaoId, observacoes } = body

    const producao = await prisma.producao.findUnique({ where: { id } })
    if (!producao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    // Only RASCUNHO can be fully edited; for other statuses, only status changes are allowed
    if (producao.status !== 'RASCUNHO' && (produtoId || codigoLote || quantidadePrevista || dataProducao || composicaoId)) {
        return NextResponse.json({ error: 'Apenas produções em rascunho podem ser editadas' }, { status: 400 })
    }

    const allowed = ['RASCUNHO', 'CONFIRMADA', 'CANCELADA']
    if (status && !allowed.includes(status))
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

    // If composicaoId changed, recalculate consumo insumos
    if (composicaoId && producao.status === 'RASCUNHO') {
        const comp = await prisma.composicaoProduto.findUnique({
            where: { id: composicaoId },
            include: { itens: true },
        })

        const qtd = quantidadePrevista ?? Number(producao.quantidadePrevista)

        await prisma.$transaction(async (tx) => {
            // Delete old consumo
            await tx.producaoConsumoInsumo.deleteMany({ where: { producaoId: id } })

            // Update production
            await tx.producao.update({
                where: { id },
                data: {
                    ...(produtoId && { produtoId }),
                    ...(codigoLote && { codigoLote }),
                    ...(quantidadePrevista && { quantidadePrevista }),
                    ...(dataProducao && { dataProducao: new Date(dataProducao) }),
                    ...(observacoes !== undefined && { observacoes }),
                    ...(status && { status }),
                },
            })

            // Create new consumo from composição
            if (comp) {
                await tx.producaoConsumoInsumo.createMany({
                    data: comp.itens.map((item) => ({
                        producaoId: id,
                        insumoId: item.insumoId,
                        quantidadePrevista: Number(item.quantidadeBase) * Number(qtd) * (1 + (Number(item.fatorPerda) || 0)),
                    })),
                })
            }
        })
    } else {
        // Simple update without composição change
        await prisma.producao.update({
            where: { id },
            data: {
                ...(produtoId && { produtoId }),
                ...(codigoLote && { codigoLote }),
                ...(quantidadePrevista && { quantidadePrevista }),
                ...(dataProducao && { dataProducao: new Date(dataProducao) }),
                ...(observacoes !== undefined && { observacoes }),
                ...(status && { status }),
            },
        })
    }

    const updated = await prisma.producao.findUnique({
        where: { id },
        include: {
            produto: { select: { nome: true, unidadeMedida: true } },
            consumoInsumos: { include: { insumo: { select: { nome: true, unidadeMedida: true } } } },
        },
    })
    return NextResponse.json(updated)
}

// DELETE: Logical deletion (set status to CANCELADA) - only RASCUNHO can be deleted
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const producao = await prisma.producao.findUnique({ where: { id } })
    if (!producao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    if (producao.status !== 'RASCUNHO')
        return NextResponse.json({ error: 'Apenas produções em rascunho podem ser excluídas' }, { status: 400 })

    // Logical deletion: change status to CANCELADA
    await prisma.producao.update({
        where: { id },
        data: { status: 'CANCELADA' },
    })

    return NextResponse.json({ ok: true })
}
