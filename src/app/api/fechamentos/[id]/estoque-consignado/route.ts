import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// Returns current consigned stock for a partner, with price locked from the most recent remessa.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const fechamento = await prisma.fechamento.findUnique({ where: { id }, select: { parceiroId: true } })
    if (!fechamento) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const estoque = await prisma.estoqueConsignado.findMany({
        where: { parceiroId: fechamento.parceiroId, quantidadeAtual: { gt: 0 } },
        include: { produto: { select: { id: true, nome: true, unidadeMedida: true, precoPadrao: true } } },
        orderBy: { produto: { nome: 'asc' } },
    })

    // For each product, look up the valorReferencia from the most recent confirmed remessa
    const enriched = await Promise.all(estoque.map(async (e: typeof estoque[0]) => {
        const lastRemessaItem = await prisma.remessaConsignacaoItem.findFirst({
            where: {
                produtoId: e.produtoId,
                remessa: { parceiroId: fechamento.parceiroId, status: 'CONFIRMADA' },
            },
            orderBy: { remessa: { dataEnvio: 'desc' } },
            select: { valorReferencia: true },
        })
        return {
            ...e,
            valorVenda: lastRemessaItem?.valorReferencia ?? e.produto.precoPadrao,
        }
    }))

    return NextResponse.json(enriched)
}
