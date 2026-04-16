'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Produto = {
    id: string
    codigo: string
    nome: string
    unidadeMedida: string
    precoPadrao: number
    estoqueMinimo: number
    ativo: boolean
    categoria?: { nome: string } | null
    estoque?: { quantidadeAtual: number } | null
}

type Categoria = { id: string; nome: string }

const defaultForm = { codigo: '', nome: '', categoriaId: '', unidadeMedida: '', precoPadrao: '', custoRef: '', estoqueMinimo: '0', observacoes: '' }

export default function ProdutosPage() {
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Produto | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [q, setQ] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2] = await Promise.all([
            fetch(`/api/produtos${q ? `?q=${encodeURIComponent(q)}` : ''}`),
            fetch('/api/categorias?tipo=PRODUTO'),
        ])
        setProdutos(await r1.json())
        setCategorias(await r2.json())
        setLoading(false)
    }, [q])

    useEffect(() => { load() }, [load])

    function openCreate() { setEditing(null); setForm(defaultForm); setShowModal(true) }
    function openEdit(p: Produto) {
        setEditing(p)
        setForm({ codigo: p.codigo, nome: p.nome, categoriaId: '', unidadeMedida: p.unidadeMedida, precoPadrao: p.precoPadrao.toString(), custoRef: '', estoqueMinimo: p.estoqueMinimo.toString(), observacoes: '' })
        setShowModal(true)
    }
    async function save() {
        setSaving(true)
        const url = editing ? `/api/produtos/${editing.id}` : '/api/produtos'
        const method = editing ? 'PATCH' : 'POST'
        const body = { ...form, precoPadrao: parseFloat(form.precoPadrao) || 0, custoRef: form.custoRef ? parseFloat(form.custoRef) : null, estoqueMinimo: parseFloat(form.estoqueMinimo) || 0 }
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        setSaving(false); setShowModal(false); load()
    }
    async function remove(id: string) {
        if (!confirm('Desativar este produto?')) return
        await fetch(`/api/produtos/${id}`, { method: 'DELETE' })
        load()
    }
    const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

    const saldoColor = (p: Produto) => {
        const q = Number(p.estoque?.quantidadeAtual ?? 0)
        return q <= 0 ? 'var(--color-danger)' : q <= Number(p.estoqueMinimo) ? 'var(--color-warning)' : 'var(--color-success)'
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Produtos</h1>
                    <p className="page-header-sub">Produtos acabados disponíveis para consignação</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={openCreate} id="btn-novo-produto">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Novo Produto
                    </button>
                </div>
            </div>

            <div className="filter-bar">
                <div className="search-bar">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input placeholder="Buscar produto..." value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="spinner" /></div>
                    ) : produtos.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🧴</div>
                            <div className="empty-state-title">Nenhum produto</div>
                            <p className="empty-state-desc">Cadastre os produtos para iniciar a operação.</p>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Nome</th>
                                    <th>Categoria</th>
                                    <th>Un.</th>
                                    <th>Preço</th>
                                    <th>Estoque</th>
                                    <th style={{ width: 100 }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {produtos.map((p) => (
                                    <tr key={p.id}>
                                        <td className="text-sm text-muted">{p.codigo}</td>
                                        <td className="font-medium">{p.nome}</td>
                                        <td className="text-sm">{p.categoria?.nome ?? '—'}</td>
                                        <td className="text-sm">{p.unidadeMedida}</td>
                                        <td className="text-sm font-medium">R$ {Number(p.precoPadrao).toFixed(2)}</td>
                                        <td>
                                            <span style={{ fontWeight: 600, color: saldoColor(p) }}>
                                                {Number(p.estoque?.quantidadeAtual ?? 0).toFixed(3)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon" title="Editar" onClick={() => openEdit(p)}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>
                                                <Link href={`/admin/produtos/${p.id}/composicao`} className="btn-icon" title="Composição técnica">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="2 3 8 3 8 21 2 21" /><polygon points="8 8 14 5 14 21 8 21" /><polygon points="14 5 22 3 22 21 14 21" /></svg>
                                                </Link>
                                                <button className="btn-icon" title="Desativar" onClick={() => remove(p.id)} style={{ color: 'var(--color-danger)' }}>
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
                            <h2 className="modal-title">{editing ? 'Editar Produto' : 'Novo Produto'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Código</label>
                                    <input className="form-control" value={form.codigo} onChange={f('codigo')} placeholder="PROD-001" disabled={!!editing} autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Nome</label>
                                    <input className="form-control" value={form.nome} onChange={f('nome')} placeholder="Nome do produto" />
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
                                    <input className="form-control" value={form.unidadeMedida} onChange={f('unidadeMedida')} placeholder="g, un, cx..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Preço padrão (R$)</label>
                                    <input className="form-control" type="number" step="1" min="0" value={form.precoPadrao} onChange={f('precoPadrao')} placeholder="0.00" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Custo de referência (R$)</label>
                                    <input className="form-control" type="number" step="1" min="0" value={form.custoRef} onChange={f('custoRef')} placeholder="0.00" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estoque mínimo</label>
                                    <input className="form-control" type="number" step="1" min="0" value={form.estoqueMinimo} onChange={f('estoqueMinimo')} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <textarea className="form-control" rows={2} value={form.observacoes} onChange={f('observacoes')} placeholder="Notas adicionais..." />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.codigo.trim() || !form.nome.trim() || !form.unidadeMedida.trim() || !form.precoPadrao} id="btn-salvar-produto">
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
