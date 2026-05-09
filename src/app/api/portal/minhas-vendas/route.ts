import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// GET /api/portal/minhas-vendas?mes=5&ano=2026&excluidas=false
export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { parceiroId: true } })
    if (!user?.parceiroId) return NextResponse.json([])
    const parceiroId = user.parceiroId

    const { searchParams } = new URL(req.url)
    const now = new Date()
    const mes = parseInt(searchParams.get('mes') ?? String(now.getMonth() + 1))
    const ano = parseInt(searchParams.get('ano') ?? String(now.getFullYear()))
    const excluidas = searchParams.get('excluidas') === 'true'

    // Find the fechamento for this month
    const fechamento = await prisma.fechamento.findUnique({
        where: { parceiroId_competenciaAno_competenciaMes: { parceiroId, competenciaAno: ano, competenciaMes: mes } },
        include: {
            itens: {
                where: { excluido: excluidas },
                include: { produto: { select: { nome: true, unidadeMedida: true } } },
                orderBy: { dataVenda: 'desc' },
            },
        },
    })

    return NextResponse.json({
        fechamentoId: fechamento?.id ?? null,
        status: fechamento?.status ?? null,
        totalValor: fechamento?.totalValor ?? 0,
        itens: fechamento?.itens ?? [],
    })
}
