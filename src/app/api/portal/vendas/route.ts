import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma } from '@prisma/client'

// Register a sale in the partner's current-month declaration
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

    const now = new Date()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Find or create declaracao de consumo for current month
        const declaracao = await tx.declaracaoConsumo.upsert({
            where: { parceiroId_competenciaAno_competenciaMes: { parceiroId, competenciaAno: ano, competenciaMes: mes } },
            create: { parceiroId, competenciaAno: ano, competenciaMes: mes, status: 'RASCUNHO' },
            update: {},
        })

        // Find or create item for this product in the declaration
        const existingItem = await tx.declaracaoConsumoItem.findFirst({
            where: { declaracaoId: declaracao.id, produtoId },
        })

        const vlr = Number(estoque.produto.precoPadrao)

        if (existingItem) {
            await tx.declaracaoConsumoItem.update({
                where: { id: existingItem.id },
                data: {
                    quantidadeConsumida: { increment: quantidade },
                },
            })
        } else {
            await tx.declaracaoConsumoItem.create({
                data: {
                    declaracaoId: declaracao.id,
                    produtoId,
                    quantidadeConsumida: quantidade as unknown as Decimal,
                    valorUnitarioRef: vlr as unknown as Decimal,
                },
            })
        }

        // Immediately deduct from consigned stock (real-time control for the partner)
        await tx.estoqueConsignado.update({
            where: { parceiroId_produtoId: { parceiroId, produtoId } },
            data: { quantidadeAtual: { decrement: quantidade } },
        })
    })

    return NextResponse.json({ ok: true }, { status: 201 })
}

// Get current month's sales (declaration items) for this partner
export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as { id: string }).id
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { parceiroId: true } })
    if (!user?.parceiroId) return NextResponse.json([])
    const parceiroId = user.parceiroId

    const now = new Date()
    const declaracao = await prisma.declaracaoConsumo.findUnique({
        where: { parceiroId_competenciaAno_competenciaMes: { parceiroId, competenciaAno: now.getFullYear(), competenciaMes: now.getMonth() + 1 } },
        include: {
            itens: {
                include: { produto: { select: { nome: true, unidadeMedida: true } } },
                orderBy: { produto: { nome: 'asc' } },
            },
        },
    })
    return NextResponse.json(declaracao?.itens ?? [])
}
