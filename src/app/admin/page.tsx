import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata = { title: 'Dashboard' }

async function getStats() {
    const [
        totalParceiros,
        totalProdutos,
        totalInsumos,
        contasAbertas,
        estoqueMinimo,
        ultimasProducoes,
        ultimasRemessas,
    ] = await Promise.all([
        prisma.parceiro.count({ where: { status: 'ATIVO' } }),
        prisma.produto.count({ where: { ativo: true } }),
        prisma.insumo.count({ where: { ativo: true } }),
        prisma.contaReceber.aggregate({
            where: { status: { in: ['EM_ABERTO', 'PARCIAL', 'VENCIDO'] } },
            _sum: { saldoAberto: true },
            _count: true,
        }),
        prisma.estoqueProduto.findMany({
            include: { produto: { select: { nome: true, estoqueMinimo: true, unidadeMedida: true } } },
            orderBy: { quantidadeAtual: 'asc' },
            take: 5,
        }),
        prisma.producao.findMany({
            orderBy: { criadoEm: 'desc' },
            take: 5,
            include: { produto: { select: { nome: true } } },
        }),
        prisma.remessaConsignacao.findMany({
            orderBy: { dataEnvio: 'desc' },
            take: 5,
            include: { parceiro: { select: { nome: true } } },
        }),
    ])
    return { totalParceiros, totalProdutos, totalInsumos, contasAbertas, estoqueMinimo, ultimasProducoes, ultimasRemessas }
}

const statusColors: Record<string, string> = {
    CONFIRMADA: '#4a7c59', RASCUNHO: '#c5843a', CANCELADA: '#9e3a2f',
}

export default async function AdminDashboard() {
    const session = await auth()
    if (!session) redirect('/login')

    const stats = await getStats()

    const saldoAReceber = Number(stats.contasAbertas._sum.saldoAberto ?? 0)

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Dashboard</h1>
                    <p className="page-header-sub">Visão geral da operação HAUXHAUX</p>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-4" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="kpi-card">
                    <div className="kpi-label">Parceiros Ativos</div>
                    <div className="kpi-value">{stats.totalParceiros}</div>
                    <div className="kpi-sub">em consignação</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Produtos</div>
                    <div className="kpi-value">{stats.totalProdutos}</div>
                    <div className="kpi-sub">cadastrados</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Insumos</div>
                    <div className="kpi-value">{stats.totalInsumos}</div>
                    <div className="kpi-sub">cadastrados</div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': 'var(--color-warning)' } as React.CSSProperties}>
                    <div className="kpi-label">A Receber</div>
                    <div className="kpi-value" style={{ color: saldoAReceber > 0 ? 'var(--color-warning)' : 'inherit' }}>
                        R$ {saldoAReceber.toFixed(0)}
                    </div>
                    <div className="kpi-sub">{stats.contasAbertas._count} conta(s) em aberto</div>
                </div>
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--space-5)' }}>
                {/* Stock alerts */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">⚠️ Estoque Baixo</h3>
                        <Link href="/admin/estoque" className="btn btn-ghost btn-sm">Ver tudo</Link>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {stats.estoqueMinimo.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                <div className="empty-state-desc">Estoque OK!</div>
                            </div>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr><th>Produto</th><th>Saldo</th><th>Mínimo</th></tr>
                                </thead>
                                <tbody>
                                    {stats.estoqueMinimo.map((e) => {
                                        const baixo = Number(e.quantidadeAtual) <= Number(e.produto.estoqueMinimo)
                                        return (
                                            <tr key={e.id}>
                                                <td className="font-medium">{e.produto.nome}</td>
                                                <td style={{ color: baixo ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>
                                                    {Number(e.quantidadeAtual).toFixed(3)} {e.produto.unidadeMedida}
                                                </td>
                                                <td className="text-muted text-sm">{Number(e.produto.estoqueMinimo).toFixed(3)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Últimas produções */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">⚗️ Últimas Produções</h3>
                        <Link href="/admin/producao" className="btn btn-ghost btn-sm">Ver tudo</Link>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {stats.ultimasProducoes.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                <div className="empty-state-desc">Nenhuma produção registrada</div>
                            </div>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr><th>Lote</th><th>Produto</th><th>Qtd</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {stats.ultimasProducoes.map((p) => (
                                        <tr key={p.id}>
                                            <td className="text-sm text-muted">{p.codigoLote}</td>
                                            <td className="font-medium truncate" style={{ maxWidth: 140 }}>{p.produto.nome}</td>
                                            <td className="text-sm">{Number(p.quantidadePrevista).toFixed(3)}</td>
                                            <td>
                                                <span className="badge" style={{ background: `${statusColors[p.status] ?? '#aaa'}22`, color: statusColors[p.status] ?? '#666' }}>
                                                    {p.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Últimas remessas */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <h3 className="card-title">🚚 Últimas Remessas</h3>
                        <Link href="/admin/consignacao/remessas" className="btn btn-ghost btn-sm">Ver tudo</Link>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {stats.ultimasRemessas.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                <div className="empty-state-desc">Nenhuma remessa registrada</div>
                            </div>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr><th>Parceiro</th><th>Data</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {stats.ultimasRemessas.map((r) => (
                                        <tr key={r.id}>
                                            <td className="font-medium">{r.parceiro.nome}</td>
                                            <td className="text-sm">{new Date(r.dataEnvio).toLocaleDateString('pt-BR')}</td>
                                            <td><span className="badge" style={{ background: `${statusColors[r.status] ?? '#aaa'}22`, color: statusColors[r.status] ?? '#666' }}>{r.status}</span></td>
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
