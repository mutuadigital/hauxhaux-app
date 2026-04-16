import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')

    const insumos = await prisma.insumo.findMany({
        where: {
            ativo: true,
            ...(q ? { nome: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { nome: 'asc' },
        include: {
            categoria: { select: { nome: true } },
            estoque: { select: { quantidadeAtual: true } },
        },
    })
    return NextResponse.json(insumos)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { codigo, nome, categoriaId, unidadeMedida, custoMedio, estoqueMinimo, observacoes } = body
    if (!codigo || !nome || !unidadeMedida)
        return NextResponse.json({ error: 'codigo, nome e unidadeMedida são obrigatórios' }, { status: 400 })

    const record = await prisma.insumo.create({
        data: { codigo, nome, categoriaId: categoriaId || null, unidadeMedida, custoMedio: custoMedio ?? null, estoqueMinimo: estoqueMinimo ?? 0, observacoes: observacoes || null },
    })
    // Create empty stock entry
    await prisma.estoqueInsumo.create({ data: { insumoId: record.id, quantidadeAtual: 0 } })
    return NextResponse.json(record, { status: 201 })
}
