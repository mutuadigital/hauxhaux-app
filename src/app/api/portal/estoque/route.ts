import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// Portal: get partner's own consigned stock, enriched with sale price from latest remessa
export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userSession = session.user as { role: string; parceiroId?: string | null }
    if (userSession.role !== 'PARTNER' || !userSession.parceiroId)
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const parceiroId = userSession.parceiroId

    const estoque = await prisma.estoqueConsignado.findMany({
        where: { parceiroId, quantidadeAtual: { gt: 0 } },
        include: { produto: { select: { id: true, nome: true, unidadeMedida: true, precoPadrao: true } } },
        orderBy: { produto: { nome: 'asc' } },
    })

    // Enrich with locked sale price from most recent confirmed remessa
    const enriched = await Promise.all(estoque.map(async (e: typeof estoque[0]) => {
        const lastItem = await prisma.remessaConsignacaoItem.findFirst({
            where: {
                produtoId: e.produtoId,
                remessa: { parceiroId, status: 'CONFIRMADA' },
                valorReferencia: { not: null },
            },
            orderBy: { remessa: { dataEnvio: 'desc' } },
            select: { valorReferencia: true },
        })
        return {
            ...e,
            valorVenda: lastItem?.valorReferencia ?? e.produto.precoPadrao,
        }
    }))

    return NextResponse.json(enriched)
}
