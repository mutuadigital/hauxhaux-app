import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const cliente = await prisma.cliente.findUnique({
        where: { id },
        include: { vendas: { orderBy: { dataVenda: 'desc' }, take: 20, include: { itens: { include: { produto: { select: { nome: true } } } } } } },
    })
    if (!cliente) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(cliente)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { nome, documento, telefone, email, endereco, cidade, estado, observacoes, ativo } = body

    const updated = await prisma.cliente.update({
        where: { id },
        data: {
            ...(nome !== undefined && { nome }),
            ...(documento !== undefined && { documento: documento || null }),
            ...(telefone !== undefined && { telefone: telefone || null }),
            ...(email !== undefined && { email: email || null }),
            ...(endereco !== undefined && { endereco: endereco || null }),
            ...(cidade !== undefined && { cidade: cidade || null }),
            ...(estado !== undefined && { estado: estado || null }),
            ...(observacoes !== undefined && { observacoes: observacoes || null }),
            ...(ativo !== undefined && { ativo }),
        },
    })
    return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    await prisma.cliente.update({ where: { id }, data: { ativo: false } })
    return NextResponse.json({ ok: true })
}
