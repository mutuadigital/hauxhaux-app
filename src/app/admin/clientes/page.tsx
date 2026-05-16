'use client'

import { useState, useEffect, useCallback } from 'react'

type Cliente = {
    id: string; nome: string; documento?: string | null; telefone?: string | null
    email?: string | null; endereco?: string | null; cidade?: string | null
    estado?: string | null; observacoes?: string | null; ativo: boolean
    criadoEm: string; _count: { vendas: number }
}

const emptyForm = { nome: '', documento: '', telefone: '', email: '', endereco: '', cidade: '', estado: '', observacoes: '' }

export default function ClientesPage() {
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [loading, setLoading] = useState(true)
    const [busca, setBusca] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editando, setEditando] = useState<Cliente | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const r = await fetch(`/api/clientes?busca=${encodeURIComponent(busca)}`)
        setClientes(await r.json())
        setLoading(false)
    }, [busca])

    useEffect(() => { load() }, [load])

    function openNew() { setEditando(null); setForm(emptyForm); setShowModal(true) }

    function openEdit(c: Cliente) {
        setEditando(c)
        setForm({ nome: c.nome, documento: c.documento || '', telefone: c.telefone || '', email: c.email || '', endereco: c.endereco || '', cidade: c.cidade || '', estado: c.estado || '', observacoes: c.observacoes || '' })
        setShowModal(true)
    }

    async function save() {
        setSaving(true)
        if (editando) {
            await fetch(`/api/clientes/${editando.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        } else {
            await fetch('/api/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        }
        setSaving(false); setShowModal(false); load()
    }

    async function toggleAtivo(c: Cliente) {
        await fetch(`/api/clientes/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !c.ativo }) })
        load()
    }

    const f = (k: keyof typeof emptyForm, v: string) => setForm(prev => ({ ...prev, [k]: v }))

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Clientes</h1>
                    <p className="page-header-sub">Cadastro de clientes para vendas diretas</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={openNew} id="btn-novo-cliente">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input className="form-control" placeholder="Buscar por nome, documento ou e-mail…" value={busca} onChange={e => setBusca(e.target.value)} style={{ maxWidth: 400 }} />
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : clientes.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">👥</div><div className="empty-state-title">Nenhum cliente cadastrado</div><div className="empty-state-desc">Cadastre clientes para vincular às vendas diretas.</div></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>E-mail</th><th>Cidade/UF</th><th>Vendas</th><th>Status</th><th style={{ width: 80 }}>Ações</th></tr></thead>
                            <tbody>
                                {clientes.map(c => (
                                    <tr key={c.id}>
                                        <td className="font-medium">{c.nome}</td>
                                        <td className="text-sm text-muted">{c.documento || '—'}</td>
                                        <td className="text-sm">{c.telefone || '—'}</td>
                                        <td className="text-sm">{c.email || '—'}</td>
                                        <td className="text-sm">{[c.cidade, c.estado].filter(Boolean).join('/') || '—'}</td>
                                        <td><span className="badge badge-neutral">{c._count.vendas}</span></td>
                                        <td><span className={`badge ${c.ativo ? 'badge-success' : 'badge-danger'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon" title="Editar" onClick={() => openEdit(c)}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>
                                                <button className="btn-icon" title={c.ativo ? 'Desativar' : 'Ativar'} onClick={() => toggleAtivo(c)} style={{ color: c.ativo ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                    {c.ativo ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                                                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
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
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">{editando ? '✏️ Editar Cliente' : 'Novo Cliente'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group"><label className="form-label required">Nome</label><input className="form-control" value={form.nome} onChange={e => f('nome', e.target.value)} placeholder="Nome completo" autoFocus /></div>
                                <div className="form-group"><label className="form-label">CPF / CNPJ</label><input className="form-control" value={form.documento} onChange={e => f('documento', e.target.value)} placeholder="Opcional" /></div>
                                <div className="form-group"><label className="form-label">Telefone</label><input className="form-control" value={form.telefone} onChange={e => f('telefone', e.target.value)} placeholder="(00) 00000-0000" /></div>
                                <div className="form-group"><label className="form-label">E-mail</label><input className="form-control" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="email@exemplo.com" /></div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Endereço</label><input className="form-control" value={form.endereco} onChange={e => f('endereco', e.target.value)} placeholder="Rua, número, bairro…" /></div>
                                <div className="form-group"><label className="form-label">Cidade</label><input className="form-control" value={form.cidade} onChange={e => f('cidade', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Estado</label><input className="form-control" value={form.estado} onChange={e => f('estado', e.target.value)} placeholder="UF" maxLength={2} /></div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Observações</label><textarea className="form-control" rows={2} value={form.observacoes} onChange={e => f('observacoes', e.target.value)} /></div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.nome.trim()} id="btn-salvar-cliente">
                                {saving ? 'Salvando...' : (editando ? '✅ Salvar' : 'Cadastrar')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
