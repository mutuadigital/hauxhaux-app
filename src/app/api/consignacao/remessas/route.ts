import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const remessas = await prisma.remessaConsignacao.findMany({
        orderBy: { dataEnvio: 'desc' },
        include: {
            parceiro: { select: { nome: true } },
            itens: { include: { produto: { select: { nome: true, unidadeMedida: true } } } },
        },
        take: 200,
    })
    return NextResponse.json(remessas)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { parceiroId, dataEnvio, itens, observacoes } = body
    if (!parceiroId || !dataEnvio || !itens?.length)
        return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

    const remessa = await prisma.$transaction(async (tx) => {
        const r = await tx.remessaConsignacao.create({
            data: {
                parceiroId,
                dataEnvio: new Date(dataEnvio),
                status: 'EM_SEPARACAO',
                observacoes: observacoes || null,
                criadoPor: session.user?.id ?? null,
                itens: {
                    create: itens.map((i: { produtoId: string; quantidade: number; valorReferencia?: number }) => ({
                        produtoId: i.produtoId,
                        quantidade: i.quantidade,
                        valorReferencia: i.valorReferencia ?? null,
                    })),
                },
            },
            include: { itens: true },
        })

        for (const item of r.itens) {
            // Deduct from internal product stock
            await tx.estoqueProduto.update({
                where: { produtoId: item.produtoId },
                data: { quantidadeAtual: { decrement: item.quantidade } },
            })
            // Add to consigned stock
            const existing = await tx.estoqueConsignado.findUnique({
                where: { parceiroId_produtoId: { parceiroId, produtoId: item.produtoId } },
            })
            if (existing) {
                await tx.estoqueConsignado.update({
                    where: { parceiroId_produtoId: { parceiroId, produtoId: item.produtoId } },
                    data: { quantidadeAtual: { increment: item.quantidade } },
                })
            } else {
                await tx.estoqueConsignado.create({ data: { parceiroId, produtoId: item.produtoId, quantidadeAtual: item.quantidade } })
            }
            // Record product movement
            await tx.movimentoEstoqueProduto.create({
                data: {
                    produtoId: item.produtoId,
                    tipoMovimento: 'CONSIGNACAO_SAIDA',
                    origemTipo: 'REMESSA',
                    origemId: r.id,
                    parceiroId,
                    quantidade: item.quantidade,
                    sinal: 'SAIDA',
                    criadoPor: session.user?.id ?? null,
                },
            })
        }
        return r
    })

    return NextResponse.json(remessa, { status: 201 })
}
