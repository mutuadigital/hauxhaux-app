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

// DELETE: Remove production and reverse stock movements for any status
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const producao = await prisma.producao.findUnique({
        where: { id },
        include: { consumoInsumos: true },
    })
    if (!producao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
        // If CONFIRMADA: reverse all stock movements
        if (producao.status === 'CONFIRMADA') {
            const qtdRealizada = Number(producao.quantidadeRealizada ?? 0)

            // Remove the produced quantity from produto stock
            if (qtdRealizada > 0) {
                await tx.estoqueProduto.update({
                    where: { produtoId: producao.produtoId },
                    data: { quantidadeAtual: { decrement: qtdRealizada } },
                })
                await tx.movimentoEstoqueProduto.create({
                    data: {
                        produtoId: producao.produtoId,
                        tipoMovimento: 'AJUSTE_SAIDA',
                        origemTipo: 'PRODUCAO_EXCLUIDA',
                        origemId: id,
                        quantidade: qtdRealizada,
                        sinal: 'SAIDA',
                        criadoPor: session.user?.id ?? null,
                    },
                })
            }

            // Return each insumo to stock
            for (const consumo of producao.consumoInsumos) {
                const qtdReal = Number(consumo.quantidadeReal ?? consumo.quantidadePrevista)
                if (qtdReal > 0) {
                    await tx.estoqueInsumo.update({
                        where: { insumoId: consumo.insumoId },
                        data: { quantidadeAtual: { increment: qtdReal } },
                    })
                    await tx.movimentoEstoqueInsumo.create({
                        data: {
                            insumoId: consumo.insumoId,
                            tipoMovimento: 'AJUSTE_ENTRADA',
                            origemTipo: 'PRODUCAO_EXCLUIDA',
                            origemId: id,
                            quantidade: qtdReal,
                            sinal: 'ENTRADA',
                            criadoPor: session.user?.id ?? null,
                        },
                    })
                }
            }
        }

        // Delete consumo records then the production (cascade would also work)
        await tx.producaoConsumoInsumo.deleteMany({ where: { producaoId: id } })
        await tx.producao.delete({ where: { id } })
    })

    return NextResponse.json({ ok: true })
}
