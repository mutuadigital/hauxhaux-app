import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Meu Estoque — Portal Parceiro' }

export default async function PortalEstoquePage() {
    const session = await auth()
    if (!session) redirect('/login')

    const userId = (session.user as { id: string }).id
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { parceiroId: true },
    })
    if (!user?.parceiroId) redirect('/portal')
    const parceiroId = user.parceiroId

    const itens = await prisma.estoqueConsignado.findMany({
        where: { parceiroId },
        include: {
            produto: {
                select: { nome: true, unidadeMedida: true, precoPadrao: true, estoqueMinimo: true, codigo: true },
            },
        },
        orderBy: { produto: { nome: 'asc' } },
    })

    const totalPecas = itens.reduce((s, i) => s + Number(i.quantidadeAtual), 0)
    const totalValor = itens.reduce((s, i) => s + Number(i.quantidadeAtual) * Number(i.produto.precoPadrao), 0)

    return (
        <div className="anim-fade-in">
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-marrom)', margin: 0, lineHeight: 1.1 }}>
                    Meu Estoque
                </h1>
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                    Produtos consignados disponíveis para venda
                </p>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Total de peças</div>
                    <div className="kpi-value">{totalPecas.toFixed(0)}</div>
                    <div className="kpi-sub">unidades em estoque</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Valor total (preço venda)</div>
                    <div className="kpi-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-accent)' }}>
                        R$ {totalValor.toFixed(2)}
                    </div>
                    <div className="kpi-sub">valor de referência</div>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {itens.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                            <div className="empty-state-icon">📦</div>
                            <div className="empty-state-title">Nenhum produto consignado</div>
                            <div className="empty-state-desc">
                                Aguarde o envio de remessas pela HauxHaux.
                            </div>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Produto</th>
                                    <th>Quantidade</th>
                                    <th>Preço Venda</th>
                                    <th>Valor Total</th>
                                    <th>Situação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {itens.map((item) => {
                                    const qtd = Number(item.quantidadeAtual)
                                    const preco = Number(item.produto.precoPadrao)
                                    const total = qtd * preco
                                    const semEstoque = qtd <= 0
                                    const baixoEstoque = !semEstoque && qtd < Number(item.produto.estoqueMinimo ?? 1)

                                    return (
                                        <tr key={item.id}>
                                            <td className="text-sm text-muted">{item.produto.codigo}</td>
                                            <td className="font-medium">{item.produto.nome}</td>
                                            <td>
                                                <span style={{
                                                    fontWeight: 700,
                                                    color: semEstoque
                                                        ? 'var(--color-danger)'
                                                        : baixoEstoque
                                                            ? 'var(--color-warning)'
                                                            : 'var(--color-success)'
                                                }}>
                                                    {qtd.toFixed(0)} {item.produto.unidadeMedida}
                                                </span>
                                            </td>
                                            <td className="text-sm">R$ {preco.toFixed(2)}</td>
                                            <td className="font-medium" style={{ color: 'var(--color-accent)' }}>
                                                R$ {total.toFixed(2)}
                                            </td>
                                            <td>
                                                {semEstoque ? (
                                                    <span className="badge badge-danger">Sem estoque</span>
                                                ) : baixoEstoque ? (
                                                    <span className="badge badge-warning">Estoque baixo</span>
                                                ) : (
                                                    <span className="badge badge-success">Disponível</span>
                                                )}
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
    )
}
