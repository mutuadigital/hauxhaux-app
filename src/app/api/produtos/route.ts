import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')

    const produtos = await prisma.produto.findMany({
        where: {
            ativo: true,
            ...(q ? { nome: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { nome: 'asc' },
        include: {
            categoria: { select: { nome: true } },
            estoque: { select: { quantidadeAtual: true } },
        },
        // select extra scalars via include (prisma includes all scalars by default)
    })
    return NextResponse.json(produtos)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { codigo, nome, categoriaId, unidadeMedida, precoPadrao, custoRef, estoqueMinimo, observacoes } = body
    if (!codigo || !nome || !unidadeMedida || precoPadrao == null)
        return NextResponse.json({ error: 'campos obrigatórios ausentes' }, { status: 400 })

    const record = await prisma.produto.create({
        data: { codigo, nome, categoriaId: categoriaId || null, unidadeMedida, precoPadrao, custoRef: custoRef ?? null, estoqueMinimo: estoqueMinimo ?? 0, observacoes: observacoes || null },
    })
    await prisma.estoqueProduto.create({ data: { produtoId: record.id, quantidadeAtual: 0 } })
    return NextResponse.json(record, { status: 201 })
}
