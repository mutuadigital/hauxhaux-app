import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userSession = session.user as { role: string; parceiroId?: string | null }

    const declaracoes = await prisma.declaracaoConsumo.findMany({
        where: userSession.role === 'PARTNER' && userSession.parceiroId
            ? { parceiroId: userSession.parceiroId }
            : {},
        orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
        include: {
            parceiro: { select: { nome: true } },
            itens: { include: { produto: { select: { nome: true, unidadeMedida: true } } } },
        },
    })
    return NextResponse.json(declaracoes)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userSession = session.user as { role: string; id: string; parceiroId?: string | null }

    const body = await req.json()
    const { parceiroId: bodyParceiroId, competenciaAno, competenciaMes, itens, observacoes } = body

    // Partners can only submit for their own parceiroId
    const parceiroId = userSession.role === 'PARTNER' ? userSession.parceiroId : bodyParceiroId
    if (!parceiroId) return NextResponse.json({ error: 'parceiroId required' }, { status: 400 })

    const declaracao = await prisma.declaracaoConsumo.upsert({
        where: { parceiroId_competenciaAno_competenciaMes: { parceiroId, competenciaAno, competenciaMes } },
        update: {
            status: 'RASCUNHO',
            observacoes: observacoes || null,
            itens: { deleteMany: {}, create: itens.map((i: { produtoId: string; quantidadeConsumida: number; observacao?: string }) => ({ produtoId: i.produtoId, quantidadeConsumida: i.quantidadeConsumida, observacao: i.observacao ?? null })) },
        },
        create: {
            parceiroId,
            competenciaAno,
            competenciaMes,
            observacoes: observacoes || null,
            enviadoPor: userSession.id,
            itens: { create: itens.map((i: { produtoId: string; quantidadeConsumida: number; observacao?: string }) => ({ produtoId: i.produtoId, quantidadeConsumida: i.quantidadeConsumida, observacao: i.observacao ?? null })) },
        },
        include: { itens: true },
    })
    return NextResponse.json(declaracao, { status: 201 })
}
