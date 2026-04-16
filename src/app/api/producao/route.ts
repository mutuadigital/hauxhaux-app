import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const producoes = await prisma.producao.findMany({
        orderBy: { dataProducao: 'desc' },
        include: {
            produto: { select: { nome: true, unidadeMedida: true } },
            consumoInsumos: { include: { insumo: { select: { nome: true, unidadeMedida: true } } } },
        },
        take: 100,
    })
    return NextResponse.json(producoes)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { produtoId, codigoLote, quantidadePrevista, dataProducao, composicaoId, observacoes } = body
    if (!produtoId || !codigoLote || !quantidadePrevista || !dataProducao)
        return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

    // Fetch composicao to calculate expected insumo consumption
    let consumoItens: { insumoId: string; quantidadePrevista: number; observacao?: string }[] = []
    if (composicaoId) {
        const comp = await prisma.composicaoProduto.findUnique({
            where: { id: composicaoId },
            include: { itens: true },
        })
        if (comp) {
            consumoItens = comp.itens.map((item) => ({
                insumoId: item.insumoId,
                quantidadePrevista: Number(item.quantidadeBase) * Number(quantidadePrevista) * (1 + (Number(item.fatorPerda) || 0)),
            }))
        }
    }

    const producao = await prisma.producao.create({
        data: {
            codigoLote,
            produtoId,
            quantidadePrevista,
            dataProducao: new Date(dataProducao),
            status: 'RASCUNHO',
            observacoes: observacoes || null,
            criadoPor: session.user?.id ?? null,
            consumoInsumos: { create: consumoItens },
        },
        include: { produto: true, consumoInsumos: { include: { insumo: true } } },
    })
    return NextResponse.json(producao, { status: 201 })
}
