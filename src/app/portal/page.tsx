import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Portal do Parceiro' }

export default async function PortalPage() {
    const session = await auth()
    if (!session) redirect('/login')
    const userSession = session.user as { role: string; parceiroId?: string | null; name?: string | null; id?: string }
    if (userSession.role !== 'PARTNER' || !userSession.parceiroId) redirect('/login')
    const parceiroId = userSession.parceiroId

    const now = new Date()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()

    const [estoqueConsignado, ultimasVendas, fechamentos] = await Promise.all([
        prisma.estoqueConsignado.findMany({
            where: { parceiroId, quantidadeAtual: { gt: 0 } },
            include: { produto: { select: { nome: true, unidadeMedida: true, precoPadrao: true } } },
            orderBy: { produto: { nome: 'asc' } },
        }),
        // Últimas 5 vendas (FechamentoItens não excluídos)
        prisma.fechamentoItem.findMany({
            where: { fechamento: { parceiroId }, excluido: false },
            include: { produto: { select: { nome: true, unidadeMedida: true } } },
            orderBy: { dataVenda: 'desc' },
            take: 5,
        }),
        prisma.fechamento.findMany({
            where: { parceiroId },
            orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
            take: 3,
            include: { contasReceber: { select: { status: true, valorTotal: true, saldoAberto: true } } },
        }),
    ])

    const totalConsignado = estoqueConsignado.reduce((s, e) => s + Number(e.quantidadeAtual), 0)
    const totalMes = ultimasVendas
        .filter(v => {
            const d = v.dataVenda ? new Date(v.dataVenda) : null
            return d && d.getMonth() + 1 === mes && d.getFullYear() === ano
        })
        .reduce((s, v) => s + Number(v.valorTotal), 0)

    const mesesNomes = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Welcome */}
            <div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-4xl)', color: 'var(--color-primary)' }}>
                    Olá, {userSession.name?.split(' ')[0] ?? 'Parceiro'}!
                </h1>
                <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Aqui está seu painel de consignação HAUXHAUX.
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-3" style={{ gap: 'var(--space-4)' }}>
                <div className="kpi-card">
                    <div className="kpi-label">Produtos consignados</div>
                    <div className="kpi-value">{estoqueConsignado.length}</div>
                    <div className="kpi-sub">tipos em seu estoque</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Total de itens</div>
                    <div className="kpi-value">{totalConsignado.toFixed(0)}</div>
                    <div className="kpi-sub">unidades disponíveis</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Vendas este mês</div>
                    <div className="kpi-value" style={{ color: 'var(--color-accent)', fontSize: 'var(--text-2xl)' }}>R$ {totalMes.toFixed(2)}</div>
                    <div className="kpi-sub">acumulado {mesesNomes[mes]}/{ano}</div>
                </div>
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--space-5)' }}>
                {/* Consigned stock */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📦 Meu Estoque Consignado</h3>
                        <a href="/portal/estoque" className="btn btn-secondary btn-sm">Ver tudo</a>
                    </div>
                    <div style={{ padding: 0 }}>
                        {estoqueConsignado.length === 0 ? (
                            <div className="empty-state"><div className="empty-state-desc">Nenhum produto em consignação.</div></div>
                        ) : (
                            <table className="table">
                                <thead><tr><th>Produto</th><th>Qtd.</th></tr></thead>
                                <tbody>
                                    {estoqueConsignado.slice(0, 6).map((e) => (
                                        <tr key={e.id}>
                                            <td className="font-medium">{e.produto.nome}</td>
                                            <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                                {Number(e.quantidadeAtual).toFixed(0)} {e.produto.unidadeMedida}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    {/* Últimas Vendas */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">🛍️ Últimas Vendas</h3>
                            <a href="/portal/vendas" className="btn btn-primary btn-sm">+ Venda</a>
                        </div>
                        <div style={{ padding: 0 }}>
                            {ultimasVendas.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-4)' }}>
                                    <div className="empty-state-desc">Nenhuma venda registrada.</div>
                                </div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Data</th><th>Produto</th><th>Total</th></tr></thead>
                                    <tbody>
                                        {ultimasVendas.map((v) => (
                                            <tr key={v.id}>
                                                <td className="text-sm">{v.dataVenda ? new Date(v.dataVenda).toLocaleDateString('pt-BR') : '—'}</td>
                                                <td className="font-medium text-sm">{v.produto.nome}</td>
                                                <td className="font-medium" style={{ color: 'var(--color-accent)' }}>R$ {Number(v.valorTotal).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
                                <a href="/portal/minhas-vendas" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)' }}>
                                    Ver todas as vendas →
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Fechamentos */}
                    <div className="card">
                        <div className="card-header"><h3 className="card-title">💰 Fechamentos</h3></div>
                        <div style={{ padding: 0 }}>
                            {fechamentos.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-4)' }}><div className="empty-state-desc">Nenhum fechamento.</div></div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Competência</th><th>Valor</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {fechamentos.map((f) => (
                                            <tr key={f.id}>
                                                <td>{String(f.competenciaMes).padStart(2, '0')}/{f.competenciaAno}</td>
                                                <td className="font-medium">R$ {Number(f.totalValor ?? 0).toFixed(2)}</td>
                                                <td><span className={`badge ${f.status === 'FECHADO' ? 'badge-info' : f.status === 'ABERTO' ? 'badge-warning' : 'badge-neutral'}`}>{f.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
