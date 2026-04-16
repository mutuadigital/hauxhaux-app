import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma } from '@prisma/client'

export async function GET(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const fechamentos = await prisma.fechamento.findMany({
        orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
        include: {
            parceiro: { select: { nome: true } },
            itens: {
                include: { produto: { select: { nome: true, unidadeMedida: true, precoPadrao: true } } },
                orderBy: { produto: { nome: 'asc' } },
            },
            contasReceber: { select: { id: true, status: true, valorTotal: true, saldoAberto: true } },
        },
    })
    return NextResponse.json(fechamentos)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { parceiroId, competenciaAno, competenciaMes, observacoes } = body

    // Check if already exists
    const existing = await prisma.fechamento.findUnique({
        where: { parceiroId_competenciaAno_competenciaMes: { parceiroId, competenciaAno, competenciaMes } },
    })
    if (existing) return NextResponse.json({ error: 'Fechamento já existe' }, { status: 409 })

    // Get declaracao de consumo for this period
    const declaracao = await prisma.declaracaoConsumo.findUnique({
        where: { parceiroId_competenciaAno_competenciaMes: { parceiroId, competenciaAno, competenciaMes } },
        include: {
            itens: { include: { produto: { select: { precoPadrao: true } } } },
        },
    })

    // Get consigned stock at start of period (simplified: current quantities)
    const estoqueConsignado = await prisma.estoqueConsignado.findMany({
        where: { parceiroId },
        include: { produto: { select: { id: true, precoPadrao: true } } },
    })

    const fechamentoItens = (declaracao?.itens ?? []).map((item: { produtoId: string; quantidadeConsumida: unknown; produto?: { precoPadrao: unknown } | null }) => {
        const preco = Number(item.produto?.precoPadrao ?? 0)
        const consumido = Number(item.quantidadeConsumida)
        return {
            produtoId: item.produtoId,
            saldoInicial: 0,
            quantidadeEnviada: 0,
            quantidadeDevolvida: 0,
            quantidadeConsumida: consumido,
            saldoFinal: 0,
            valorUnitario: preco as unknown as Decimal,
            valorTotal: (preco * consumido) as unknown as Decimal,
        }
    })

    const totalValor = fechamentoItens.reduce((s: number, i: typeof fechamentoItens[0]) => s + Number(i.valorTotal), 0)
    const totalQtd = fechamentoItens.reduce((s: number, i: typeof fechamentoItens[0]) => s + i.quantidadeConsumida, 0)

    const fechamento = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const f = await tx.fechamento.create({
            data: {
                parceiroId,
                competenciaAno,
                competenciaMes,
                status: 'ABERTO',
                totalValor,
                totalQuantidade: totalQtd,
                observacoes: observacoes || null,
                criadoPor: session.user?.id ?? null,
                itens: { create: fechamentoItens },
            },
            include: { itens: true },
        })

        // Mark declaracao as incorporated
        if (declaracao) {
            await tx.declaracaoConsumo.update({
                where: { id: declaracao.id },
                data: { status: 'INCORPORADO_NO_FECHAMENTO' },
            })
        }

        return f
    })

    return NextResponse.json(fechamento, { status: 201 })
}
