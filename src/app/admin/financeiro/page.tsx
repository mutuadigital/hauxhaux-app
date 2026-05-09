'use client'

import { useState, useEffect, useCallback } from 'react'

type ContaReceber = {
    id: string
    parceiro: { nome: string }
    descricao: string
    dataEmissao: string
    dataVencimento?: string | null
    valorTotal: number
    valorRecebido: number
    saldoAberto: number
    status: string
    recebimentos: { id: string; dataRecebimento: string; valorRecebido: number; formaRecebimento?: string | null }[]
}

const statusBadge: Record<string, string> = {
    EM_ABERTO: 'badge-warning', PARCIAL: 'badge-info', RECEBIDO: 'badge-success', VENCIDO: 'badge-danger', CANCELADO: 'badge-neutral',
}

export default function FinanceiroPage() {
    const [contas, setContas] = useState<ContaReceber[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [showReceber, setShowReceber] = useState<ContaReceber | null>(null)
    const [saving, setSaving] = useState(false)
    const [recForm, setRecForm] = useState({ dataRecebimento: new Date().toISOString().split('T')[0], valorRecebido: '', formaRecebimento: '', observacoes: '' })

    const load = useCallback(async () => {
        setLoading(true)
        const r = await fetch('/api/financeiro/contas')
        setContas(await r.json())
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const totalAberto = contas.filter(c => c.status !== 'RECEBIDO' && c.status !== 'CANCELADO').reduce((s, c) => s + Number(c.saldoAberto), 0)
    const totalRecebido = contas.filter(c => c.status === 'RECEBIDO').reduce((s, c) => s + Number(c.valorTotal), 0)

    async function registrarRecebimento() {
        if (!showReceber) return
        setSaving(true)
        await fetch(`/api/financeiro/contas/${showReceber.id}/receber`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...recForm, valorRecebido: parseFloat(recForm.valorRecebido) }),
        })
        setSaving(false); setShowReceber(null); load()
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Contas a Receber</h1>
                    <p className="page-header-sub">Cobranças geradas pelos fechamentos mensais</p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="kpi-card">
                    <div className="kpi-label">Total em aberto</div>
                    <div className="kpi-value" style={{ color: totalAberto > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        R$ {totalAberto.toFixed(2)}
                    </div>
                    <div className="kpi-sub">{contas.filter(c => ['EM_ABERTO', 'PARCIAL', 'VENCIDO'].includes(c.status)).length} conta(s)</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Total recebido</div>
                    <div className="kpi-value" style={{ color: 'var(--color-success)' }}>R$ {totalRecebido.toFixed(2)}</div>
                    <div className="kpi-sub">{contas.filter(c => c.status === 'RECEBIDO').length} conta(s) quitada(s)</div>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : contas.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">💰</div><div className="empty-state-title">Nenhuma conta a receber</div></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Parceiro</th><th>Descrição</th><th>Emissão</th><th>Vencimento</th><th>Venda Total</th><th>Repasse (Líquido)</th><th>Saldo a Pagar</th><th>Status</th><th style={{ width: 80 }}>Ações</th></tr></thead>
                            <tbody>
                                {contas.map((c) => (
                                    <>
                                        <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                                            <td className="font-medium">{c.parceiro.nome}</td>
                                            <td className="text-sm">{c.descricao}</td>
                                            <td className="text-sm">{new Date(c.dataEmissao).toLocaleDateString('pt-BR')}</td>
                                            <td className="text-sm">{c.dataVencimento ? new Date(c.dataVencimento).toLocaleDateString('pt-BR') : <span className="text-muted">—</span>}</td>
                                            <td className="font-medium">R$ {Number(c.valorTotal).toFixed(2)}</td>
                                            <td className="font-medium" style={{ color: 'var(--color-info)' }}>R$ {Number((c as any).valorRepasse || c.valorTotal).toFixed(2)}</td>
                                            <td className="font-medium" style={{ color: Number(c.saldoAberto) > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                R$ {Number(c.saldoAberto).toFixed(2)}
                                            </td>
                                            <td><span className={`badge ${statusBadge[c.status] ?? 'badge-neutral'}`}>{c.status.replace(/_/g, ' ')}</span></td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <div className="table-actions">
                                                    {c.status !== 'RECEBIDO' && c.status !== 'CANCELADO' && (
                                                        <button className="btn btn-sm btn-primary" onClick={() => { setShowReceber(c); setRecForm({ dataRecebimento: new Date().toISOString().split('T')[0], valorRecebido: String(Number(c.saldoAberto).toFixed(2)), formaRecebimento: '', observacoes: '' }) }} id={`btn-receber-${c.id}`}>
                                                            Receber
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedId === c.id && c.recebimentos.length > 0 && (
                                            <tr key={`${c.id}-rec`}>
                                                <td colSpan={8} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                                                    <table className="table" style={{ margin: 0 }}>
                                                        <thead><tr><th style={{ paddingLeft: 48 }}>Data recebimento</th><th>Valor</th><th>Forma</th></tr></thead>
                                                        <tbody>
                                                            {c.recebimentos.map((r) => (
                                                                <tr key={r.id}>
                                                                    <td style={{ paddingLeft: 48 }}>{new Date(r.dataRecebimento).toLocaleDateString('pt-BR')}</td>
                                                                    <td className="font-medium" style={{ color: 'var(--color-success)' }}>R$ {Number(r.valorRecebido).toFixed(2)}</td>
                                                                    <td className="text-sm text-muted">{r.formaRecebimento || '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showReceber && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowReceber(null)}>
                    <div className="modal" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Registrar Recebimento</h2>
                            <button className="btn-icon" onClick={() => setShowReceber(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ padding: 'var(--space-3)', background: 'rgba(197,160,89,0.08)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-5)', fontSize: 'var(--text-sm)' }}>
                                <strong>{showReceber.parceiro.nome}</strong> — {showReceber.descricao}
                                <br />
                                <span className="text-muted">Saldo em aberto: </span>
                                <strong style={{ color: 'var(--color-danger)' }}>R$ {Number(showReceber.saldoAberto).toFixed(2)}</strong>
                            </div>
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Data do recebimento</label>
                                    <input className="form-control" type="date" value={recForm.dataRecebimento} onChange={e => setRecForm(f => ({ ...f, dataRecebimento: e.target.value }))} autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Valor recebido (R$)</label>
                                    <input className="form-control" type="number" step="1" value={recForm.valorRecebido} onChange={e => setRecForm(f => ({ ...f, valorRecebido: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Forma</label>
                                    <select className="form-control" value={recForm.formaRecebimento} onChange={e => setRecForm(f => ({ ...f, formaRecebimento: e.target.value }))}>
                                        <option value="">Não informado</option>
                                        <option>PIX</option>
                                        <option>Transferência</option>
                                        <option>Dinheiro</option>
                                        <option>Cartão</option>
                                        <option>Boleto</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <input className="form-control" value={recForm.observacoes} onChange={e => setRecForm(f => ({ ...f, observacoes: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowReceber(null)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={registrarRecebimento} disabled={saving || !recForm.valorRecebido} id="btn-confirmar-recebimento">
                                {saving ? 'Registrando...' : '💰 Confirmar Recebimento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
