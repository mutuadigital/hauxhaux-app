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
