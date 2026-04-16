import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Portal do Parceiro' }

export default async function PortalPage() {
    const session = await auth()
    if (!session) redirect('/login')
    const userSession = session.user as { role: string; parceiroId?: string | null; name?: string | null }
    if (userSession.role !== 'PARTNER' || !userSession.parceiroId) redirect('/login')

    const [estoqueConsignado, declaracoes, fechamentos] = await Promise.all([
        prisma.estoqueConsignado.findMany({
            where: { parceiroId: userSession.parceiroId, quantidadeAtual: { gt: 0 } },
            include: { produto: { select: { nome: true, unidadeMedida: true, precoPadrao: true } } },
            orderBy: { produto: { nome: 'asc' } },
        }),
        prisma.declaracaoConsumo.findMany({
            where: { parceiroId: userSession.parceiroId },
            orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
            take: 3,
        }),
        prisma.fechamento.findMany({
            where: { parceiroId: userSession.parceiroId },
            orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
            take: 3,
            include: { contasReceber: { select: { status: true, valorTotal: true, saldoAberto: true } } },
        }),
    ])

    const totalConsignado = estoqueConsignado.reduce((s, e) => s + Number(e.quantidadeAtual), 0)

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
                    <div className="kpi-sub">unidades / gramas</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Declarações</div>
                    <div className="kpi-value">{declaracoes.length}</div>
                    <div className="kpi-sub">registradas</div>
                </div>
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--space-5)' }}>
                {/* Consigned stock */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📦 Meu Estoque Consignado</h3>
                    </div>
                    <div style={{ padding: 0 }}>
                        {estoqueConsignado.length === 0 ? (
                            <div className="empty-state"><div className="empty-state-desc">Nenhum produto em consignação.</div></div>
                        ) : (
                            <table className="table">
                                <thead><tr><th>Produto</th><th>Qtd.</th></tr></thead>
                                <tbody>
                                    {estoqueConsignado.map((e) => (
                                        <tr key={e.id}>
                                            <td className="font-medium">{e.produto.nome}</td>
                                            <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                                {Number(e.quantidadeAtual).toFixed(3)} {e.produto.unidadeMedida}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Recent declarations + closings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">📝 Minhas Declarações</h3>
                            <a href="/portal/consumo" className="btn btn-primary btn-sm">+ Nova</a>
                        </div>
                        <div style={{ padding: 0 }}>
                            {declaracoes.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-4)' }}><div className="empty-state-desc">Nenhuma declaração enviada.</div></div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Competência</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {declaracoes.map((d) => (
                                            <tr key={d.id}>
                                                <td>{String(d.competenciaMes).padStart(2, '0')}/{d.competenciaAno}</td>
                                                <td><span className={`badge ${d.status === 'ENVIADO' ? 'badge-success' : d.status === 'INCORPORADO_NO_FECHAMENTO' ? 'badge-info' : 'badge-neutral'}`}>{d.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

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
                                                <td><span className={`badge ${f.status === 'FECHADO' ? 'badge-info' : 'badge-warning'}`}>{f.status}</span></td>
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
