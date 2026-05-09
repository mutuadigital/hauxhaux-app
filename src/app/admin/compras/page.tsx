'use client'

import { useState, useEffect, useCallback } from 'react'
import { Stepper } from '@/components/Stepper'

type Insumo = { id: string; nome: string; unidadeMedida: string; estoque?: { quantidadeAtual: number } | null }
type CompraItem = { insumoId: string; nome: string; unidade: string; quantidade: number; valorUnit: string; valorTotal: number }
type Compra = {
    id: string
    fornecedorNome: string
    dataCompra: string
    documentoRef?: string | null
    valorTotal: number
    itens: { insumo: { nome: string; unidadeMedida: string }; quantidade: number; valorUnit: number; valorTotal: number }[]
}

export default function ComprasPage() {
    const [compras, setCompras] = useState<Compra[]>([])
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [form, setForm] = useState({ fornecedorNome: '', dataCompra: new Date().toISOString().split('T')[0], documentoRef: '', observacoes: '' })
    const [itens, setItens] = useState<CompraItem[]>([{ insumoId: '', nome: '', unidade: '', quantidade: 1, valorUnit: '', valorTotal: 0 }])

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2] = await Promise.all([fetch('/api/compras'), fetch('/api/insumos')])
        setCompras(await r1.json())
        setInsumos(await r2.json())
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function removeCompra(id: string) {
        if (!confirm('Excluir esta compra? Esta ação não pode ser desfeita.')) return
        await fetch(`/api/compras/${id}`, { method: 'DELETE' })
        load()
    }

    function addItem() {
        setItens(i => [...i, { insumoId: '', nome: '', unidade: '', quantidade: 1, valorUnit: '', valorTotal: 0 }])
    }
    function removeItem(idx: number) {
        setItens(i => i.filter((_, j) => j !== idx))
    }
    function updateItem(idx: number, field: keyof CompraItem, value: string | number) {
        setItens(prev => {
            const n = [...prev]
            if (field === 'insumoId') {
                const ins = insumos.find(i => i.id === value)
                n[idx] = { ...n[idx], insumoId: String(value), nome: ins?.nome ?? '', unidade: ins?.unidadeMedida ?? '' }
            } else {
                n[idx] = { ...n[idx], [field]: value }
            }
            const q = Number(n[idx].quantidade) || 0
            const v = parseFloat(String(n[idx].valorUnit)) || 0
            n[idx].valorTotal = q * v
            return n
        })
    }

    const totalGeral = itens.reduce((s, i) => s + i.valorTotal, 0)

    async function save() {
        setSaving(true)
        const payload = {
            ...form,
            itens: itens.filter(i => i.insumoId && Number(i.quantidade) > 0).map(i => ({
                insumoId: i.insumoId,
                quantidade: Number(i.quantidade),
                valorUnit: parseFloat(i.valorUnit) || 0,
                valorTotal: i.valorTotal,
            })),
        }
        await fetch('/api/compras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        setSaving(false); setShowModal(false); load()
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Compras</h1>
                    <p className="page-header-sub">Registro de compras de insumos — dá entrada automática no estoque</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => { setForm({ fornecedorNome: '', dataCompra: new Date().toISOString().split('T')[0], documentoRef: '', observacoes: '' }); setItens([{ insumoId: '', nome: '', unidade: '', quantidade: 1, valorUnit: '', valorTotal: 0 }]); setShowModal(true) }} id="btn-nova-compra">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nova Compra
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : compras.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">🛒</div><div className="empty-state-title">Nenhuma compra registrada</div></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Data</th><th>Fornecedor</th><th>Nº Doc</th><th>Itens</th><th>Total</th><th style={{ width: 60 }}></th></tr></thead>
                            <tbody>
                                {compras.map((c) => (
                                    <>
                                        <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                                            <td className="text-sm">{new Date(c.dataCompra).toLocaleDateString('pt-BR')}</td>
                                            <td className="font-medium">{c.fornecedorNome}</td>
                                            <td className="text-sm text-muted">{c.documentoRef || '—'}</td>
                                            <td><span className="badge badge-neutral">{c.itens.length} item(s)</span></td>
                                            <td className="font-medium text-accent">R$ {Number(c.valorTotal).toFixed(2)}</td>
                                            <td onClick={e => e.stopPropagation()}>
                                                <div className="table-actions">
                                                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginRight: 8 }}>{expandedId === c.id ? '▲' : '▼'}</span>
                                                    <button className="btn-icon" title="Excluir" onClick={() => removeCompra(c.id)} style={{ color: 'var(--color-danger)' }}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedId === c.id && (
                                            <tr key={`${c.id}-detail`}>
                                                <td colSpan={6} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                                                    <table className="table" style={{ margin: 0 }}>
                                                        <thead><tr><th style={{ paddingLeft: 48 }}>Insumo</th><th>Qtd.</th><th>Vlr. Unit.</th><th>Subtotal</th></tr></thead>
                                                        <tbody>
                                                            {c.itens.map((it, i) => (
                                                                <tr key={i}>
                                                                    <td style={{ paddingLeft: 48 }}>{it.insumo.nome} <span className="text-muted text-xs">({it.insumo.unidadeMedida})</span></td>
                                                                    <td>{Number(it.quantidade).toFixed(3)}</td>
                                                                    <td>R$ {Number(it.valorUnit).toFixed(4)}</td>
                                                                    <td className="font-medium">R$ {Number(it.valorTotal).toFixed(2)}</td>
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

            {showModal && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal modal-xl" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Nova Compra</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {/* Header info */}
                            <div className="form-grid form-grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Fornecedor</label>
                                    <input className="form-control" value={form.fornecedorNome} onChange={e => setForm(f => ({ ...f, fornecedorNome: e.target.value }))} placeholder="Nome do fornecedor" autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Data da compra</label>
                                    <input className="form-control" type="date" value={form.dataCompra} onChange={e => setForm(f => ({ ...f, dataCompra: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nº Documento</label>
                                    <input className="form-control" value={form.documentoRef} onChange={e => setForm(f => ({ ...f, documentoRef: e.target.value }))} placeholder="NF, recibo, etc." />
                                </div>
                            </div>

                            <hr className="divider" />
                            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-3)' }}>
                                <strong style={{ fontSize: 'var(--text-sm)' }}>Itens da compra</strong>
                                <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Adicionar item</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                {itens.map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr auto 1fr 1fr auto', gap: 'var(--space-3)', alignItems: 'start' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            {idx === 0 && <label className="form-label required">Insumo</label>}
                                            <select className="form-control" value={item.insumoId} onChange={e => updateItem(idx, 'insumoId', e.target.value)}>
                                                <option value="">Selecionar…</option>
                                                {insumos.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidadeMedida})</option>)}
                                            </select>
                                        </div>
                                        <div style={{ margin: 0 }}>
                                            {idx === 0 && <label className="form-label required" style={{ display: 'block', marginBottom: 6 }}>Quantidade</label>}
                                            <Stepper
                                                value={Number(item.quantidade) || 1}
                                                onChange={v => updateItem(idx, 'quantidade', String(v))}
                                                min={1}
                                                disabled={!item.insumoId}
                                            />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            {idx === 0 && <label className="form-label">Vlr. Unit. (R$)</label>}
                                            <input className="form-control" type="number" min="0" step="0.01" value={item.valorUnit} onChange={e => updateItem(idx, 'valorUnit', e.target.value)} placeholder="0.0000" />
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            {idx === 0 && <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--color-text-muted)', marginBottom: 8 }}>Subtotal</div>}
                                            <div style={{ padding: '0.55rem 0', fontWeight: 600, color: 'var(--color-accent)' }}>R$ {item.valorTotal.toFixed(2)}</div>
                                        </div>
                                        {itens.length > 1 && (
                                            <button className="btn-icon" style={{ color: 'var(--color-danger)', alignSelf: 'center', marginTop: idx === 0 ? 22 : 0 }} onClick={() => removeItem(idx)}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                            </button>
                                        )}
                                        {itens.length === 1 && <div />}
                                    </div>
                                ))}
                            </div>

                            <div style={{ textAlign: 'right', marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(197,160,89,0.08)', borderRadius: 'var(--radius)', border: '1px solid rgba(197,160,89,0.2)' }}>
                                <span className="text-muted text-sm">TOTAL GERAL: </span>
                                <span style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}>R$ {totalGeral.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.fornecedorNome || !form.dataCompra} id="btn-salvar-compra">
                                {saving ? 'Registrando...' : '✅ Registrar Compra'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
