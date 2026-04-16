'use client'

import { useState, useEffect, useCallback } from 'react'
import { Stepper } from '@/components/Stepper'

type Parceiro = { id: string; nome: string }
type Produto = { id: string; nome: string; unidadeMedida: string }
type Devolucao = {
    id: string
    parceiro: { nome: string }
    dataDevolucao: string
    status: string
    itens: { produto: { nome: string; unidadeMedida: string }; quantidade: number; observacaoCondicao?: string | null }[]
}

export default function DevolucoesPage() {
    const [devolucoes, setDevolucoes] = useState<Devolucao[]>([])
    const [parceiros, setParceiros] = useState<Parceiro[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [form, setForm] = useState({ parceiroId: '', dataDevolucao: new Date().toISOString().split('T')[0], observacoes: '' })
    const [itens, setItens] = useState([{ produtoId: '', quantidade: 1, observacaoCondicao: '' }])

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2, r3] = await Promise.all([fetch('/api/consignacao/devolucoes'), fetch('/api/parceiros'), fetch('/api/produtos')])
        setDevolucoes(await r1.json())
        const ps = await r2.json(); setParceiros(ps.filter((p: Parceiro & { status: string }) => p.status === 'ATIVO'))
        setProdutos(await r3.json())
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    function addItem() { setItens(i => [...i, { produtoId: '', quantidade: 1, observacaoCondicao: '' }]) }
    function removeItem(idx: number) { setItens(i => i.filter((_, j) => j !== idx)) }
    function updateItem(idx: number, field: string, value: string | number) {
        setItens(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n })
    }

    async function save() {
        setSaving(true)
        const payload = {
            ...form,
            itens: itens.filter(i => i.produtoId && Number(i.quantidade) > 0).map(i => ({
                produtoId: i.produtoId,
                quantidade: Number(i.quantidade),
                observacaoCondicao: i.observacaoCondicao || null,
            })),
        }
        await fetch('/api/consignacao/devolucoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        setSaving(false); setShowModal(false); load()
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Devoluções</h1>
                    <p className="page-header-sub">Retorno de produtos consignados — recoloca no estoque interno</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => { setForm({ parceiroId: '', dataDevolucao: new Date().toISOString().split('T')[0], observacoes: '' }); setItens([{ produtoId: '', quantidade: 1, observacaoCondicao: '' }]); setShowModal(true) }} id="btn-nova-devolucao">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nova Devolução
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : devolucoes.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">↩️</div><div className="empty-state-title">Nenhuma devolução registrada</div></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Parceiro</th><th>Data</th><th>Itens</th><th>Status</th><th style={{ width: 40 }}></th></tr></thead>
                            <tbody>
                                {devolucoes.map((d) => (
                                    <>
                                        <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                                            <td className="font-medium">{d.parceiro.nome}</td>
                                            <td className="text-sm">{new Date(d.dataDevolucao).toLocaleDateString('pt-BR')}</td>
                                            <td><span className="badge badge-neutral">{d.itens.length} produto(s)</span></td>
                                            <td><span className="badge badge-info">{d.status}</span></td>
                                            <td className="text-muted text-sm">{expandedId === d.id ? '▲' : '▼'}</td>
                                        </tr>
                                        {expandedId === d.id && (
                                            <tr key={`${d.id}-d`}>
                                                <td colSpan={5} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                                                    <table className="table" style={{ margin: 0 }}>
                                                        <thead><tr><th style={{ paddingLeft: 48 }}>Produto</th><th>Qtd.</th><th>Condição</th></tr></thead>
                                                        <tbody>
                                                            {d.itens.map((it, i) => (
                                                                <tr key={i}>
                                                                    <td style={{ paddingLeft: 48 }}>{it.produto.nome} <span className="text-muted text-xs">({it.produto.unidadeMedida})</span></td>
                                                                    <td className="font-medium">{Number(it.quantidade).toFixed(3)}</td>
                                                                    <td className="text-sm text-muted">{it.observacaoCondicao || '—'}</td>
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
                            <h2 className="modal-title">Nova Devolução</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Parceiro</label>
                                    <select className="form-control" value={form.parceiroId} onChange={e => setForm(f => ({ ...f, parceiroId: e.target.value }))} autoFocus>
                                        <option value="">Selecionar…</option>
                                        {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Data da devolução</label>
                                    <input className="form-control" type="date" value={form.dataDevolucao} onChange={e => setForm(f => ({ ...f, dataDevolucao: e.target.value }))} />
                                </div>
                            </div>
                            <hr className="divider" />
                            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-3)' }}>
                                <strong style={{ fontSize: 'var(--text-sm)' }}>Produtos devolvidos</strong>
                                <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add produto</button>
                            </div>
                            {itens.map((item, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr auto 2fr auto', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', alignItems: 'start' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        {idx === 0 && <label className="form-label required">Produto</label>}
                                        <select className="form-control" value={item.produtoId} onChange={e => updateItem(idx, 'produtoId', e.target.value)}>
                                            <option value="">Selecionar…</option>
                                            {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
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
                                        {idx === 0 && <label className="form-label">Condição</label>}
                                        <input className="form-control" value={item.observacaoCondicao} onChange={e => updateItem(idx, 'observacaoCondicao', e.target.value)} placeholder="Ex: bom estado, avariado…" />
                                    </div>
                                    {itens.length > 1 ? (
                                        <button className="btn-icon" style={{ color: 'var(--color-danger)', marginTop: idx === 0 ? 22 : 0 }} onClick={() => removeItem(idx)}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                        </button>
                                    ) : <div />}
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.parceiroId} id="btn-salvar-devolucao">
                                {saving ? 'Registrando...' : '↩️ Registrar Devolução'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
