'use client'

import { useState, useEffect, useCallback } from 'react'

type Usuario = {
    id: string
    name: string | null
    email: string
    role: 'ADMIN' | 'PARTNER'
    ativo: boolean
    criadoEm: string
    parceiro?: { id: string; nome: string } | null
}
type Parceiro = { id: string; nome: string }

export default function UsuariosPage() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([])
    const [parceiros, setParceiros] = useState<Parceiro[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ nome: '', email: '', senha: '', role: 'PARTNER', parceiroId: '' })
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2] = await Promise.all([fetch('/api/usuarios'), fetch('/api/parceiros')])
        if (r1.ok) setUsuarios(await r1.json())
        const ps = await r2.json(); setParceiros(ps.filter((p: Parceiro & { status: string }) => p.status === 'ATIVO'))
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function save() {
        setSaving(true); setError('')
        const res = await fetch('/api/usuarios', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, parceiroId: form.role === 'PARTNER' ? form.parceiroId || null : null }),
        })
        if (!res.ok) { const e = await res.json(); setError(e.error || 'Erro ao salvar'); setSaving(false); return }
        setSaving(false); setShowModal(false); load()
    }

    async function toggleAtivo(u: Usuario) {
        await fetch(`/api/usuarios/${u.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: !u.ativo }),
        })
        load()
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Usuários</h1>
                    <p className="page-header-sub">Gerencie o acesso ao sistema</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => { setForm({ nome: '', email: '', senha: '', role: 'PARTNER', parceiroId: '' }); setError(''); setShowModal(true) }} id="btn-novo-usuario">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Novo Usuário
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : usuarios.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">👤</div><div className="empty-state-title">Nenhum usuário</div></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Parceiro</th><th>Criado em</th><th>Status</th><th style={{ width: 80 }}>Ações</th></tr></thead>
                            <tbody>
                                {usuarios.map((u) => (
                                    <tr key={u.id} style={!u.ativo ? { opacity: 0.55 } : {}}>
                                        <td className="font-medium">{u.name || '—'}</td>
                                        <td className="text-sm">{u.email}</td>
                                        <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-accent' : 'badge-info'}`}>{u.role}</span></td>
                                        <td className="text-sm">{u.parceiro?.nome || <span className="text-muted">—</span>}</td>
                                        <td className="text-sm text-muted">{new Date(u.criadoEm).toLocaleDateString('pt-BR')}</td>
                                        <td><span className={`badge ${u.ativo ? 'badge-success' : 'badge-neutral'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                                        <td>
                                            <div className="table-actions">
                                                <button
                                                    className={`btn btn-sm ${u.ativo ? 'btn-secondary' : 'btn-primary'}`}
                                                    style={{ fontSize: 11 }}
                                                    onClick={() => toggleAtivo(u)}
                                                    title={u.ativo ? 'Desativar' : 'Ativar'}
                                                >
                                                    {u.ativo ? 'Desativar' : 'Ativar'}
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
                            <h2 className="modal-title">Novo Usuário</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Nome</label>
                                    <input className="form-control" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Email</label>
                                    <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Senha inicial</label>
                                    <input className="form-control" type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="mínimo 6 caracteres" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Perfil</label>
                                    <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, parceiroId: '' }))}>
                                        <option value="PARTNER">Parceiro (Portal)</option>
                                        <option value="ADMIN">Admin (Sistema)</option>
                                    </select>
                                </div>
                                {form.role === 'PARTNER' && (
                                    <div className="form-group">
                                        <label className="form-label">Vincular a parceiro</label>
                                        <select className="form-control" value={form.parceiroId} onChange={e => setForm(f => ({ ...f, parceiroId: e.target.value }))}>
                                            <option value="">Sem vínculo</option>
                                            {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.email || !form.senha} id="btn-salvar-usuario">
                                {saving ? 'Criando...' : '👤 Criar Usuário'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
