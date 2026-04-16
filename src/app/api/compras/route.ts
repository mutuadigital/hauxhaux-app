import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Decimal } from '@prisma/client/runtime/library'

export async function GET(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const compras = await prisma.compra.findMany({
        orderBy: { dataCompra: 'desc' },
        include: { itens: { include: { insumo: { select: { nome: true, unidadeMedida: true } } } } },
        take: 100,
    })
    return NextResponse.json(compras)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session || (session.user as { role: string }).role !== 'ADMIN')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { fornecedorNome, dataCompra, documentoRef, itens, observacoes } = body
    if (!fornecedorNome || !dataCompra || !itens?.length)
        return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

    const valorTotal = itens.reduce((s: number, i: { valorTotal: number }) => s + Number(i.valorTotal), 0)

    const compra = await prisma.$transaction(async (tx) => {
        const c = await tx.compra.create({
            data: {
                fornecedorNome,
                dataCompra: new Date(dataCompra),
                documentoRef: documentoRef || null,
                valorTotal,
                observacoes: observacoes || null,
                criadoPor: session.user?.id ?? null,
                itens: {
                    create: itens.map((i: { insumoId: string; quantidade: number; valorUnit: number; valorTotal: number }) => ({
                        insumoId: i.insumoId,
                        quantidade: i.quantidade,
                        valorUnit: i.valorUnit,
                        valorTotal: i.valorTotal,
                    })),
                },
            },
            include: { itens: true },
        })

        // Update insumo stock for each item
        for (const item of c.itens) {
            const existing = await tx.estoqueInsumo.findUnique({ where: { insumoId: item.insumoId } })
            if (existing) {
                await tx.estoqueInsumo.update({
                    where: { insumoId: item.insumoId },
                    data: { quantidadeAtual: { increment: item.quantidade } },
                })
            } else {
                await tx.estoqueInsumo.create({ data: { insumoId: item.insumoId, quantidadeAtual: item.quantidade } })
            }
            // Record movement
            await tx.movimentoEstoqueInsumo.create({
                data: {
                    insumoId: item.insumoId,
                    tipoMovimento: 'COMPRA_ENTRADA',
                    origemTipo: 'COMPRA',
                    origemId: c.id,
                    quantidade: item.quantidade,
                    sinal: 'ENTRADA',
                    custoUnitario: item.valorUnit as unknown as Decimal,
                    criadoPor: session.user?.id ?? null,
                },
            })
            // Update custo medio on insumo
            await tx.insumo.update({
                where: { id: item.insumoId },
                data: { custoMedio: item.valorUnit as unknown as Decimal },
            })
        }
        return c
    })

    return NextResponse.json(compra, { status: 201 })
}
