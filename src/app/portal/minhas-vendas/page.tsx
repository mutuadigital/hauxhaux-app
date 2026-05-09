'use client'

import { useState, useEffect, useCallback } from 'react'

type VendaItem = {
    id: string
    produto: { nome: string; unidadeMedida: string }
    quantidadeConsumida: number
    valorUnitario: number
    valorTotal: number
    dataVenda: string | null
    excluido: boolean
}

type MesOpcao = { mes: number; ano: number; label: string }

const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function gerarMeses(): MesOpcao[] {
    const opts: MesOpcao[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        opts.push({ mes: d.getMonth() + 1, ano: d.getFullYear(), label: `${mesesNomes[d.getMonth()]}/${d.getFullYear()}` })
    }
    return opts
}

export default function MinhasVendasPage() {
    const now = new Date()
    const meses = gerarMeses()
    const [mesSel, setMesSel] = useState({ mes: now.getMonth() + 1, ano: now.getFullYear() })
    const [mostrarExcluidas, setMostrarExcluidas] = useState(false)
    const [itens, setItens] = useState<VendaItem[]>([])
    const [totalValor, setTotalValor] = useState(0)
    const [loading, setLoading] = useState(true)
    const [editando, setEditando] = useState<VendaItem | null>(null)
    const [editForm, setEditForm] = useState({ quantidade: '', dataVenda: '' })
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const r = await fetch(`/api/portal/minhas-vendas?mes=${mesSel.mes}&ano=${mesSel.ano}&excluidas=${mostrarExcluidas}`)
        const data = await r.json()
        setItens(data.itens ?? [])
        setTotalValor(Number(data.totalValor ?? 0))
        setLoading(false)
    }, [mesSel, mostrarExcluidas])

    useEffect(() => { load() }, [load])

    function openEdit(v: VendaItem) {
        setEditando(v)
        setEditForm({
            quantidade: String(Math.round(Number(v.quantidadeConsumida))),
            dataVenda: v.dataVenda ? v.dataVenda.split('T')[0] : new Date().toISOString().split('T')[0],
        })
    }

    async function salvarEdicao() {
        if (!editando) return
        setSaving(true)
        await fetch(`/api/portal/minhas-vendas/${editando.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantidade: parseInt(editForm.quantidade), dataVenda: editForm.dataVenda }),
        })
        setSaving(false)
        setEditando(null)
        load()
    }

    async function excluir(id: string) {
        if (!confirm('Excluir esta venda? O estoque será devolvido.')) return
        await fetch(`/api/portal/minhas-vendas/${id}`, { method: 'DELETE' })
        load()
    }

    const totalItens = itens.reduce((s, i) => s + Number(i.valorTotal), 0)

    return (
        <div className="anim-fade-in">
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-marrom)', margin: 0, lineHeight: 1.1 }}>
                    Minhas Vendas
                </h1>
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                    Histórico de vendas por mês — edite ou exclua registros
                </p>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
                <select
                    className="form-control"
                    style={{ width: 160 }}
                    value={`${mesSel.mes}-${mesSel.ano}`}
                    onChange={e => {
                        const [m, a] = e.target.value.split('-').map(Number)
                        setMesSel({ mes: m, ano: a })
                    }}
                >
                    {meses.map(m => (
                        <option key={`${m.mes}-${m.ano}`} value={`${m.mes}-${m.ano}`}>{m.label}</option>
                    ))}
                </select>

                <button
                    className={`btn ${mostrarExcluidas ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                    onClick={() => setMostrarExcluidas(v => !v)}
                >
                    {mostrarExcluidas ? '👁 Ver Ativas' : '🗑 Ver Excluídas'}
                </button>

                <div style={{ marginLeft: 'auto' }}>
                    <a href="/portal/vendas" className="btn btn-primary btn-sm">+ Nova Venda</a>
                </div>
            </div>

            {/* KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Vendas no mês</div>
                    <div className="kpi-value">{itens.length}</div>
                    <div className="kpi-sub">{mostrarExcluidas ? 'excluídas' : 'registros ativos'}</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Total do mês</div>
                    <div className="kpi-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-accent)' }}>R$ {totalItens.toFixed(2)}</div>
                    <div className="kpi-sub">valor acumulado</div>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="spinner" /></div>
                    ) : itens.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                            <div className="empty-state-icon">🛍️</div>
                            <div className="empty-state-title">
                                {mostrarExcluidas ? 'Nenhuma venda excluída neste mês' : 'Nenhuma venda registrada neste mês'}
                            </div>
                            {!mostrarExcluidas && (
                                <a href="/portal/vendas" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>+ Registrar Venda</a>
                            )}
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Produto</th>
                                    <th>Qtd.</th>
                                    <th>Preço Unit.</th>
                                    <th>Total</th>
                                    {!mostrarExcluidas && <th style={{ width: 90 }}>Ações</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {itens.map(v => (
                                    <tr key={v.id} style={v.excluido ? { opacity: 0.5 } : {}}>
                                        <td className="text-sm">
                                            {v.dataVenda ? new Date(v.dataVenda).toLocaleDateString('pt-BR') : '—'}
                                        </td>
                                        <td className="font-medium">{v.produto.nome}</td>
                                        <td>{Math.round(Number(v.quantidadeConsumida))} {v.produto.unidadeMedida}</td>
                                        <td className="text-sm">R$ {Number(v.valorUnitario).toFixed(2)}</td>
                                        <td className="font-medium" style={{ color: 'var(--color-accent)' }}>
                                            R$ {Number(v.valorTotal).toFixed(2)}
                                        </td>
                                        {!mostrarExcluidas && (
                                            <td>
                                                <div className="table-actions">
                                                    <button className="btn-icon" title="Editar" onClick={() => openEdit(v)}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                    </button>
                                                    <button className="btn-icon" title="Excluir" style={{ color: 'var(--color-danger)' }} onClick={() => excluir(v.id)}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                <tr style={{ background: 'rgba(197,160,89,0.07)', fontWeight: 700 }}>
                                    <td colSpan={4} style={{ textAlign: 'right', paddingRight: 'var(--space-4)' }}>Total</td>
                                    <td style={{ color: 'var(--color-accent)' }}>R$ {totalItens.toFixed(2)}</td>
                                    {!mostrarExcluidas && <td />}
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Edit modal */}
            {editando && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditando(null)}>
                    <div className="modal" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Editar Venda</h2>
                            <button className="btn-icon" onClick={() => setEditando(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ padding: 'var(--space-3)', background: 'rgba(197,160,89,0.08)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                                <strong>{editando.produto.nome}</strong> — R$ {Number(editando.valorUnitario).toFixed(2)} / {editando.produto.unidadeMedida}
                            </div>
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Quantidade</label>
                                    <input className="form-control" type="number" min="1" value={editForm.quantidade}
                                        onChange={e => setEditForm(f => ({ ...f, quantidade: e.target.value }))} autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Data da venda</label>
                                    <input className="form-control" type="date" value={editForm.dataVenda}
                                        onChange={e => setEditForm(f => ({ ...f, dataVenda: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={salvarEdicao} disabled={saving || !editForm.quantidade}>
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
