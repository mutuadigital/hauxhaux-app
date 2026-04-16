import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const devolucoes = await prisma.devolucaoConsignacao.findMany({
        orderBy: { dataDevolucao: 'desc' },
        include: {
            parceiro: { select: { nome: true } },
            itens: { include: { produto: { select: { nome: true, unidadeMedida: true } } } },
        },
        take: 100,
    })
    return NextResponse.json(devolucoes)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { parceiroId, dataDevolucao, itens, observacoes } = body

    const devolucao = await prisma.$transaction(async (tx) => {
        const d = await tx.devolucaoConsignacao.create({
            data: {
                parceiroId,
                dataDevolucao: new Date(dataDevolucao),
                status: 'CONFIRMADA',
                observacoes: observacoes || null,
                criadoPor: session.user?.id ?? null,
                itens: {
                    create: itens.map((i: { produtoId: string; quantidade: number; observacaoCondicao?: string }) => ({
                        produtoId: i.produtoId,
                        quantidade: i.quantidade,
                        observacaoCondicao: i.observacaoCondicao ?? null,
                    })),
                },
            },
            include: { itens: true },
        })

        for (const item of d.itens) {
            await tx.estoqueConsignado.update({
                where: { parceiroId_produtoId: { parceiroId, produtoId: item.produtoId } },
                data: { quantidadeAtual: { decrement: item.quantidade } },
            })
            await tx.estoqueProduto.update({
                where: { produtoId: item.produtoId },
                data: { quantidadeAtual: { increment: item.quantidade } },
            })
            await tx.movimentoEstoqueProduto.create({
                data: {
                    produtoId: item.produtoId,
                    tipoMovimento: 'DEVOLUCAO_ENTRADA',
                    origemTipo: 'DEVOLUCAO',
                    origemId: d.id,
                    parceiroId,
                    quantidade: item.quantidade,
                    sinal: 'ENTRADA',
                    criadoPor: session.user?.id ?? null,
                },
            })
        }
        return d
    })

    return NextResponse.json(devolucao, { status: 201 })
}
