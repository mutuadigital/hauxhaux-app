import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Histórico — Portal Parceiro' }

export default async function PortalHistoricoPage() {
    const session = await auth()
    if (!session) redirect('/login')

    const userId = (session.user as { id: string }).id
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { parceiroId: true },
    })
    if (!user?.parceiroId) redirect('/portal')
    const parceiroId = user.parceiroId

    const [remessas, devolucoes, fechamentos] = await Promise.all([
        prisma.remessaConsignacao.findMany({
            where: { parceiroId },
            orderBy: { dataEnvio: 'desc' },
            take: 30,
            include: {
                itens: { include: { produto: { select: { nome: true, unidadeMedida: true } } } },
            },
        }),
        prisma.devolucaoConsignacao.findMany({
            where: { parceiroId },
            orderBy: { dataDevolucao: 'desc' },
            take: 30,
            include: {
                itens: { include: { produto: { select: { nome: true, unidadeMedida: true } } } },
            },
        }),
        prisma.fechamento.findMany({
            where: { parceiroId },
            orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
            include: {
                itens: { 
                    where: { excluido: false },
                    include: { produto: { select: { nome: true, unidadeMedida: true } } },
                    orderBy: { dataVenda: 'asc' },
                },
                contasReceber: { select: { status: true, valorTotal: true, saldoAberto: true } },
            },
        }),
    ])

    const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    const statusFechamentoBadge: Record<string, string> = {
        ABERTO: 'badge-warning', EM_VALIDACAO: 'badge-info', FECHADO: 'badge-success', CANCELADO: 'badge-danger',
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Histórico</h1>
                    <p className="page-header-sub">Declarações de consumo, remessas, devoluções e fechamentos</p>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

                {/* Fechamentos */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📅 Fechamentos Mensais</h3>
                    </div>
                    <div className="table-wrapper">
                        {fechamentos.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                <div className="empty-state-desc">Nenhum fechamento registrado</div>
                            </div>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Competência</th>
                                        <th>Status</th>
                                        <th>Total Vendas</th>
                                        <th>Repasse (Líquido)</th>
                                        <th>Cobrança</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fechamentos.map((f) => {
                                        const conta = f.contasReceber[0]
                                        return (
                                            <tr key={f.id}>
                                                <td className="font-medium">{meses[f.competenciaMes]}/{f.competenciaAno}</td>
                                                <td><span className={`badge ${statusFechamentoBadge[f.status] ?? 'badge-neutral'}`}>{f.status}</span></td>
                                                <td className="font-medium">
                                                    {f.totalValor ? `R$ ${Number(f.totalValor).toFixed(2)}` : '—'}
                                                </td>
                                                <td className="font-medium" style={{ color: 'var(--color-accent)' }}>
                                                    {f.itens.length > 0 ? `R$ ${f.itens.reduce((s, i) => s + Number((i as any).valorRepasse || 0), 0).toFixed(2)}` : '—'}
                                                </td>
                                                <td>
                                                    {conta ? (
                                                        <div>
                                                            <span className={`badge ${conta.status === 'RECEBIDO' ? 'badge-success' : 'badge-warning'}`}>
                                                                {conta.status.replace(/_/g, ' ')}
                                                            </span>
                                                            {Number(conta.saldoAberto) > 0 && (
                                                                <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
                                                                    R$ {Number(conta.saldoAberto).toFixed(2)} em aberto
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : <span className="text-muted text-sm">—</span>}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="grid grid-2" style={{ gap: 'var(--space-5)' }}>
                    {/* Remessas recebidas */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">🚚 Remessas Recebidas</h3>
                        </div>
                        <div className="table-wrapper">
                            {remessas.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                    <div className="empty-state-desc">Nenhuma remessa recebida</div>
                                </div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Data</th><th>Produtos</th></tr></thead>
                                    <tbody>
                                        {remessas.map((r) => (
                                            <tr key={r.id}>
                                                <td className="text-sm">{new Date(r.dataEnvio).toLocaleDateString('pt-BR')}</td>
                                                <td>
                                                    <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
                                                        {r.itens.map((it, i) => (
                                                            <div key={i}>• {it.produto.nome}: {Number(it.quantidade).toFixed(3)} {it.produto.unidadeMedida}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Devoluções */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">↩️ Devoluções</h3>
                        </div>
                        <div className="table-wrapper">
                            {devolucoes.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                    <div className="empty-state-desc">Nenhuma devolução registrada</div>
                                </div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Data</th><th>Produtos</th></tr></thead>
                                    <tbody>
                                        {devolucoes.map((d) => (
                                            <tr key={d.id}>
                                                <td className="text-sm">{new Date(d.dataDevolucao).toLocaleDateString('pt-BR')}</td>
                                                <td>
                                                    <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
                                                        {d.itens.map((it, i) => (
                                                            <div key={i}>• {it.produto.nome}: {Number(it.quantidade).toFixed(3)} {it.produto.unidadeMedida}</div>
                                                        ))}
                                                    </div>
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
