'use client'

import { useState, useEffect, useCallback } from 'react'

type Categoria = {
    id: string
    tipo: 'PRODUTO' | 'INSUMO' | 'PARCEIRO' | 'MOVIMENTO'
    nome: string
    descricao?: string | null
    ativo: boolean
}

const tipoLabel: Record<string, string> = {
    PRODUTO: 'Produto',
    INSUMO: 'Insumo',
    PARCEIRO: 'Parceiro',
    MOVIMENTO: 'Movimento',
}

const tipoBadge: Record<string, string> = {
    PRODUTO: 'badge-accent',
    INSUMO: 'badge-success',
    PARCEIRO: 'badge-info',
    MOVIMENTO: 'badge-neutral',
}

export default function CategoriasPage() {
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Categoria | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ tipo: 'PRODUTO', nome: '', descricao: '' })

    const load = useCallback(async () => {
        setLoading(true)
        const r = await fetch('/api/categorias')
        const data = await r.json()
        setCategorias(data)
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    function openCreate() {
        setEditing(null)
        setForm({ tipo: 'PRODUTO', nome: '', descricao: '' })
        setShowModal(true)
    }

    function openEdit(c: Categoria) {
        setEditing(c)
        setForm({ tipo: c.tipo, nome: c.nome, descricao: c.descricao ?? '' })
        setShowModal(true)
    }

    async function save() {
        setSaving(true)
        const url = editing ? `/api/categorias/${editing.id}` : '/api/categorias'
        const method = editing ? 'PATCH' : 'POST'
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        setSaving(false)
        setShowModal(false)
        load()
    }

    async function remove(id: string) {
        if (!confirm('Desativar esta categoria?')) return
        await fetch(`/api/categorias/${id}`, { method: 'DELETE' })
        load()
    }

    return (
        <div className="page-body anim-fade-in">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Categorias</h1>
                    <p className="page-header-sub">Gerencie as categorias de produtos e insumos</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={openCreate} id="btn-nova-categoria">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nova Categoria
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="spinner" /></div>
                    ) : categorias.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🏷️</div>
                            <div className="empty-state-title">Nenhuma categoria</div>
                            <p className="empty-state-desc">Crie a primeira categoria para organizar produtos e insumos.</p>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Tipo</th>
                                    <th>Nome</th>
                                    <th>Descrição</th>
                                    <th style={{ width: 100 }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categorias.map((c) => (
                                    <tr key={c.id}>
                                        <td><span className={`badge ${tipoBadge[c.tipo]}`}>{tipoLabel[c.tipo]}</span></td>
                                        <td className="font-medium">{c.nome}</td>
                                        <td className="text-muted text-sm">{c.descricao || '—'}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon" title="Editar" onClick={() => openEdit(c)}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>
                                                <button className="btn-icon" title="Desativar" onClick={() => remove(c.id)} style={{ color: 'var(--color-danger)' }}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
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

            {/* Modal */}
            {showModal && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal" role="dialog" aria-modal="true">
                        <div className="modal-header">
                            <h2 className="modal-title">{editing ? 'Editar Categoria' : 'Nova Categoria'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Tipo</label>
                                    <select className="form-control" value={form.tipo} onChange={(e) => setForm(f => ({ ...f, tipo: e.target.value as typeof form.tipo }))} disabled={!!editing}>
                                        <option value="PRODUTO">Produto</option>
                                        <option value="INSUMO">Insumo</option>
                                        <option value="PARCEIRO">Parceiro</option>
                                        <option value="MOVIMENTO">Movimento</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Nome</label>
                                    <input className="form-control" value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="ex: Rapé, Ervas medicinais..." autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descrição</label>
                                    <textarea className="form-control" rows={2} value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição opcional..." />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.nome.trim()} id="btn-salvar-categoria">
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
