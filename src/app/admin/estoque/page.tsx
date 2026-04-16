import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Estoque' }

type EstoqueProdutoItem = {
    id: string
    quantidadeAtual: unknown
    produto: { nome: string; codigo: string | null; unidadeMedida: string; estoqueMinimo: unknown; ativo: boolean }
}
type EstoqueInsumoItem = {
    id: string
    quantidadeAtual: unknown
    insumo: { nome: string; codigo: string | null; unidadeMedida: string; estoqueMinimo: unknown; ativo: boolean }
}
type EstoqueConsignadoItem = {
    id: string
    quantidadeAtual: unknown
    produto: { nome: string; unidadeMedida: string }
    parceiro: { nome: string }
}

export default async function EstoquePage() {
    const session = await auth()
    if (!session || (session.user as { role?: string })?.role !== 'ADMIN') redirect('/login')

    const [produtos, insumos, consignado] = await Promise.all([
        prisma.estoqueProduto.findMany({
            include: { produto: { select: { nome: true, codigo: true, unidadeMedida: true, estoqueMinimo: true, ativo: true } } },
            orderBy: { produto: { nome: 'asc' } },
        }),
        prisma.estoqueInsumo.findMany({
            include: { insumo: { select: { nome: true, codigo: true, unidadeMedida: true, estoqueMinimo: true, ativo: true } } },
            orderBy: { insumo: { nome: 'asc' } },
        }),
        prisma.estoqueConsignado.findMany({
            where: { quantidadeAtual: { gt: 0 } },
            include: {
                produto: { select: { nome: true, unidadeMedida: true } },
                parceiro: { select: { nome: true } },
            },
            orderBy: [{ parceiro: { nome: 'asc' } }, { produto: { nome: 'asc' } }],
        }),
    ]) as [EstoqueProdutoItem[], EstoqueInsumoItem[], EstoqueConsignadoItem[]]

    const totalProdutos = produtos.filter(e => Number(e.quantidadeAtual) > 0).length
    const totalInsumos = insumos.filter(e => Number(e.quantidadeAtual) > 0).length
    const alertasProdutos = produtos.filter(e => e.produto.ativo && Number(e.quantidadeAtual) <= Number(e.produto.estoqueMinimo))
    const alertasInsumos = insumos.filter(e => e.insumo.ativo && Number(e.quantidadeAtual) <= Number(e.insumo.estoqueMinimo))
    const totalAlertas = alertasProdutos.length + alertasInsumos.length

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Estoque</h1>
                    <p className="page-header-sub">Saldos de produtos, insumos e itens consignados</p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="kpi-card">
                    <div className="kpi-label">Produtos com saldo</div>
                    <div className="kpi-value">{totalProdutos}</div>
                    <div className="kpi-sub">de {produtos.length} cadastrados</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Insumos com saldo</div>
                    <div className="kpi-value">{totalInsumos}</div>
                    <div className="kpi-sub">de {insumos.length} cadastrados</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Alertas críticos</div>
                    <div className="kpi-value" style={{ color: totalAlertas > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{totalAlertas}</div>
                    <div className="kpi-sub">itens abaixo do mínimo</div>
                </div>
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--space-5)' }}>
                {/* Produtos */}
                <div className="card">
                    <div className="card-header"><h3 className="card-title">🧴 Produtos Acabados</h3></div>
                    <div className="table-wrapper">
                        {produtos.length === 0 ? <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-desc">Nenhum produto</div></div> : (
                            <table className="table">
                                <thead><tr><th>Produto</th><th>Un.</th><th>Saldo</th><th>Mín.</th></tr></thead>
                                <tbody>
                                    {produtos.map((e) => {
                                        const baixo = Number(e.quantidadeAtual) <= Number(e.produto.estoqueMinimo)
                                        return (
                                            <tr key={e.id} style={baixo ? { background: 'rgba(158,58,47,0.04)' } : {}}>
                                                <td>
                                                    <div className="font-medium">{e.produto.nome}</div>
                                                    {e.produto.codigo && <div className="text-xs text-muted">{e.produto.codigo}</div>}
                                                </td>
                                                <td className="text-sm">{e.produto.unidadeMedida}</td>
                                                <td style={{ fontWeight: 700, color: baixo ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                    {Number(e.quantidadeAtual).toFixed(3)}
                                                </td>
                                                <td className="text-sm text-muted">{Number(e.produto.estoqueMinimo).toFixed(3)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Insumos */}
                <div className="card">
                    <div className="card-header"><h3 className="card-title">🌿 Insumos</h3></div>
                    <div className="table-wrapper">
                        {insumos.length === 0 ? <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-desc">Nenhum insumo</div></div> : (
                            <table className="table">
                                <thead><tr><th>Insumo</th><th>Un.</th><th>Saldo</th><th>Mín.</th></tr></thead>
                                <tbody>
                                    {insumos.map((e) => {
                                        const baixo = Number(e.quantidadeAtual) <= Number(e.insumo.estoqueMinimo)
                                        return (
                                            <tr key={e.id} style={baixo ? { background: 'rgba(158,58,47,0.04)' } : {}}>
                                                <td>
                                                    <div className="font-medium">{e.insumo.nome}</div>
                                                    {e.insumo.codigo && <div className="text-xs text-muted">{e.insumo.codigo}</div>}
                                                </td>
                                                <td className="text-sm">{e.insumo.unidadeMedida}</td>
                                                <td style={{ fontWeight: 700, color: baixo ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                    {Number(e.quantidadeAtual).toFixed(4)}
                                                </td>
                                                <td className="text-sm text-muted">{Number(e.insumo.estoqueMinimo).toFixed(3)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Consignado */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header"><h3 className="card-title">📦 Estoque Consignado por Parceiro</h3></div>
                    <div className="table-wrapper">
                        {consignado.length === 0 ? (
                            <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-desc">Nenhum item consignado com saldo</div></div>
                        ) : (
                            <table className="table">
                                <thead><tr><th>Parceiro</th><th>Produto</th><th>Un.</th><th>Qtd. Consignada</th></tr></thead>
                                <tbody>
                                    {consignado.map((e) => (
                                        <tr key={e.id}>
                                            <td className="font-medium">{e.parceiro.nome}</td>
                                            <td>{e.produto.nome}</td>
                                            <td className="text-sm">{e.produto.unidadeMedida}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--color-info)' }}>{Number(e.quantidadeAtual).toFixed(3)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
