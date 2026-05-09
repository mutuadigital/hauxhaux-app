import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma } from '@prisma/client'

// Register a sale and automatically create/update the monthly fechamento
export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { parceiroId: true } })
    if (!user?.parceiroId) return NextResponse.json({ error: 'Parceiro não vinculado' }, { status: 403 })
    const parceiroId = user.parceiroId

    const body = await req.json()
    const { produtoId, quantidade } = body as { produtoId: string; quantidade: number }
    if (!produtoId || !quantidade || quantidade <= 0)
        return NextResponse.json({ error: 'Produto e quantidade são obrigatórios' }, { status: 400 })

    // Validate partner has enough consigned stock
    const estoque = await prisma.estoqueConsignado.findUnique({
        where: { parceiroId_produtoId: { parceiroId, produtoId } },
        include: { produto: { select: { precoPadrao: true, nome: true } } },
    })
    if (!estoque || Number(estoque.quantidadeAtual) < quantidade)
        return NextResponse.json({ error: 'Estoque consignado insuficiente' }, { status: 422 })

    // Get parceiro for commission
    const parceiro = await prisma.parceiro.findUnique({
        where: { id: parceiroId },
        select: { percentualComissao: true },
    })

    const now = new Date()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()
    const vlr = Number(estoque.produto.precoPadrao)
    const comissaoPct = Number(parceiro?.percentualComissao ?? 0)

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Deduct from consigned stock
        await tx.estoqueConsignado.update({
            where: { parceiroId_produtoId: { parceiroId, produtoId } },
            data: { quantidadeAtual: { decrement: quantidade } },
        })

        // 2. Upsert Fechamento for this month
        const fechamento = await tx.fechamento.upsert({
            where: { parceiroId_competenciaAno_competenciaMes: { parceiroId, competenciaAno: ano, competenciaMes: mes } },
            create: {
                parceiroId,
                competenciaAno: ano,
                competenciaMes: mes,
                status: 'ABERTO',
                criadoPor: userId,
            },
            update: {},
        })

        // 3. Get current saldo consignado (after decrement)
        const estoqueAtual = await tx.estoqueConsignado.findUnique({
            where: { parceiroId_produtoId: { parceiroId, produtoId } },
        })
        const saldoAtual = Number(estoqueAtual?.quantidadeAtual ?? 0)

        // 4. Upsert FechamentoItem for this product
        const existingItem = await tx.fechamentoItem.findFirst({
            where: { fechamentoId: fechamento.id, produtoId },
        })

        const valorComissao = (vlr * quantidade * comissaoPct) / 100
        const valorRepasse = vlr * quantidade - valorComissao

        if (existingItem) {
            const novaQtdConsumida = Number(existingItem.quantidadeConsumida) + quantidade
            const novoTotal = vlr * novaQtdConsumida
            const novaComissao = (novoTotal * comissaoPct) / 100
            const novoRepasse = novoTotal - novaComissao

            await tx.fechamentoItem.update({
                where: { id: existingItem.id },
                data: {
                    quantidadeConsumida: { increment: quantidade as unknown as Decimal },
                    saldoFinal: saldoAtual as unknown as Decimal,
                    valorTotal: novoTotal as unknown as Decimal,
                    valorComissao: novaComissao as unknown as Decimal,
                    valorRepasse: novoRepasse as unknown as Decimal,
                },
            })
        } else {
            // Saldo inicial = saldo atual + quantidade vendida agora
            const saldoInicial = saldoAtual + quantidade

            await tx.fechamentoItem.create({
                data: {
                    fechamentoId: fechamento.id,
                    produtoId,
                    saldoInicial: saldoInicial as unknown as Decimal,
                    quantidadeEnviada: 0,
                    quantidadeDevolvida: 0,
                    quantidadeConsumida: quantidade as unknown as Decimal,
                    saldoFinal: saldoAtual as unknown as Decimal,
                    valorUnitario: vlr as unknown as Decimal,
                    valorTotal: (vlr * quantidade) as unknown as Decimal,
                    valorComissao: valorComissao as unknown as Decimal,
                    valorRepasse: valorRepasse as unknown as Decimal,
                },
            })
        }

        // 5. Recalculate Fechamento totals
        const allItens = await tx.fechamentoItem.findMany({
            where: { fechamentoId: fechamento.id },
        })
        const totalQtd = allItens.reduce((s, i) => s + Number(i.quantidadeConsumida), 0)
        const totalVal = allItens.reduce((s, i) => s + Number(i.valorTotal), 0)

        await tx.fechamento.update({
            where: { id: fechamento.id },
            data: {
                totalQuantidade: totalQtd as unknown as Decimal,
                totalValor: totalVal as unknown as Decimal,
                atualizadoPor: userId,
            },
        })
    })

    return NextResponse.json({ ok: true }, { status: 201 })
}

// Get current month's sales (fechamento items) for this partner
export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { parceiroId: true } })
    if (!user?.parceiroId) return NextResponse.json([])
    const parceiroId = user.parceiroId

    const now = new Date()
    const fechamento = await prisma.fechamento.findUnique({
        where: {
            parceiroId_competenciaAno_competenciaMes: {
                parceiroId,
                competenciaAno: now.getFullYear(),
                competenciaMes: now.getMonth() + 1,
            },
        },
        include: {
            itens: {
                include: { produto: { select: { nome: true, unidadeMedida: true } } },
                orderBy: { produto: { nome: 'asc' } },
            },
        },
    })

    // Map to match the frontend shape (quantidadeConsumida, valorUnitarioRef)
    const items = (fechamento?.itens ?? []).map((i) => ({
        id: i.id,
        produto: i.produto,
        quantidadeConsumida: i.quantidadeConsumida,
        valorUnitarioRef: i.valorUnitario,
    }))

    return NextResponse.json(items)
}
