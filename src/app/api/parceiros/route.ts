import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')

    const parceiros = await prisma.parceiro.findMany({
        where: {
            status: { not: 'ENCERRADO' },
            ...(q ? { nome: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { nome: 'asc' },
        include: { _count: { select: { estoqueConsignado: true } } },
    })
    return NextResponse.json(parceiros)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { nome, nomeFantasia, documento, contatoPrincipal, telefone, email, endereco, cidade, estado, observacoes, percentualComissao } = body
    if (!nome) return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 })

    const record = await prisma.parceiro.create({
        data: { nome, nomeFantasia, documento, contatoPrincipal, telefone, email, endereco, cidade, estado, observacoes, percentualComissao: parseFloat(percentualComissao) || 0 },
    })
    return NextResponse.json(record, { status: 201 })
}
