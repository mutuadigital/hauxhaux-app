'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'

type Produto = { id: string; nome: string; unidadeMedida: string; composicoes?: { id: string; nomeVersao: string }[] }
type Insumo = { id: string; nome: string; unidadeMedida: string }
type ConsumoPrev = { insumoId: string; insumoNome: string; unidade: string; quantidadePrevista: number; quantidadeReal: string }

type Producao = {
    id: string
    codigoLote: string
    produtoId: string
    produto: { nome: string; unidadeMedida: string }
    quantidadePrevista: number
    quantidadeRealizada?: number | null
    dataProducao: string
    status: 'RASCUNHO' | 'CONFIRMADA' | 'CANCELADA'
    observacoes?: string | null
    composicaoId?: string | null
    consumoInsumos: { insumo: { nome: string; unidadeMedida: string }; quantidadePrevista: number; quantidadeReal?: number | null }[]
}

const statusBadge: Record<string, string> = { RASCUNHO: 'badge-warning', CONFIRMADA: 'badge-success', CANCELADA: 'badge-danger' }

export default function ProducaoPage() {
    const [producoes, setProducoes] = useState<Producao[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [confirmando, setConfirmando] = useState<Producao | null>(null)
    const [saving, setSaving] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [form, setForm] = useState({ produtoId: '', codigoLote: '', quantidadePrevista: '', dataProducao: new Date().toISOString().split('T')[0], composicaoId: '', observacoes: '' })
    const [consumoReal, setConsumoReal] = useState<ConsumoPrev[]>([])
    const [qtdRealizada, setQtdRealizada] = useState('')
    const [editando, setEditando] = useState<Producao | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2, r3] = await Promise.all([fetch('/api/producao'), fetch('/api/produtos'), fetch('/api/insumos')])
        setProducoes(await r1.json())
        setProdutos(await r2.json())
        setInsumos(await r3.json())
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function handleProdutoChange(produtoId: string) {
        setForm(f => ({ ...f, produtoId, composicaoId: '' }))
        if (!produtoId) return
        const r = await fetch(`/api/produtos/${produtoId}`)
        const data = await r.json()
        setProdutos(prev => prev.map(p => p.id === produtoId ? { ...p, composicoes: data.composicoes } : p))
    }

    async function save() {
        setSaving(true)
        await fetch('/api/producao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, quantidadePrevista: parseFloat(form.quantidadePrevista) }),
        })
        setSaving(false); setShowModal(false); load()
    }

    // Open edit modal for RASCUNHO production
    function openEdit(p: Producao) {
        setEditando(p)
        setForm({
            produtoId: p.produtoId || '',
            codigoLote: p.codigoLote,
            quantidadePrevista: String(p.quantidadePrevista),
            dataProducao: new Date(p.dataProducao).toISOString().split('T')[0],
            composicaoId: '',
            observacoes: p.observacoes || '',
        })
        // Fetch composições for the product
        if (p.produtoId) {
            handleProdutoChange(p.produtoId)
        }
    }

    async function saveEdit() {
        if (!editando) return
        setSaving(true)
        await fetch(`/api/producao/${editando.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                produtoId: form.produtoId,
                codigoLote: form.codigoLote,
                quantidadePrevista: parseFloat(form.quantidadePrevista),
                dataProducao: form.dataProducao,
                composicaoId: form.composicaoId || undefined,
                observacoes: form.observacoes || null,
            }),
        })
        setSaving(false); setEditando(null); load()
    }

    async function excluirProducao(id: string) {
        if (!confirm('Excluir esta ordem de produção? Ela será cancelada permanentemente.')) return
        await fetch(`/api/producao/${id}`, { method: 'DELETE' })
        load()
    }

    function openConfirm(p: Producao) {
        setConfirmando(p)
        setQtdRealizada(String(p.quantidadePrevista))
        setConsumoReal(p.consumoInsumos.map(c => {
            const found = insumos.find(i => i.nome === c.insumo.nome)
            return {
                insumoId: found?.id ?? '',
                insumoNome: c.insumo.nome,
                unidade: c.insumo.unidadeMedida,
                quantidadePrevista: Number(c.quantidadePrevista),
                quantidadeReal: String(c.quantidadeReal ?? c.quantidadePrevista),
            }
        }))
    }

    async function confirmar() {
        if (!confirmando) return
        setSaving(true)
        await fetch(`/api/producao/${confirmando.id}/confirmar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quantidadeRealizada: parseFloat(qtdRealizada) || confirmando.quantidadePrevista,
                consumoReal: consumoReal.filter(c => c.insumoId).map(c => ({
                    insumoId: c.insumoId,
                    quantidadeReal: parseFloat(c.quantidadeReal) || c.quantidadePrevista,
                })),
            }),
        })
        setSaving(false); setConfirmando(null); load()
    }

    const produtoSelecionado = produtos.find(p => p.id === form.produtoId)
    const isEditMode = !!editando

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Produção</h1>
                    <p className="page-header-sub">Ordens de produção — confirmar dá baixa nos insumos automaticamente</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => { setEditando(null); setForm({ produtoId: '', codigoLote: `LOT-${Date.now().toString().slice(-6)}`, quantidadePrevista: '', dataProducao: new Date().toISOString().split('T')[0], composicaoId: '', observacoes: '' }); setShowModal(true) }} id="btn-nova-producao">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nova Produção
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : producoes.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">⚗️</div><div className="empty-state-title">Nenhuma produção registrada</div></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Lote</th><th>Produto</th><th>Data</th><th>Qtd. Prev.</th><th>Qtd. Real</th><th>Status</th><th style={{ width: 140 }}>Ações</th></tr></thead>
                            <tbody>
                                {producoes.map((p) => (
                                    <Fragment key={p.id}>
                                        <tr>
                                            <td className="text-sm text-muted">{p.codigoLote}</td>
                                            <td className="font-medium">{p.produto.nome}</td>
                                            <td className="text-sm">{new Date(p.dataProducao).toLocaleDateString('pt-BR')}</td>
                                            <td>{Number(p.quantidadePrevista).toFixed(3)} {p.produto.unidadeMedida}</td>
                                            <td>{p.quantidadeRealizada ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{Number(p.quantidadeRealizada).toFixed(3)}</span> : <span className="text-muted">—</span>}</td>
                                            <td><span className={`badge ${statusBadge[p.status]}`}>{p.status}</span></td>
                                            <td>
                                                <div className="table-actions">
                                                    <button className="btn-icon" title="Detalhes" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                                    </button>
                                                    {p.status === 'RASCUNHO' && (
                                                        <>
                                                            <button className="btn-icon" title="Editar" onClick={() => openEdit(p)}>
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                            </button>
                                                            <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => openConfirm(p)} id={`btn-confirmar-${p.id}`}>Confirmar</button>
                                                            <button className="btn-icon" title="Excluir" style={{ color: 'var(--color-danger)' }} onClick={() => excluirProducao(p.id)}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedId === p.id && p.consumoInsumos.length > 0 && (
                                            <tr key={`${p.id}-detail`}>
                                                <td colSpan={7} style={{ padding: '0 0 8px 48px', background: 'rgba(0,0,0,0.02)' }}>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, fontWeight: 700 }}>CONSUMO DE INSUMOS</div>
                                                    {p.consumoInsumos.map((c, i) => (
                                                        <div key={i} style={{ fontSize: 'var(--text-sm)', marginBottom: 2 }}>
                                                            • {c.insumo.nome}: {Number(c.quantidadePrevista).toFixed(4)} {c.insumo.unidadeMedida} previsto
                                                            {c.quantidadeReal && <span style={{ color: 'var(--color-success)', marginLeft: 8 }}>/ {Number(c.quantidadeReal).toFixed(4)} realizado</span>}
                                                        </div>
                                                    ))}
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

            {/* Create / Edit modal */}
            {(showModal || editando) && !confirmando && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && (isEditMode ? setEditando(null) : setShowModal(false))}>
                    <div className="modal" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">{isEditMode ? '✏️ Editar Produção' : 'Nova Ordem de Produção'}</h2>
                            <button className="btn-icon" onClick={() => isEditMode ? setEditando(null) : setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Produto</label>
                                    <select className="form-control" value={form.produtoId} onChange={e => handleProdutoChange(e.target.value)}>
                                        <option value="">Selecionar produto…</option>
                                        {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                    </select>
                                </div>
                                {produtoSelecionado?.composicoes && produtoSelecionado.composicoes.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Composição técnica</label>
                                        <select className="form-control" value={form.composicaoId} onChange={e => setForm(f => ({ ...f, composicaoId: e.target.value }))}>
                                            <option value="">Sem composição</option>
                                            {produtoSelecionado.composicoes.map(c => <option key={c.id} value={c.id}>{c.nomeVersao}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label required">Código do Lote</label>
                                    <input className="form-control" value={form.codigoLote} onChange={e => setForm(f => ({ ...f, codigoLote: e.target.value }))} placeholder="LOT-001" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Quantidade prevista</label>
                                    <input className="form-control" type="number" step="1" min="0" value={form.quantidadePrevista} onChange={e => setForm(f => ({ ...f, quantidadePrevista: e.target.value }))} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Data de produção</label>
                                    <input className="form-control" type="date" value={form.dataProducao} onChange={e => setForm(f => ({ ...f, dataProducao: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Observações</label>
                                    <textarea className="form-control" rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => isEditMode ? setEditando(null) : setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={isEditMode ? saveEdit : save} disabled={saving || !form.produtoId || !form.codigoLote || !form.quantidadePrevista} id="btn-salvar-producao">
                                {saving ? (isEditMode ? 'Salvando...' : 'Criando...') : (isEditMode ? '✅ Salvar Alterações' : 'Criar Ordem')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm modal */}
            {confirmando && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setConfirmando(null)}>
                    <div className="modal" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">✅ Confirmar Produção</h2>
                            <button className="btn-icon" onClick={() => setConfirmando(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)' }}>
                                ⚠️ Esta ação baixará os insumos do estoque e adicionará o produto ao estoque final.
                            </div>
                            <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                                <label className="form-label required">Quantidade realizada ({confirmando.produto.unidadeMedida})</label>
                                <input className="form-control" type="number" step="1" value={qtdRealizada} onChange={e => setQtdRealizada(e.target.value)} autoFocus />
                            </div>
                            {consumoReal.length > 0 && (
                                <>
                                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>Consumo real de insumos:</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                        {consumoReal.map((c, i) => (
                                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-3)', alignItems: 'center' }}>
                                                <div><div className="font-medium text-sm">{c.insumoNome}</div><div className="text-xs text-muted">Previsto: {c.quantidadePrevista.toFixed(4)} {c.unidade}</div></div>
                                                <input
                                                    className="form-control"
                                                    type="number"
                                                    step="1"
                                                    style={{ width: 140 }}
                                                    value={c.quantidadeReal}
                                                    onChange={e => setConsumoReal(prev => prev.map((item, j) => j === i ? { ...item, quantidadeReal: e.target.value } : item))}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setConfirmando(null)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={confirmar} disabled={saving} id="btn-executar-confirmar">
                                {saving ? 'Confirmando...' : '✅ Confirmar e Baixar Estoque'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
