'use client'

import { useState, useEffect, useCallback } from 'react'

type Parceiro = {
    id: string
    nome: string
    nomeFantasia?: string | null
    documento?: string | null
    contatoPrincipal?: string | null
    telefone?: string | null
    email?: string | null
    cep?: string | null
    endereco?: string | null
    cidade?: string | null
    estado?: string | null
    status: string
    percentualComissao?: number | null
    _count?: { estoqueConsignado: number }
}

const statusBadge: Record<string, string> = {
    ATIVO: 'badge-success',
    INATIVO: 'badge-warning',
    ENCERRADO: 'badge-danger',
}

const defaultForm = { nome: '', nomeFantasia: '', documento: '', contatoPrincipal: '', telefone: '', email: '', cep: '', endereco: '', cidade: '', estado: '', observacoes: '', percentualComissao: '0' }

export default function ParceirosPage() {
    const [parceiros, setParceiros] = useState<Parceiro[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Parceiro | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [q, setQ] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        const r = await fetch(`/api/parceiros${q ? `?q=${encodeURIComponent(q)}` : ''}`)
        const data = await r.json()
        setParceiros(data)
        setLoading(false)
    }, [q])

    useEffect(() => { load() }, [load])

    function openCreate() {
        setEditing(null); setForm(defaultForm); setShowModal(true)
    }
    function openEdit(p: Parceiro) {
        setEditing(p)
        setForm({ nome: p.nome, nomeFantasia: p.nomeFantasia ?? '', documento: p.documento ?? '', contatoPrincipal: p.contatoPrincipal ?? '', telefone: p.telefone ?? '', email: p.email ?? '', cep: p.cep ?? '', endereco: p.endereco ?? '', cidade: p.cidade ?? '', estado: p.estado ?? '', observacoes: '', percentualComissao: String(p.percentualComissao ?? 0) })
        setShowModal(true)
    }
    async function save() {
        setSaving(true)
        const url = editing ? `/api/parceiros/${editing.id}` : '/api/parceiros'
        const method = editing ? 'PATCH' : 'POST'
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        setSaving(false); setShowModal(false); load()
    }
    async function remove(id: string) {
        if (!confirm('Encerrar este parceiro?')) return
        await fetch(`/api/parceiros/${id}`, { method: 'DELETE' })
        load()
    }
    const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }))

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Parceiros</h1>
                    <p className="page-header-sub">Gerencie os parceiros de consignação</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={openCreate} id="btn-novo-parceiro">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Novo Parceiro
                    </button>
                </div>
            </div>

            <div className="filter-bar">
                <div className="search-bar">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input placeholder="Buscar parceiro..." value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="spinner" /></div>
                    ) : parceiros.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🤝</div>
                            <div className="empty-state-title">Nenhum parceiro</div>
                            <p className="empty-state-desc">Comece cadastrando os parceiros de consignação.</p>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nome / Fantasia</th>
                                    <th>Contato</th>
                                    <th>Cidade / UF</th>
                                    <th>Status</th>
                                    <th>Comissão</th>
                                    <th>Estoque</th>
                                    <th style={{ width: 80 }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parceiros.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            <div className="font-medium">{p.nome}</div>
                                            {p.nomeFantasia && <div className="text-sm text-muted">{p.nomeFantasia}</div>}
                                        </td>
                                        <td>
                                            {p.contatoPrincipal && <div className="text-sm">{p.contatoPrincipal}</div>}
                                            {p.email && <div className="text-xs text-muted">{p.email}</div>}
                                        </td>
                                        <td className="text-sm">{[p.cidade, p.estado].filter(Boolean).join(' / ') || '—'}</td>
                                        <td><span className={`badge ${statusBadge[p.status] ?? 'badge-neutral'}`}>{p.status}</span></td>
                                        <td>
                                            {Number(p.percentualComissao) > 0
                                                ? <span className="badge badge-warning">{Number(p.percentualComissao)}%</span>
                                                : <span className="text-muted text-xs">—</span>}
                                        </td>
                                        <td><span className="badge badge-neutral">{p._count?.estoqueConsignado ?? 0} produto(s)</span></td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon" title="Editar" onClick={() => openEdit(p)}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>
                                                {p.status !== 'ENCERRADO' && (
                                                    <button className="btn-icon" title="Encerrar" onClick={() => remove(p.id)} style={{ color: 'var(--color-danger)' }}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                                    </button>
                                                )}
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
                    <div className="modal modal-lg" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">{editing ? 'Editar Parceiro' : 'Novo Parceiro'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label required">Nome</label>
                                    <input className="form-control" value={form.nome} onChange={f('nome')} placeholder="Razão social ou nome completo" autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nome fantasia</label>
                                    <input className="form-control" value={form.nomeFantasia} onChange={f('nomeFantasia')} placeholder="Nome fantasia" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Documento (CPF/CNPJ)</label>
                                    <input className="form-control" value={form.documento} onChange={f('documento')} placeholder="000.000.000-00" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contato principal</label>
                                    <input className="form-control" value={form.contatoPrincipal} onChange={f('contatoPrincipal')} placeholder="Nome do responsável" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Telefone</label>
                                    <input className="form-control" value={form.telefone} onChange={f('telefone')} placeholder="(00) 00000-0000" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">E-mail</label>
                                    <input className="form-control" type="email" value={form.email} onChange={f('email')} placeholder="email@exemplo.com" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">CEP</label>
                                    <input className="form-control" value={form.cep} onChange={f('cep')} placeholder="00000-000" maxLength={9} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Endereço completo</label>
                                    <input className="form-control" value={form.endereco} onChange={f('endereco')} placeholder="Rua, número, bairro..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cidade</label>
                                    <input className="form-control" value={form.cidade} onChange={f('cidade')} placeholder="Cidade" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">UF</label>
                                    <input className="form-control" value={form.estado} onChange={f('estado')} placeholder="SP" maxLength={2} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">% Comissão do Parceiro</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="form-control" type="number" step="1" min="0" max="100" value={form.percentualComissao} onChange={f('percentualComissao')} placeholder="0" style={{ paddingRight: 32 }} />
                                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none', fontWeight: 600 }}>%</span>
                                    </div>
                                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>Percentual retido pelo parceiro sobre as vendas. 0 = sem comissão.</div>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Observações</label>
                                    <textarea className="form-control" rows={2} value={form.observacoes} onChange={f('observacoes')} placeholder="Notas adicionais..." />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.nome.trim()} id="btn-salvar-parceiro">
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
