import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const p = await prisma.parceiro.findUnique({ where: { id }, select: { nome: true } })
    return { title: `${p?.nome ?? 'Parceiro'} — Admin` }
}

export default async function ParceiroPainelPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role?: string })?.role !== 'ADMIN') redirect('/login')

    const { id } = await params
    const parceiro = await prisma.parceiro.findUnique({
        where: { id },
        include: {
            estoqueConsignado: {
                include: { produto: { select: { nome: true, unidadeMedida: true, precoPadrao: true } } },
                orderBy: { produto: { nome: 'asc' } },
            },
            remessas: {
                orderBy: { dataEnvio: 'desc' },
                take: 6,
                include: { itens: { include: { produto: { select: { nome: true } } } } },
            },
            fechamentos: {
                orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
                take: 12,
                include: { contasReceber: { select: { status: true, valorTotal: true, saldoAberto: true } } },
            },
        },
    })
    if (!parceiro) notFound()

    const mesesNomes = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    const totalConsignado = parceiro.estoqueConsignado.reduce((s, e) => s + Number(e.quantidadeAtual), 0)
    const totalValorConsignado = parceiro.estoqueConsignado.reduce(
        (s, e) => s + Number(e.quantidadeAtual) * Number(e.produto.precoPadrao), 0
    )
    const totalFechado = parceiro.fechamentos
        .filter(f => f.status === 'FECHADO')
        .reduce((s, f) => s + Number(f.totalValor ?? 0), 0)

    const statusFechamentoBadge: Record<string, string> = {
        ABERTO: 'badge-warning', EM_VALIDACAO: 'badge-info', FECHADO: 'badge-success', CANCELADO: 'badge-danger', REABERTO: 'badge-neutral',
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        <Link href="/admin/parceiros" style={{ color: 'var(--color-accent)' }}>← Parceiros</Link>
                    </div>
                    <h1 className="page-header-title">{parceiro.nome}</h1>
                    <p className="page-header-sub">
                        {parceiro.email} {parceiro.telefone ? `· ${parceiro.telefone}` : ''} {parceiro.cidade ? `· ${parceiro.cidade}` : ''}
                    </p>
                </div>
                <div className="page-actions" style={{ flexWrap: 'wrap' }}>
                    <Link href={`/admin/consignacao/remessas`} className="btn btn-primary btn-sm">+ Nova Remessa</Link>
                    <Link href={`/admin/fechamentos`} className="btn btn-secondary btn-sm">+ Fechamento</Link>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Itens consignados</div>
                    <div className="kpi-value">{totalConsignado.toFixed(0)}</div>
                    <div className="kpi-sub">{parceiro.estoqueConsignado.length} produto(s)</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Valor em consignação</div>
                    <div className="kpi-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-accent)' }}>R$ {totalValorConsignado.toFixed(2)}</div>
                    <div className="kpi-sub">preço de venda</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Total fechado</div>
                    <div className="kpi-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-success)' }}>R$ {totalFechado.toFixed(2)}</div>
                    <div className="kpi-sub">em fechamentos concluídos</div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {/* Estoque Consignado */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📦 Estoque Consignado Atual</h3>
                    </div>
                    <div className="table-wrapper">
                        {parceiro.estoqueConsignado.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                <div className="empty-state-desc">Nenhum produto consignado</div>
                            </div>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr><th>Produto</th><th>Qtd.</th><th>Preço</th><th>Valor Total</th></tr>
                                </thead>
                                <tbody>
                                    {parceiro.estoqueConsignado.map(e => (
                                        <tr key={e.id}>
                                            <td className="font-medium">{e.produto.nome}</td>
                                            <td style={{ fontWeight: 700, color: Number(e.quantidadeAtual) > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                {Number(e.quantidadeAtual).toFixed(0)} {e.produto.unidadeMedida}
                                            </td>
                                            <td className="text-sm">R$ {Number(e.produto.precoPadrao).toFixed(2)}</td>
                                            <td className="font-medium" style={{ color: 'var(--color-accent)' }}>
                                                R$ {(Number(e.quantidadeAtual) * Number(e.produto.precoPadrao)).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: 'rgba(197,160,89,0.07)', fontWeight: 700 }}>
                                        <td colSpan={2} />
                                        <td className="text-sm" style={{ textAlign: 'right' }}>Total:</td>
                                        <td style={{ color: 'var(--color-accent)' }}>R$ {totalValorConsignado.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="grid grid-2" style={{ gap: 'var(--space-5)' }}>
                    {/* Remessas */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">🚚 Remessas Recentes</h3>
                            <Link href="/admin/consignacao/remessas" className="btn btn-secondary btn-sm">Ver todas</Link>
                        </div>
                        <div className="table-wrapper">
                            {parceiro.remessas.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                    <div className="empty-state-desc">Nenhuma remessa enviada</div>
                                </div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Data</th><th>Produtos</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {parceiro.remessas.map(r => (
                                            <tr key={r.id}>
                                                <td className="text-sm">{new Date(r.dataEnvio).toLocaleDateString('pt-BR')}</td>
                                                <td className="text-xs text-muted">
                                                    {r.itens.map(i => i.produto.nome).join(', ')}
                                                </td>
                                                <td><span className={`badge ${r.status === 'CONFIRMADA' ? 'badge-success' : r.status === 'CANCELADA' ? 'badge-danger' : 'badge-warning'}`}>{r.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Fechamentos */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">💰 Fechamentos</h3>
                            <Link href="/admin/fechamentos" className="btn btn-secondary btn-sm">Ver todos</Link>
                        </div>
                        <div className="table-wrapper">
                            {parceiro.fechamentos.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                    <div className="empty-state-desc">Nenhum fechamento registrado</div>
                                </div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Competência</th><th>Valor</th><th>Status</th><th>Cobrança</th></tr></thead>
                                    <tbody>
                                        {parceiro.fechamentos.map(f => {
                                            const conta = f.contasReceber[0]
                                            return (
                                                <tr key={f.id}>
                                                    <td className="font-medium">{mesesNomes[f.competenciaMes]}/{f.competenciaAno}</td>
                                                    <td className="font-medium" style={{ color: 'var(--color-accent)' }}>
                                                        R$ {Number(f.totalValor ?? 0).toFixed(2)}
                                                    </td>
                                                    <td><span className={`badge ${statusFechamentoBadge[f.status] ?? 'badge-neutral'}`}>{f.status}</span></td>
                                                    <td>
                                                        {conta ? (
                                                            <span className={`badge ${conta.status === 'RECEBIDO' ? 'badge-success' : 'badge-warning'}`}>
                                                                {conta.status}
                                                            </span>
                                                        ) : <span className="text-muted text-xs">—</span>}
                                                    </td>
                                                </tr>
                                            )
                                        })}
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
