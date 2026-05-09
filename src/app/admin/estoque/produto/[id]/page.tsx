import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const p = await prisma.produto.findUnique({ where: { id }, select: { nome: true } })
    return { title: `Estoque: ${p?.nome ?? 'Produto'} — Admin` }
}

export default async function EstoqueProdutoDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session || (session.user as { role?: string })?.role !== 'ADMIN') redirect('/login')

    const { id } = await params
    const produto = await prisma.produto.findUnique({
        where: { id },
        include: {
            estoque: true,
            producoes: {
                orderBy: { dataProducao: 'desc' },
                take: 10,
                include: { produto: { select: { unidadeMedida: true } } },
            },
            remessasConsignacao: {
                orderBy: { remessa: { dataEnvio: 'desc' } },
                take: 15,
                include: { remessa: { select: { dataEnvio: true, parceiro: { select: { nome: true } } } } },
            },
            estoqueConsignado: {
                include: { parceiro: { select: { nome: true, percentualComissao: true } } },
                orderBy: { parceiro: { nome: 'asc' } },
            },
        },
    })
    if (!produto) notFound()

    const saldoAtual = Number(produto.estoque?.quantidadeAtual ?? 0)
    const totalConsignado = produto.estoqueConsignado.reduce((s, e) => s + Number(e.quantidadeAtual), 0)

    const statusProducaoBadge: Record<string, string> = {
        RASCUNHO: 'badge-warning', CONFIRMADA: 'badge-success', CANCELADA: 'badge-danger',
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        <Link href="/admin/estoque" style={{ color: 'var(--color-accent)' }}>← Estoque</Link>
                    </div>
                    <h1 className="page-header-title">{produto.nome}</h1>
                    <p className="page-header-sub">
                        {produto.codigo && <span>{produto.codigo} · </span>}
                        {produto.unidadeMedida} · {produto.categoria ? produto.categoria : 'Sem categoria'}
                    </p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Saldo interno</div>
                    <div className="kpi-value" style={{ color: saldoAtual > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {saldoAtual.toFixed(0)}
                    </div>
                    <div className="kpi-sub">{produto.unidadeMedida} em estoque</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Em consignação</div>
                    <div className="kpi-value" style={{ color: 'var(--color-info)' }}>{totalConsignado.toFixed(0)}</div>
                    <div className="kpi-sub">{produto.estoqueConsignado.length} parceiro(s)</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Preço de venda</div>
                    <div className="kpi-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-accent)' }}>
                        R$ {Number(produto.precoPadrao).toFixed(2)}
                    </div>
                    <div className="kpi-sub">custo ref: {produto.custoRef ? `R$ ${Number(produto.custoRef).toFixed(2)}` : '—'}</div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {/* Consignado por parceiro */}
                <div className="card">
                    <div className="card-header"><h3 className="card-title">📦 Estoque Consignado por Parceiro</h3></div>
                    <div className="table-wrapper">
                        {produto.estoqueConsignado.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                <div className="empty-state-desc">Nenhum item consignado</div>
                            </div>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr><th>Parceiro</th><th>Qtd. Atual</th><th>Valor (venda)</th><th>Valor Líquido</th></tr>
                                </thead>
                                <tbody>
                                    {produto.estoqueConsignado.map(e => {
                                        const qtd = Number(e.quantidadeAtual)
                                        const preco = Number(produto.precoPadrao)
                                        const comissao = Number(e.parceiro.percentualComissao ?? 0)
                                        const valor = qtd * preco
                                        const liquido = valor * (1 - comissao / 100)
                                        return (
                                            <tr key={e.id}>
                                                <td className="font-medium">
                                                    <Link href={`/admin/parceiros/${e.parceiroId}`} style={{ color: 'var(--color-accent)' }}>
                                                        {e.parceiro.nome}
                                                    </Link>
                                                </td>
                                                <td style={{ fontWeight: 700, color: qtd > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                    {qtd.toFixed(0)} {produto.unidadeMedida}
                                                </td>
                                                <td className="font-medium">R$ {valor.toFixed(2)}</td>
                                                <td className="text-sm text-muted">R$ {liquido.toFixed(2)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="grid grid-2" style={{ gap: 'var(--space-5)' }}>
                    {/* Produções */}
                    <div className="card">
                        <div className="card-header"><h3 className="card-title">🏭 Histórico de Produções</h3></div>
                        <div className="table-wrapper">
                            {produto.producoes.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                    <div className="empty-state-desc">Nenhuma produção registrada</div>
                                </div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Data</th><th>Lote</th><th>Qtd.</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {produto.producoes.map(p => (
                                            <tr key={p.id}>
                                                <td className="text-sm">{new Date(p.dataProducao).toLocaleDateString('pt-BR')}</td>
                                                <td className="text-xs text-muted">{p.codigoLote}</td>
                                                <td className="font-medium">{Number(p.quantidadeRealizada ?? p.quantidadePrevista).toFixed(0)} {p.produto.unidadeMedida}</td>
                                                <td><span className={`badge ${statusProducaoBadge[p.status] ?? 'badge-neutral'}`}>{p.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Remessas */}
                    <div className="card">
                        <div className="card-header"><h3 className="card-title">🚚 Histórico de Remessas</h3></div>
                        <div className="table-wrapper">
                            {produto.remessasConsignacao.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                    <div className="empty-state-desc">Nenhuma remessa registrada</div>
                                </div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Data</th><th>Parceiro</th><th>Qtd.</th></tr></thead>
                                    <tbody>
                                        {produto.remessasConsignacao.map(i => (
                                            <tr key={i.id}>
                                                <td className="text-sm">{new Date(i.remessa.dataEnvio).toLocaleDateString('pt-BR')}</td>
                                                <td className="font-medium">{i.remessa.parceiro.nome}</td>
                                                <td className="font-medium" style={{ color: 'var(--color-info)' }}>
                                                    {Number(i.quantidade).toFixed(0)} {produto.unidadeMedida}
                                                </td>
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
