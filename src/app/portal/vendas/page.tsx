'use client'

import { useState, useEffect, useCallback } from 'react'

type EstoqueItem = {
    id: string
    quantidadeAtual: number
    valorVenda: number  // locked from remessa
    produto: { id: string; nome: string; unidadeMedida: string; precoPadrao: number }
}
type VendaItem = {
    id: string
    produto: { nome: string; unidadeMedida: string }
    quantidadeConsumida: number
    valorUnitarioRef?: number | null
}

function Stepper({ value, onChange, min = 0, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden', width: 'fit-content' }}>
            <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
                style={{ width: 48, height: 48, fontSize: 'var(--text-2xl)', fontWeight: 700, background: 'var(--color-bg-card)', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}
                disabled={value <= min}>−</button>
            <div style={{ minWidth: 56, textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-xl)', padding: '0 var(--space-2)' }}>{value}</div>
            <button type="button" onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
                style={{ width: 48, height: 48, fontSize: 'var(--text-2xl)', fontWeight: 700, background: 'var(--color-bg-card)', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}
                disabled={max !== undefined && value >= max}>+</button>
        </div>
    )
}

export default function PortalVendasPage() {
    const [estoque, setEstoque] = useState<EstoqueItem[]>([])
    const [vendas, setVendas] = useState<VendaItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [produtoId, setProdutoId] = useState('')
    const [quantidade, setQuantidade] = useState(1)
    const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0])
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2] = await Promise.all([fetch('/api/portal/estoque'), fetch('/api/portal/vendas')])
        const est = await r1.json()
        setEstoque(est)
        setVendas(await r2.json())
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const selectedProduto = estoque.find(e => e.produto.id === produtoId)
    const saldoDisponivel = selectedProduto ? Math.floor(Number(selectedProduto.quantidadeAtual)) : 0
    const valorVenda = selectedProduto ? Number(selectedProduto.valorVenda) : 0
    const subtotal = quantidade * valorVenda

    async function registrarVenda() {
        if (!produtoId || quantidade <= 0) return
        setSaving(true)
        setFeedback(null)
        const res = await fetch('/api/portal/vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ produtoId, quantidade, dataVenda }),
        })
        setSaving(false)
        if (!res.ok) {
            const e = await res.json()
            setFeedback({ type: 'error', msg: e.error || 'Erro ao registrar venda' })
            return
        }
        setFeedback({ type: 'success', msg: `Venda de ${quantidade} ${selectedProduto?.produto.unidadeMedida} de ${selectedProduto?.produto.nome} registrada!` })
        setProdutoId('')
        setQuantidade(1)
        load()
    }

    const totalVendido = vendas.reduce((s, v) => s + Number(v.quantidadeConsumida) * Number(v.valorUnitarioRef ?? 0), 0)

    return (
        <div className="anim-fade-in">
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--color-marrom)', margin: 0, lineHeight: 1.1 }}>Registrar Venda</h1>
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                    Registre cada venda do estoque consignado — acumula para o fechamento mensal
                </p>
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--space-6)', alignItems: 'start' }}>

                {/* POS card */}
                <div className="card" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                    <div className="card-header" style={{ borderBottom: '2px solid var(--color-accent)', paddingBottom: 'var(--space-4)' }}>
                        <h3 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>🛒 Nova Venda</h3>
                    </div>
                    <div className="card-body" style={{ padding: 'var(--space-6)' }}>
                        {feedback && (
                            <div className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: 'var(--space-5)' }}>
                                {feedback.type === 'success' ? '✅' : '❌'} {feedback.msg}
                            </div>
                        )}

                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                                <label className="form-label required" style={{ fontSize: 'var(--text-base)' }}>Data da venda</label>
                                <input
                                    className="form-control"
                                    type="date"
                                    value={dataVenda}
                                    onChange={e => setDataVenda(e.target.value)}
                                    style={{ fontSize: 'var(--text-base)', height: 48 }}
                                />
                            </div>

                        <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                            <label className="form-label required" style={{ fontSize: 'var(--text-base)' }}>Produto</label>
                            {loading ? <div className="form-control" style={{ color: 'var(--color-text-muted)' }}>Carregando…</div> : (
                                <select className="form-control" style={{ fontSize: 'var(--text-base)', height: 48 }} value={produtoId}
                                    onChange={e => { setProdutoId(e.target.value); setQuantidade(1); setFeedback(null) }} autoFocus>
                                    <option value="">Selecionar produto…</option>
                                    {estoque.map(e => (
                                        <option key={e.produto.id} value={e.produto.id}>
                                            {e.produto.nome} — saldo: {Math.floor(Number(e.quantidadeAtual))} {e.produto.unidadeMedida}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {selectedProduto && (
                            <>
                                {/* Stock indicator */}
                                <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(197,160,89,0.07)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="text-sm text-muted">Saldo disponível</span>
                                    <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: saldoDisponivel > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        {saldoDisponivel} {selectedProduto.produto.unidadeMedida}
                                    </span>
                                </div>

                                <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                                    <label className="form-label required" style={{ fontSize: 'var(--text-base)' }}>Quantidade</label>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-2)' }}>
                                        <Stepper value={quantidade} onChange={setQuantidade} min={1} max={saldoDisponivel} />
                                    </div>
                                </div>

                                {/* Price (locked from remessa — read only) */}
                                <div style={{ padding: 'var(--space-4)', background: 'rgba(197,160,89,0.1)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-5)', border: '1px solid rgba(197,160,89,0.25)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                        <div>
                                            <div className="text-xs text-muted">Preço de venda</div>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>R$ {valorVenda.toFixed(2)}</div>
                                            <div className="text-xs" style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>Definido na remessa • não editável</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="text-xs text-muted">Total da venda</div>
                                            <div style={{ fontWeight: 800, fontSize: 'var(--text-2xl)', color: 'var(--color-accent)' }}>
                                                R$ {subtotal.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', height: 52, fontSize: 'var(--text-base)', fontWeight: 700 }}
                            onClick={registrarVenda}
                            disabled={saving || !produtoId || quantidade <= 0 || quantidade > saldoDisponivel}
                            id="btn-registrar-venda"
                        >
                            {saving ? 'Registrando…' : '✅ Confirmar Venda'}
                        </button>
                    </div>
                </div>

                {/* Right column */}
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                        <div className="kpi-card" style={{ textAlign: 'center' }}>
                            <div className="kpi-label">Vendas este mês</div>
                            <div className="kpi-value">{vendas.length}</div>
                            <div className="kpi-sub">produto(s) vendidos</div>
                        </div>
                        <div className="kpi-card" style={{ textAlign: 'center' }}>
                            <div className="kpi-label">Total acumulado</div>
                            <div className="kpi-value" style={{ fontSize: 'var(--text-xl)' }}>R$ {totalVendido.toFixed(2)}</div>
                            <div className="kpi-sub">a ser fechado no mês</div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header"><h3 className="card-title">📋 Vendas do mês atual</h3></div>
                        <div className="table-wrapper">
                            {loading ? <div className="loading-center"><div className="spinner" /></div> : vendas.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                    <div className="empty-state-icon">🛍️</div>
                                    <div className="empty-state-title">Nenhuma venda registrada</div>
                                    <div className="empty-state-desc">Use o formulário ao lado para registrar suas vendas</div>
                                </div>
                            ) : (
                                <table className="table">
                                    <thead><tr><th>Produto</th><th>Qtd.</th><th>Preço Unit.</th><th>Total</th></tr></thead>
                                    <tbody>
                                        {vendas.map(v => (
                                            <tr key={v.id}>
                                                <td className="font-medium">{v.produto.nome}</td>
                                                <td>{Math.round(Number(v.quantidadeConsumida))} {v.produto.unidadeMedida}</td>
                                                <td className="text-sm">R$ {Number(v.valorUnitarioRef ?? 0).toFixed(2)}</td>
                                                <td className="font-medium" style={{ color: 'var(--color-accent)' }}>
                                                    R$ {(Number(v.quantidadeConsumida) * Number(v.valorUnitarioRef ?? 0)).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr style={{ background: 'rgba(197,160,89,0.06)', fontWeight: 700 }}>
                                            <td colSpan={3} style={{ textAlign: 'right', paddingRight: 'var(--space-4)' }}>Total</td>
                                            <td style={{ color: 'var(--color-accent)' }}>R$ {totalVendido.toFixed(2)}</td>
                                        </tr>
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
