import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const busca = searchParams.get('busca') || ''
    const apenasAtivos = searchParams.get('ativos') !== 'false'

    const clientes = await prisma.cliente.findMany({
        where: {
            ...(apenasAtivos && { ativo: true }),
            ...(busca && {
                OR: [
                    { nome: { contains: busca, mode: 'insensitive' } },
                    { documento: { contains: busca, mode: 'insensitive' } },
                    { email: { contains: busca, mode: 'insensitive' } },
                ],
            }),
        },
        orderBy: { nome: 'asc' },
        include: { _count: { select: { vendas: true } } },
    })
    return NextResponse.json(clientes)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { nome, documento, telefone, email, endereco, cidade, estado, observacoes } = body

    if (!nome || !nome.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const cliente = await prisma.cliente.create({
        data: { nome: nome.trim(), documento: documento || null, telefone: telefone || null, email: email || null, endereco: endereco || null, cidade: cidade || null, estado: estado || null, observacoes: observacoes || null },
    })
    return NextResponse.json(cliente, { status: 201 })
}
