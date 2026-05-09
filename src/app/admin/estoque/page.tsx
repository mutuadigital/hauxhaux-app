import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import EstoqueClient from './EstoqueClient'

export const metadata = { title: 'Estoque' }

export default async function EstoquePage() {
    const session = await auth()
    if (!session || (session.user as { role?: string })?.role !== 'ADMIN') redirect('/login')

    const [produtos, insumos, consignado, parceiros] = await Promise.all([
        prisma.estoqueProduto.findMany({
            include: {
                produto: { select: { nome: true, codigo: true, unidadeMedida: true, estoqueMinimo: true, ativo: true, precoPadrao: true } },
            },
            orderBy: { produto: { nome: 'asc' } },
        }),
        prisma.estoqueInsumo.findMany({
            include: {
                insumo: { select: { nome: true, codigo: true, unidadeMedida: true, estoqueMinimo: true, ativo: true, custoMedio: true } },
            },
            orderBy: { insumo: { nome: 'asc' } },
        }),
        prisma.estoqueConsignado.findMany({
            where: { quantidadeAtual: { gt: 0 } },
            include: {
                produto: { select: { nome: true, unidadeMedida: true, precoPadrao: true } },
                parceiro: { select: { nome: true, percentualComissao: true } },
            },
            orderBy: [{ parceiro: { nome: 'asc' } }, { produto: { nome: 'asc' } }],
        }),
        prisma.parceiro.findMany({
            where: { status: 'ATIVO' },
            select: { id: true, nome: true },
            orderBy: { nome: 'asc' },
        }),
    ])

    const alertasProdutos = produtos.filter(e => e.produto.ativo && Number(e.quantidadeAtual) <= Number(e.produto.estoqueMinimo))
    const alertasInsumos = insumos.filter(e => e.insumo.ativo && Number(e.quantidadeAtual) <= Number(e.insumo.estoqueMinimo))
    const totalAlertas = alertasProdutos.length + alertasInsumos.length

    // Serialize Decimal fields
    const produtosSer = produtos.map(e => ({
        ...e,
        quantidadeAtual: Number(e.quantidadeAtual),
        produtoId: e.produtoId,
        produto: { ...e.produto, estoqueMinimo: Number(e.produto.estoqueMinimo), precoPadrao: Number(e.produto.precoPadrao) },
    }))
    const insumosSer = insumos.map(e => ({
        ...e,
        quantidadeAtual: Number(e.quantidadeAtual),
        insumo: {
            ...e.insumo,
            estoqueMinimo: Number(e.insumo.estoqueMinimo),
            custoMedio: e.insumo.custoMedio != null ? Number(e.insumo.custoMedio) : null,
        },
    }))
    const consignadoSer = consignado.map(e => ({
        ...e,
        quantidadeAtual: Number(e.quantidadeAtual),
        produto: { ...e.produto, precoPadrao: Number(e.produto.precoPadrao) },
        parceiro: { ...e.parceiro, percentualComissao: e.parceiro.percentualComissao != null ? Number(e.parceiro.percentualComissao) : null },
    }))

    return (
        <EstoqueClient
            produtos={produtosSer}
            insumos={insumosSer}
            consignado={consignadoSer}
            parceiros={parceiros}
            totalAlertas={totalAlertas}
        />
    )
}
