import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// GET composicoes of a product
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const composicoes = await prisma.composicaoProduto.findMany({
        where: { produtoId: id },
        include: {
            itens: {
                include: { insumo: { select: { id: true, nome: true, unidadeMedida: true, estoque: true } } },
                orderBy: { ordem: 'asc' },
            },
        },
        orderBy: { criadoEm: 'asc' },
    })
    return NextResponse.json(composicoes)
}

// POST: create new composicao for product
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id: produtoId } = await params
    const body = await req.json()
    const { nomeVersao, itens } = body
    // itens: [{insumoId, quantidadeBase, unidadeMedida, fatorPerda, ordem}]

    const record = await prisma.composicaoProduto.create({
        data: {
            produtoId,
            nomeVersao: nomeVersao || 'Padrão',
            itens: {
                create: (itens || []).map((item: { insumoId: string; quantidadeBase: number; unidadeMedida: string; fatorPerda?: number; ordem?: number }) => ({
                    insumoId: item.insumoId,
                    quantidadeBase: item.quantidadeBase,
                    unidadeMedida: item.unidadeMedida,
                    fatorPerda: item.fatorPerda ?? null,
                    ordem: item.ordem ?? 0,
                })),
            },
        },
        include: { itens: { include: { insumo: true } } },
    })
    return NextResponse.json(record, { status: 201 })
}
