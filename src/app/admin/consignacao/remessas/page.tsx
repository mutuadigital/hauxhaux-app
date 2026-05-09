'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import { Stepper } from '@/components/Stepper'

type Parceiro = { id: string; nome: string }
type Produto = { id: string; nome: string; unidadeMedida: string; precoPadrao?: number }
type RemessaItem = { produtoId: string; quantidade: number; valorReferencia: string }
type Remessa = {
    id: string
    parceiro: { nome: string }
    dataEnvio: string
    status: string
    itens: { produto: { nome: string; unidadeMedida: string }; quantidade: number; valorReferencia?: number | null }[]
}

export default function RemessasPage() {
    const [remessas, setRemessas] = useState<Remessa[]>([])
    const [parceiros, setParceiros] = useState<Parceiro[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [form, setForm] = useState({ parceiroId: '', dataEnvio: new Date().toISOString().split('T')[0], observacoes: '' })
    const [itens, setItens] = useState<RemessaItem[]>([{ produtoId: '', quantidade: 1, valorReferencia: '' }])
    const [editando, setEditando] = useState<Remessa | null>(null)
    const [editForm, setEditForm] = useState({ dataEnvio: '', observacoes: '' })
    const [editSaving, setEditSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2, r3] = await Promise.all([
            fetch('/api/consignacao/remessas'),
            fetch('/api/parceiros'),
            fetch('/api/produtos'),
        ])
        setRemessas(await r1.json())
        const ps = await r2.json(); setParceiros(ps.filter((p: Parceiro & { status: string }) => p.status === 'ATIVO'))
        setProdutos(await r3.json())
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    function addItem() { setItens(i => [...i, { produtoId: '', quantidade: 1, valorReferencia: '' }]) }
    function removeItem(idx: number) { setItens(i => i.filter((_, j) => j !== idx)) }
    function updateItem(idx: number, field: keyof RemessaItem, value: string | number) {
        setItens(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n })
    }
    function produtoPrecoRef(produtoId: string) {
        const p = produtos.find(p => p.id === produtoId)
        return p?.precoPadrao ? String(p.precoPadrao) : ''
    }

    async function save() {
        setSaving(true)
        const payload = {
            ...form,
            itens: itens.filter(i => i.produtoId && Number(i.quantidade) > 0).map(i => ({
                produtoId: i.produtoId,
                quantidade: Number(i.quantidade),
                valorReferencia: parseFloat(i.valorReferencia) || null,
            })),
        }
        await fetch('/api/consignacao/remessas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        setSaving(false); setShowModal(false); load()
    }

    async function salvarEdicao() {
        if (!editando) return
        setEditSaving(true)
        await fetch(`/api/consignacao/remessas/${editando.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataEnvio: editForm.dataEnvio, observacoes: editForm.observacoes || null }),
        })
        setEditSaving(false)
        setEditando(null)
        load()
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Remessas em Consignação</h1>
                    <p className="page-header-sub">Envio de produtos para parceiros — baixa automática do estoque interno</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => { setForm({ parceiroId: '', dataEnvio: new Date().toISOString().split('T')[0], observacoes: '' }); setItens([{ produtoId: '', quantidade: 1, valorReferencia: '' }]); setShowModal(true) }} id="btn-nova-remessa">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nova Remessa
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : remessas.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">🚚</div><div className="empty-state-title">Nenhuma remessa registrada</div></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Parceiro</th><th>Data</th><th>Itens</th><th>Status</th><th style={{ width: 40 }}></th></tr></thead>
                            <tbody>
                                {remessas.map((r) => (
                                    <Fragment key={r.id}>
                                        <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                                            <td className="font-medium">{r.parceiro.nome}</td>
                                            <td className="text-sm">{new Date(r.dataEnvio).toLocaleDateString('pt-BR')}</td>
                                            <td><span className="badge badge-neutral">{r.itens.length} produto(s)</span></td>
                                            <td><span className={`badge ${r.status === 'CONFIRMADA' ? 'badge-success' : r.status === 'CANCELADA' ? 'badge-danger' : 'badge-warning'}`}>{r.status}</span></td>
                                            <td onClick={e => e.stopPropagation()}>
                                                <div className="table-actions">
                                                    <span className="text-muted text-sm">{expandedId === r.id ? '▲' : '▼'}</span>
                                                    <button className="btn-icon" title="Editar" onClick={() => { setEditando(r); setEditForm({ dataEnvio: new Date(r.dataEnvio).toISOString().split('T')[0], observacoes: '' }) }}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedId === r.id && (
                                            <tr key={`${r.id}-d`}>
                                                <td colSpan={5} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                                                    <table className="table" style={{ margin: 0 }}>
                                                        <thead><tr><th style={{ paddingLeft: 48 }}>Produto</th><th>Qtd.</th><th>Vlr. Ref.</th></tr></thead>
                                                        <tbody>
                                                            {r.itens.map((it, i) => (
                                                                <tr key={i}>
                                                                    <td style={{ paddingLeft: 48 }}>{it.produto.nome} <span className="text-muted text-xs">({it.produto.unidadeMedida})</span></td>
                                                                    <td className="font-medium">{Number(it.quantidade).toFixed(3)}</td>
                                                                    <td>{it.valorReferencia ? `R$ ${Number(it.valorReferencia).toFixed(2)}` : '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal modal-xl" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Nova Remessa</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Parceiro</label>
                                    <select className="form-control" value={form.parceiroId} onChange={e => setForm(f => ({ ...f, parceiroId: e.target.value }))} autoFocus>
                                        <option value="">Selecionar parceiro…</option>
                                        {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Data do envio</label>
                                    <input className="form-control" type="date" value={form.dataEnvio} onChange={e => setForm(f => ({ ...f, dataEnvio: e.target.value }))} />
                                </div>
                            </div>
                            <hr className="divider" />
                            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-3)' }}>
                                <strong style={{ fontSize: 'var(--text-sm)' }}>Produtos a enviar</strong>
                                <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add produto</button>
                            </div>
                            {itens.map((item, idx) => {
                                const prod = produtos.find(p => p.id === item.produtoId)
                                return (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr auto 1fr auto', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', alignItems: 'start' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            {idx === 0 && <label className="form-label required">Produto</label>}
                                            <select className="form-control" value={item.produtoId} onChange={e => {
                                                const id = e.target.value
                                                const p = produtos.find(x => x.id === id)
                                                updateItem(idx, 'produtoId', id)
                                                if (p?.precoPadrao) updateItem(idx, 'valorReferencia', String(p.precoPadrao))
                                            }}>
                                                <option value="">Selecionar…</option>
                                                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.unidadeMedida})</option>)}
                                            </select>
                                        </div>
                                        <div style={{ margin: 0 }}>
                                            {idx === 0 && <label className="form-label required" style={{ display: 'block', marginBottom: 6 }}>Quantidade</label>}
                                            <Stepper
                                                value={Number(item.quantidade) || 1}
                                                onChange={v => updateItem(idx, 'quantidade', String(v))}
                                                min={1}
                                                disabled={!item.produtoId}
                                            />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            {idx === 0 && <label className="form-label">Vlr. Ref. (R$)</label>}
                                            <input className="form-control" type="number" step="0.01" value={item.valorReferencia} onChange={e => updateItem(idx, 'valorReferencia', e.target.value)} placeholder={prod?.precoPadrao ? String(prod.precoPadrao) : '0.00'} />
                                        </div>
                                        {itens.length > 1 ? (
                                            <button className="btn-icon" style={{ color: 'var(--color-danger)', marginTop: idx === 0 ? 22 : 0 }} onClick={() => removeItem(idx)}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                            </button>
                                        ) : <div />}
                                    </div>
                                )
                            })}
                            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                                <label className="form-label">Observações</label>
                                <textarea className="form-control" rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.parceiroId} id="btn-salvar-remessa">
                                {saving ? 'Registrando...' : '🚚 Registrar Remessa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editando && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditando(null)}>
                    <div className="modal" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Editar Remessa</h2>
                            <button className="btn-icon" onClick={() => setEditando(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ padding: 'var(--space-3)', background: 'rgba(197,160,89,0.08)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                                <strong>{editando.parceiro.nome}</strong> · {editando.itens.length} produto(s)
                            </div>
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Data de envio</label>
                                    <input className="form-control" type="date" value={editForm.dataEnvio}
                                        onChange={e => setEditForm(f => ({ ...f, dataEnvio: e.target.value }))} autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <input className="form-control" value={editForm.observacoes}
                                        onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))}
                                        placeholder="Opcional" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={salvarEdicao} disabled={editSaving || !editForm.dataEnvio}>
                                {editSaving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
