'use client'

import { useState, useEffect, useCallback } from 'react'

type Insumo = {
    id: string
    codigo: string
    nome: string
    unidadeMedida: string
    custoMedio?: number | null
    estoqueMinimo: number
    ativo: boolean
    categoria?: { nome: string } | null
    estoque?: { quantidadeAtual: number } | null
}

type Categoria = { id: string; nome: string }

const defaultForm = { codigo: '', nome: '', categoriaId: '', unidadeMedida: '', custoMedio: '', estoqueMinimo: '0', observacoes: '' }

export default function InsumosPage() {
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Insumo | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [q, setQ] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2] = await Promise.all([
            fetch(`/api/insumos${q ? `?q=${encodeURIComponent(q)}` : ''}`),
            fetch('/api/categorias?tipo=INSUMO'),
        ])
        setInsumos(await r1.json())
        setCategorias(await r2.json())
        setLoading(false)
    }, [q])

    useEffect(() => { load() }, [load])

    function openCreate() { setEditing(null); setForm(defaultForm); setShowModal(true) }
    function openEdit(i: Insumo) {
        setEditing(i)
        setForm({ codigo: i.codigo, nome: i.nome, categoriaId: '', unidadeMedida: i.unidadeMedida, custoMedio: i.custoMedio?.toString() ?? '', estoqueMinimo: i.estoqueMinimo.toString(), observacoes: '' })
        setShowModal(true)
    }
    async function save() {
        setSaving(true)
        const url = editing ? `/api/insumos/${editing.id}` : '/api/insumos'
        const method = editing ? 'PATCH' : 'POST'
        const body = { ...form, custoMedio: form.custoMedio ? parseFloat(form.custoMedio) : null, estoqueMinimo: parseFloat(form.estoqueMinimo) || 0 }
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        setSaving(false); setShowModal(false); load()
    }
    async function remove(id: string) {
        if (!confirm('Desativar este insumo?')) return
        await fetch(`/api/insumos/${id}`, { method: 'DELETE' })
        load()
    }
    const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

    const saldoColor = (i: Insumo) => {
        const q = Number(i.estoque?.quantidadeAtual ?? 0)
        const min = Number(i.estoqueMinimo ?? 0)
        if (q <= 0) return 'var(--color-danger)'
        if (q <= min) return 'var(--color-warning)'
        return 'var(--color-success)'
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Insumos</h1>
                    <p className="page-header-sub">Matérias-primas e materiais usados na produção</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={openCreate} id="btn-novo-insumo">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Novo Insumo
                    </button>
                </div>
            </div>

            <div className="filter-bar">
                <div className="search-bar">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input placeholder="Buscar insumo..." value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="spinner" /></div>
                    ) : insumos.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🌿</div>
                            <div className="empty-state-title">Nenhum insumo</div>
                            <p className="empty-state-desc">Cadastre os insumos utilizados na produção.</p>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Nome</th>
                                    <th>Categoria</th>
                                    <th>Unidade</th>
                                    <th>Saldo</th>
                                    <th>Custo Médio</th>
                                    <th style={{ width: 80 }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {insumos.map((i) => (
                                    <tr key={i.id}>
                                        <td className="text-sm text-muted">{i.codigo}</td>
                                        <td className="font-medium">{i.nome}</td>
                                        <td className="text-sm">{i.categoria?.nome ?? '—'}</td>
                                        <td className="text-sm">{i.unidadeMedida}</td>
                                        <td>
                                            <span style={{ fontWeight: 600, color: saldoColor(i) }}>
                                                {Number(i.estoque?.quantidadeAtual ?? 0).toFixed(3)} {i.unidadeMedida}
                                            </span>
                                        </td>
                                        <td className="text-sm">{i.custoMedio ? `R$ ${Number(i.custoMedio).toFixed(4)}` : '—'}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon" title="Editar" onClick={() => openEdit(i)}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>
                                                <button className="btn-icon" title="Desativar" onClick={() => remove(i.id)} style={{ color: 'var(--color-danger)' }}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">{editing ? 'Editar Insumo' : 'Novo Insumo'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Código</label>
                                    <input className="form-control" value={form.codigo} onChange={f('codigo')} placeholder="INS-001" disabled={!!editing} autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Nome</label>
                                    <input className="form-control" value={form.nome} onChange={f('nome')} placeholder="Nome do insumo" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Categoria</label>
                                    <select className="form-control" value={form.categoriaId} onChange={f('categoriaId')}>
                                        <option value="">Sem categoria</option>
                                        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Unidade de medida</label>
                                    <input className="form-control" value={form.unidadeMedida} onChange={f('unidadeMedida')} placeholder="g, kg, ml, L, un..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Custo médio (R$)</label>
                                    <input className="form-control" type="number" step="1" min="0" value={form.custoMedio} onChange={f('custoMedio')} placeholder="0.0000" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estoque mínimo</label>
                                    <input className="form-control" type="number" step="1" min="0" value={form.estoqueMinimo} onChange={f('estoqueMinimo')} placeholder="0" />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Observações</label>
                                    <textarea className="form-control" rows={2} value={form.observacoes} onChange={f('observacoes')} placeholder="Notas adicionais..." />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.codigo.trim() || !form.nome.trim() || !form.unidadeMedida.trim()} id="btn-salvar-insumo">
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
