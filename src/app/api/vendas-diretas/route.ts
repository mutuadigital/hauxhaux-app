import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma } from '@prisma/client'

export async function GET() {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const vendas = await prisma.vendaDireta.findMany({
        orderBy: { dataVenda: 'desc' },
        include: {
            cliente: { select: { id: true, nome: true, documento: true } },
            itens: { include: { produto: { select: { nome: true, unidadeMedida: true } } } },
            contasReceber: { select: { id: true, status: true, saldoAberto: true } },
        },
    })
    return NextResponse.json(vendas)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { dataVenda, clienteId, clienteNome, clienteDoc, observacoes, desconto, valorFrete, itens } = body as {
        dataVenda?: string; clienteId?: string; clienteNome?: string; clienteDoc?: string
        observacoes?: string; desconto?: number; valorFrete?: number
        itens: { produtoId: string; quantidade: number; valorUnit: number }[]
    }

    const validItems = (itens ?? []).filter(i => i.produtoId && i.quantidade > 0 && i.valorUnit >= 0)
    if (!validItems.length) return NextResponse.json({ error: 'Informe pelo menos um produto' }, { status: 400 })

    const subtotal = validItems.reduce((s, i) => s + i.quantidade * i.valorUnit, 0)
    const descontoVal = Math.max(0, desconto ?? 0)
    const freteVal = Math.max(0, valorFrete ?? 0)
    const valorTotal = subtotal - descontoVal + freteVal

    const venda = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const v = await tx.vendaDireta.create({
            data: {
                dataVenda: dataVenda ? new Date(dataVenda) : new Date(),
                clienteId: clienteId || null,
                clienteNome: clienteNome || null,
                clienteDoc: clienteDoc || null,
                desconto: descontoVal as unknown as Decimal,
                valorFrete: freteVal as unknown as Decimal,
                valorTotal: valorTotal as unknown as Decimal,
                observacoes: observacoes || null,
                criadoPor: session.user?.id ?? null,
                itens: {
                    create: validItems.map(i => ({
                        produtoId: i.produtoId,
                        quantidade: i.quantidade as unknown as Decimal,
                        valorUnit: i.valorUnit as unknown as Decimal,
                        valorTotal: (i.quantidade * i.valorUnit) as unknown as Decimal,
                    })),
                },
            },
        })

        for (const item of validItems) {
            await tx.estoqueProduto.upsert({
                where: { produtoId: item.produtoId },
                create: { produtoId: item.produtoId, quantidadeAtual: 0 },
                update: { quantidadeAtual: { decrement: item.quantidade } },
            })
        }

        await tx.contaReceber.create({
            data: {
                vendaDiretaId: v.id,
                descricao: `Venda direta${clienteNome ? ` — ${clienteNome}` : ''}`,
                valorTotal: valorTotal as unknown as Decimal,
                valorComissao: 0,
                valorRepasse: valorTotal as unknown as Decimal,
                valorRecebido: 0,
                saldoAberto: valorTotal as unknown as Decimal,
                status: 'EM_ABERTO',
                observacoes: observacoes || null,
            },
        })

        return v
    })

    return NextResponse.json(venda, { status: 201 })
}
