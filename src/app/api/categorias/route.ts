import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')

    const categorias = await prisma.categoria.findMany({
        where: {
            ativo: true,
            ...(tipo ? { tipo: tipo as 'PRODUTO' | 'INSUMO' | 'PARCEIRO' | 'MOVIMENTO' } : {}),
        },
        orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    })
    return NextResponse.json(categorias)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { tipo, nome, descricao } = body
    if (!tipo || !nome) return NextResponse.json({ error: 'tipo e nome são obrigatórios' }, { status: 400 })

    const record = await prisma.categoria.create({ data: { tipo, nome, descricao } })
    return NextResponse.json(record, { status: 201 })
}
