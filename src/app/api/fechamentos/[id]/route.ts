import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const fechamento = await prisma.fechamento.findUnique({
        where: { id },
        include: {
            parceiro: { select: { nome: true } },
            itens: {
                include: { produto: { select: { nome: true, unidadeMedida: true, precoPadrao: true } } },
                orderBy: { produto: { nome: 'asc' } },
            },
            contasReceber: { select: { id: true, status: true, valorTotal: true, saldoAberto: true } },
        },
    })
    if (!fechamento) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(fechamento)
}
