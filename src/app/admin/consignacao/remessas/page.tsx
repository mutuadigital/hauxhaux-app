'use client'

import { Fragment, useState, useEffect, useCallback, useMemo } from 'react'
import { Stepper } from '@/components/Stepper'

type Parceiro = { id: string; nome: string; status?: string }
type Produto = { id: string; nome: string; unidadeMedida: string; precoPadrao?: number }
type RemessaItem = { produtoId: string; quantidade: number; valorReferencia: string }

type RemessaItemData = {
    produtoId: string
    produto: { nome: string; unidadeMedida: string }
    quantidade: number
    valorReferencia?: number | null
}

type Remessa = {
    id: string
    parceiroId: string
    parceiro: { nome: string }
    dataEnvio: string
    status: 'RASCUNHO' | 'EM_SEPARACAO' | 'ENVIADA' | 'CANCELADA'
    observacoes?: string | null
    itens: RemessaItemData[]
}

const statusBadge: Record<string, { cls: string; label: string; icon: string }> = {
    RASCUNHO:     { cls: 'badge-neutral',  label: 'Rascunho',      icon: '📝' },
    EM_SEPARACAO: { cls: 'badge-warning',  label: 'Em Separação',  icon: '⚙️' },
    ENVIADA:      { cls: 'badge-success',  label: 'Enviada',       icon: '✅' },
    // legado — pode ainda existir até a migration rodar
    CONFIRMADA:   { cls: 'badge-success',  label: 'Confirmada',    icon: '✅' },
    CANCELADA:    { cls: 'badge-danger',   label: 'Cancelada',     icon: '❌' },
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function RemessasPage() {
    const [remessas, setRemessas] = useState<Remessa[]>([])
    const [parceiros, setParceiros] = useState<Parceiro[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // Filters
    const [filtroMes, setFiltroMes] = useState('')
    const [filtroAno, setFiltroAno] = useState('')
    const [filtroParceiro, setFiltroParceiro] = useState('')

    // Create form
    const [form, setForm] = useState({ parceiroId: '', dataEnvio: new Date().toISOString().split('T')[0], observacoes: '' })
    const [itens, setItens] = useState<RemessaItem[]>([{ produtoId: '', quantidade: 1, valorReferencia: '' }])

    // Edit modal
    const [editando, setEditando] = useState<Remessa | null>(null)
    const [editForm, setEditForm] = useState({ dataEnvio: '', observacoes: '' })
    const [editItens, setEditItens] = useState<RemessaItem[]>([])
    const [editSaving, setEditSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2, r3] = await Promise.all([
            fetch('/api/consignacao/remessas'),
            fetch('/api/parceiros'),
            fetch('/api/produtos'),
        ])
        setRemessas(await r1.json())
        const ps = await r2.json()
        setParceiros(ps.filter((p: Parceiro) => p.status === 'ATIVO' || !p.status))
        setProdutos(await r3.json())
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    // ── Filtros ────────────────────────────────────────────────────────────────
    const anosDisponiveis = useMemo(() => {
        const anos = new Set(remessas.map(r => new Date(r.dataEnvio).getFullYear()))
        return Array.from(anos).sort((a, b) => b - a)
    }, [remessas])

    const remessasFiltradas = useMemo(() => {
        return remessas.filter(r => {
            const d = new Date(r.dataEnvio)
            if (filtroMes && String(d.getMonth() + 1) !== filtroMes) return false
            if (filtroAno && String(d.getFullYear()) !== filtroAno) return false
            if (filtroParceiro && r.parceiroId !== filtroParceiro) return false
            return true
        })
    }, [remessas, filtroMes, filtroAno, filtroParceiro])

    // ── Item helpers ───────────────────────────────────────────────────────────
    function addItem(list: RemessaItem[], set: (v: RemessaItem[]) => void) {
        set([...list, { produtoId: '', quantidade: 1, valorReferencia: '' }])
    }
    function removeItem(list: RemessaItem[], set: (v: RemessaItem[]) => void, idx: number) {
        set(list.filter((_, j) => j !== idx))
    }
    function updateItem(list: RemessaItem[], set: (v: RemessaItem[]) => void, idx: number, field: keyof RemessaItem, value: string | number) {
        const n = [...list]; n[idx] = { ...n[idx], [field]: value }; set(n)
    }

    // ── Create ─────────────────────────────────────────────────────────────────
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

    // ── Open edit ──────────────────────────────────────────────────────────────
    function openEdit(r: Remessa) {
        setEditando(r)
        setEditForm({
            dataEnvio: new Date(r.dataEnvio).toISOString().split('T')[0],
            observacoes: r.observacoes ?? '',
        })
        setEditItens(r.itens.map(i => ({
            produtoId: i.produtoId,
            quantidade: Number(i.quantidade),
            valorReferencia: i.valorReferencia != null ? String(i.valorReferencia) : '',
        })))
    }

    // ── Save edit ──────────────────────────────────────────────────────────────
    async function salvarEdicao() {
        if (!editando) return
        setEditSaving(true)
        const payload = {
            dataEnvio: editForm.dataEnvio,
            observacoes: editForm.observacoes || null,
            itens: editItens.filter(i => i.produtoId && Number(i.quantidade) > 0).map(i => ({
                produtoId: i.produtoId,
                quantidade: Number(i.quantidade),
                valorReferencia: parseFloat(i.valorReferencia) || null,
            })),
        }
        const res = await fetch(`/api/consignacao/remessas/${editando.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) { const e = await res.json(); alert('Erro: ' + (e.error ?? 'Falha ao salvar')) }
        setEditSaving(false); setEditando(null); load()
    }

    // ── Mark as ENVIADA ────────────────────────────────────────────────────────
    async function marcarEnviada(r: Remessa) {
        if (!confirm(`Marcar remessa de ${r.parceiro.nome} como ENVIADA? O estoque já foi baixado ao criar a remessa.`)) return
        await fetch(`/api/consignacao/remessas/${r.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ENVIADA' }),
        })
        load()
    }

    // ── Delete ─────────────────────────────────────────────────────────────────
    async function excluirRemessa(r: Remessa) {
        if (!confirm(`Excluir remessa de ${r.parceiro.nome}?\n\nIsso reverterá todos os movimentos de estoque automaticamente.`)) return
        const res = await fetch(`/api/consignacao/remessas/${r.id}`, { method: 'DELETE' })
        if (!res.ok) { const e = await res.json(); alert('Erro: ' + (e.error ?? 'Falha ao excluir')) }
        else load()
    }

    // ── Item totals ────────────────────────────────────────────────────────────
    function totais(itens: RemessaItemData[]) {
        const qtd = itens.reduce((s, i) => s + Number(i.quantidade), 0)
        const vlr = itens.reduce((s, i) => s + (i.valorReferencia ? Number(i.valorReferencia) * Number(i.quantidade) : 0), 0)
        return { qtd, vlr }
    }

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Remessas em Consignação</h1>
                    <p className="page-header-sub">Envio de produtos para parceiros — baixa automática do estoque interno</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => {
                        setForm({ parceiroId: '', dataEnvio: new Date().toISOString().split('T')[0], observacoes: '' })
                        setItens([{ produtoId: '', quantidade: 1, valorReferencia: '' }])
                        setShowModal(true)
                    }} id="btn-nova-remessa">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nova Remessa
                    </button>
                </div>
            </div>

            {/* ── Filtros ── */}
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
                        <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 4 }}>Mês</label>
                        <select className="form-control" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                            <option value="">Todos</option>
                            {MESES.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 100 }}>
                        <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 4 }}>Ano</label>
                        <select className="form-control" value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                            <option value="">Todos</option>
                            {anosDisponiveis.map(a => <option key={a} value={String(a)}>{a}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                        <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 4 }}>Parceiro</label>
                        <select className="form-control" value={filtroParceiro} onChange={e => setFiltroParceiro(e.target.value)}>
                            <option value="">Todos</option>
                            {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                    </div>
                    {(filtroMes || filtroAno || filtroParceiro) && (
                        <button className="btn btn-secondary btn-sm" style={{ marginBottom: 1 }} onClick={() => { setFiltroMes(''); setFiltroAno(''); setFiltroParceiro('') }}>
                            ✕ Limpar filtros
                        </button>
                    )}
                    <div style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                        {remessasFiltradas.length} remessa(s)
                    </div>
                </div>
            </div>

            {/* ── Tabela ── */}
            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : remessasFiltradas.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">🚚</div><div className="empty-state-title">Nenhuma remessa encontrada</div></div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Parceiro</th>
                                    <th>Data</th>
                                    <th>Itens</th>
                                    <th>Qtd. Total</th>
                                    <th>Vlr. Ref. Total</th>
                                    <th>Status</th>
                                    <th style={{ width: 160 }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {remessasFiltradas.map((r) => {
                                    const { qtd, vlr } = totais(r.itens)
                                    const badge = statusBadge[r.status] ?? statusBadge.RASCUNHO
                                    return (
                                        <Fragment key={r.id}>
                                            <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                                                <td className="font-medium">{r.parceiro.nome}</td>
                                                <td className="text-sm">{new Date(r.dataEnvio).toLocaleDateString('pt-BR')}</td>
                                                <td><span className="badge badge-neutral">{r.itens.length} produto(s)</span></td>
                                                <td className="font-medium">{qtd.toFixed(3)}</td>
                                                <td>{vlr > 0 ? <span style={{ color: 'var(--color-success)' }}>R$ {vlr.toFixed(2)}</span> : <span className="text-muted">—</span>}</td>
                                                <td><span className={`badge ${badge.cls}`}>{badge.icon} {badge.label}</span></td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <div className="table-actions">
                                                        <span className="text-muted text-sm" style={{ fontSize: 10 }}>{expandedId === r.id ? '▲' : '▼'}</span>

                                                        {/* Marcar como Enviada */}
                                                        {r.status === 'EM_SEPARACAO' && (
                                                            <button
                                                                className="btn btn-sm"
                                                                style={{ fontSize: 11, background: 'var(--color-success)', color: '#fff', border: 'none' }}
                                                                title="Marcar como Enviada"
                                                                onClick={() => marcarEnviada(r)}
                                                                id={`btn-enviada-${r.id}`}
                                                            >
                                                                ✅ Enviada
                                                            </button>
                                                        )}

                                                        {/* Editar */}
                                                        <button className="btn-icon" title="Editar" onClick={() => openEdit(r)} id={`btn-editar-${r.id}`}>
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                        </button>

                                                        {/* Excluir */}
                                                        <button className="btn-icon" title="Excluir" style={{ color: 'var(--color-danger)' }} onClick={() => excluirRemessa(r)} id={`btn-excluir-${r.id}`}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* ── Linha expandida ── */}
                                            {expandedId === r.id && (
                                                <tr key={`${r.id}-d`}>
                                                    <td colSpan={7} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                                                        <table className="table" style={{ margin: 0 }}>
                                                            <thead>
                                                                <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                                                                    <th style={{ paddingLeft: 48 }}>Produto</th>
                                                                    <th>Unidade</th>
                                                                    <th style={{ textAlign: 'right' }}>Qtd.</th>
                                                                    <th style={{ textAlign: 'right' }}>Vlr. Unit. Ref.</th>
                                                                    <th style={{ textAlign: 'right' }}>Vlr. Total Ref.</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {r.itens.map((it, i) => (
                                                                    <tr key={i}>
                                                                        <td style={{ paddingLeft: 48 }}>{it.produto.nome}</td>
                                                                        <td className="text-muted text-sm">{it.produto.unidadeMedida}</td>
                                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(it.quantidade).toFixed(3)}</td>
                                                                        <td style={{ textAlign: 'right' }}>{it.valorReferencia ? `R$ ${Number(it.valorReferencia).toFixed(2)}` : '—'}</td>
                                                                        <td style={{ textAlign: 'right' }}>
                                                                            {it.valorReferencia
                                                                                ? <span style={{ color: 'var(--color-success)' }}>R$ {(Number(it.valorReferencia) * Number(it.quantidade)).toFixed(2)}</span>
                                                                                : <span className="text-muted">—</span>}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                            {/* ── Linha totalizadora ── */}
                                                            <tfoot>
                                                                <tr style={{ borderTop: '2px solid var(--color-border)', background: 'rgba(0,0,0,0.04)', fontWeight: 700 }}>
                                                                    <td style={{ paddingLeft: 48, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>TOTAL</td>
                                                                    <td />
                                                                    <td style={{ textAlign: 'right' }}>{totais(r.itens).qtd.toFixed(3)}</td>
                                                                    <td />
                                                                    <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                                                                        {totais(r.itens).vlr > 0 ? `R$ ${totais(r.itens).vlr.toFixed(2)}` : '—'}
                                                                    </td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                        {r.observacoes && (
                                                            <div style={{ padding: '8px 48px 12px', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                                                                <strong>Obs:</strong> {r.observacoes}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Modal: Nova Remessa ── */}
            {showModal && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal modal-xl" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">🚚 Nova Remessa</h2>
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
                            <ItemEditor
                                itens={itens} setItens={setItens}
                                produtos={produtos}
                                addItem={() => addItem(itens, setItens)}
                                removeItem={(i) => removeItem(itens, setItens, i)}
                                updateItem={(i, f, v) => updateItem(itens, setItens, i, f, v)}
                            />
                            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                                <label className="form-label">Observações</label>
                                <textarea className="form-control" rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !form.parceiroId || itens.every(i => !i.produtoId)} id="btn-salvar-remessa">
                                {saving ? 'Registrando...' : '🚚 Registrar Remessa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Editar Remessa ── */}
            {editando && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditando(null)}>
                    <div className="modal modal-xl" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">✏️ Editar Remessa — {editando.parceiro.nome}</h2>
                            <button className="btn-icon" onClick={() => setEditando(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)' }}>
                                ⚠️ Alterações nos produtos ou quantidades ajustarão o estoque automaticamente com base na diferença.
                            </div>
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Data do envio</label>
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
                            <hr className="divider" />
                            <ItemEditor
                                itens={editItens} setItens={setEditItens}
                                produtos={produtos}
                                addItem={() => addItem(editItens, setEditItens)}
                                removeItem={(i) => removeItem(editItens, setEditItens, i)}
                                updateItem={(i, f, v) => updateItem(editItens, setEditItens, i, f, v)}
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={salvarEdicao} disabled={editSaving || !editForm.dataEnvio} id="btn-salvar-edicao-remessa">
                                {editSaving ? 'Salvando...' : '💾 Salvar e Ajustar Estoque'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Sub-componente reutilizável: editor de itens ───────────────────────────────
type ItemEditorProps = {
    itens: RemessaItem[]
    setItens: (v: RemessaItem[]) => void
    produtos: Produto[]
    addItem: () => void
    removeItem: (i: number) => void
    updateItem: (i: number, field: keyof RemessaItem, value: string | number) => void
}

function ItemEditor({ itens, produtos, addItem, removeItem, updateItem }: ItemEditorProps) {
    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <strong style={{ fontSize: 'var(--text-sm)' }}>Produtos</strong>
                <button className="btn btn-secondary btn-sm" onClick={addItem} type="button">+ Adicionar produto</button>
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
                            <input className="form-control" type="number" step="0.01" value={item.valorReferencia}
                                onChange={e => updateItem(idx, 'valorReferencia', e.target.value)}
                                placeholder={prod?.precoPadrao ? String(prod.precoPadrao) : '0.00'} />
                        </div>
                        {itens.length > 1 ? (
                            <button className="btn-icon" type="button" style={{ color: 'var(--color-danger)', marginTop: idx === 0 ? 22 : 0 }} onClick={() => removeItem(idx)}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                            </button>
                        ) : <div />}
                    </div>
                )
            })}
        </>
    )
}
