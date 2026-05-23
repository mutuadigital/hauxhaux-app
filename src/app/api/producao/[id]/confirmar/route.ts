import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// Confirm production: deduct insumos, add to produto stock
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { quantidadeRealizada, consumoReal } = body
    // consumoReal: [{insumoId, quantidadeReal}]

    const producao = await prisma.producao.findUnique({
        where: { id },
        include: { consumoInsumos: true },
    })
    if (!producao) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (producao.status === 'CONFIRMADA')
        return NextResponse.json({ error: 'Já confirmada' }, { status: 409 })

    await prisma.$transaction(async (tx) => {
        // Update producao status
        await tx.producao.update({
            where: { id },
            data: { status: 'CONFIRMADA', quantidadeRealizada },
        })

        // Update each consumo with real quantity
        if (consumoReal?.length) {
            for (const c of consumoReal) {
                await tx.producaoConsumoInsumo.updateMany({
                    where: { producaoId: id, insumoId: c.insumoId },
                    data: { quantidadeReal: c.quantidadeReal },
                })
                // Deduct from stock
                await tx.estoqueInsumo.update({
                    where: { insumoId: c.insumoId },
                    data: { quantidadeAtual: { decrement: c.quantidadeReal } },
                })
                // Record movement
                await tx.movimentoEstoqueInsumo.create({
                    data: {
                        insumoId: c.insumoId,
                        tipoMovimento: 'PRODUCAO_SAIDA',
                        origemTipo: 'PRODUCAO',
                        origemId: id,
                        quantidade: c.quantidadeReal,
                        sinal: 'SAIDA',
                        criadoPor: session.user?.id ?? null,
                    },
                })
            }
        }

        // Add to produto stock
        await tx.estoqueProduto.update({
            where: { produtoId: producao.produtoId },
            data: { quantidadeAtual: { increment: quantidadeRealizada } },
        })
        // Record product movement
        await tx.movimentoEstoqueProduto.create({
            data: {
                produtoId: producao.produtoId,
                tipoMovimento: 'PRODUCAO_ENTRADA',
                origemTipo: 'PRODUCAO',
                origemId: id,
                quantidade: quantidadeRealizada,
                sinal: 'ENTRADA',
                criadoPor: session.user?.id ?? null,
            },
        })
    })

    return NextResponse.json({ ok: true })
}

// PATCH: Edit an already-confirmed production, reversing old stock movements and applying new ones
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { quantidadeRealizada, consumoReal } = body
    // consumoReal: [{insumoId, quantidadeReal (new value)}]

    const producao = await prisma.producao.findUnique({
        where: { id },
        include: { consumoInsumos: true },
    })
    if (!producao) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (producao.status !== 'CONFIRMADA')
        return NextResponse.json({ error: 'Apenas produções confirmadas podem ser editadas aqui' }, { status: 400 })

    const oldQtdRealizada = Number(producao.quantidadeRealizada ?? 0)
    const newQtdRealizada = Number(quantidadeRealizada)

    await prisma.$transaction(async (tx) => {
        // Update producao quantity
        await tx.producao.update({
            where: { id },
            data: { quantidadeRealizada: newQtdRealizada },
        })

        // Adjust produto stock: reverse old entry and add new one
        const diffProduto = newQtdRealizada - oldQtdRealizada
        if (diffProduto !== 0) {
            await tx.estoqueProduto.update({
                where: { produtoId: producao.produtoId },
                data: { quantidadeAtual: { increment: diffProduto } },
            })
            // Record adjustment movement
            await tx.movimentoEstoqueProduto.create({
                data: {
                    produtoId: producao.produtoId,
                    tipoMovimento: 'PRODUCAO_ENTRADA',
                    origemTipo: 'PRODUCAO',
                    origemId: id,
                    quantidade: Math.abs(diffProduto),
                    sinal: diffProduto >= 0 ? 'ENTRADA' : 'SAIDA',
                    criadoPor: session.user?.id ?? null,
                },
            })
        }

        // Adjust each insumo: compare old vs new real quantities
        if (consumoReal?.length) {
            for (const c of consumoReal) {
                const oldConsumo = producao.consumoInsumos.find(ci => ci.insumoId === c.insumoId)
                const oldQty = Number(oldConsumo?.quantidadeReal ?? oldConsumo?.quantidadePrevista ?? 0)
                const newQty = Number(c.quantidadeReal)
                const diff = newQty - oldQty // positive = more consumption

                // Update consumo record
                await tx.producaoConsumoInsumo.updateMany({
                    where: { producaoId: id, insumoId: c.insumoId },
                    data: { quantidadeReal: newQty },
                })

                if (diff !== 0) {
                    // Adjust stock: if consuming more, decrement; if less, increment (restock)
                    await tx.estoqueInsumo.update({
                        where: { insumoId: c.insumoId },
                        data: { quantidadeAtual: { decrement: diff } },
                    })
                    // Record adjustment movement
                    await tx.movimentoEstoqueInsumo.create({
                        data: {
                            insumoId: c.insumoId,
                            tipoMovimento: 'PRODUCAO_SAIDA',
                            origemTipo: 'PRODUCAO',
                            origemId: id,
                            quantidade: Math.abs(diff),
                            sinal: diff >= 0 ? 'SAIDA' : 'ENTRADA',
                            criadoPor: session.user?.id ?? null,
                        },
                    })
                }
            }
        }
    })

    return NextResponse.json({ ok: true })
}
