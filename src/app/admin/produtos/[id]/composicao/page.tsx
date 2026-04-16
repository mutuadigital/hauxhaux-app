'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Insumo = { id: string; nome: string; unidadeMedida: string }
type ComposicaoItem = {
    id: string
    insumoId: string
    insumo: { nome: string; unidadeMedida: string }
    quantidadeBase: number
    unidadeMedida: string
    fatorPerda?: number | null
    ordem: number
}
type Composicao = {
    id: string
    nomeVersao: string
    ativo: boolean
    criadoEm: string
    observacoes?: string | null
    itens: ComposicaoItem[]
}
type Produto = { id: string; nome: string; codigo: string; unidadeMedida: string }

type ItemForm = { insumoId: string; quantidadeBase: string; fatorPerda: string; ordem: string }

export default function ComposicaoPage() {
    const { id: produtoId } = useParams<{ id: string }>()
    const router = useRouter()

    const [produto, setProduto] = useState<Produto | null>(null)
    const [composicoes, setComposicoes] = useState<Composicao[]>([])
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [form, setForm] = useState({ nomeVersao: 'Padrão', observacoes: '' })
    const [itens, setItens] = useState<ItemForm[]>([{ insumoId: '', quantidadeBase: '', fatorPerda: '', ordem: '0' }])

    const load = useCallback(async () => {
        setLoading(true)
        const [r1, r2, r3] = await Promise.all([
            fetch(`/api/produtos/${produtoId}`),
            fetch(`/api/produtos/${produtoId}/composicao`),
            fetch('/api/insumos'),
        ])
        if (r1.ok) setProduto(await r1.json())
        if (r2.ok) setComposicoes(await r2.json())
        if (r3.ok) setInsumos(await r3.json())
        setLoading(false)
    }, [produtoId])

    useEffect(() => { load() }, [load])

    function addItem() {
        setItens(i => [...i, { insumoId: '', quantidadeBase: '', fatorPerda: '', ordem: String(i.length) }])
    }
    function removeItem(idx: number) { setItens(i => i.filter((_, j) => j !== idx)) }
    function updateItem(idx: number, field: keyof ItemForm, value: string) {
        setItens(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n })
    }

    async function save() {
        setSaving(true)
        const payload = {
            nomeVersao: form.nomeVersao,
            observacoes: form.observacoes || null,
            itens: itens
                .filter(i => i.insumoId && parseFloat(i.quantidadeBase) > 0)
                .map((i, idx) => {
                    const ins = insumos.find(x => x.id === i.insumoId)
                    return {
                        insumoId: i.insumoId,
                        quantidadeBase: parseFloat(i.quantidadeBase),
                        unidadeMedida: ins?.unidadeMedida ?? '',
                        fatorPerda: i.fatorPerda ? parseFloat(i.fatorPerda) : null,
                        ordem: parseInt(i.ordem) || idx,
                    }
                }),
        }
        await fetch(`/api/produtos/${produtoId}/composicao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        setSaving(false)
        setShowModal(false)
        load()
    }

    if (loading) {
        return (
            <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div className="spinner" />
            </div>
        )
    }

    return (
        <div className="page-body anim-fade-in">
            {/* Breadcrumb */}
            <div style={{ marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                <button className="btn-icon" style={{ padding: 0 }} onClick={() => router.push('/admin/produtos')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span style={{ cursor: 'pointer' }} onClick={() => router.push('/admin/produtos')}>Produtos</span>
                <span>/</span>
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>{produto?.nome ?? '...'}</span>
                <span>/</span>
                <span>Composição Técnica</span>
            </div>

            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Composição Técnica</h1>
                    {produto && (
                        <p className="page-header-sub">
                            <span className="badge badge-neutral" style={{ marginRight: 8 }}>{produto.codigo}</span>
                            {produto.nome} — {produto.unidadeMedida}
                        </p>
                    )}
                </div>
                <div className="page-actions">
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setForm({ nomeVersao: 'Padrão', observacoes: '' })
                            setItens([{ insumoId: '', quantidadeBase: '', fatorPerda: '', ordem: '0' }])
                            setShowModal(true)
                        }}
                        id="btn-nova-composicao"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nova Versão
                    </button>
                </div>
            </div>

            {composicoes.length === 0 ? (
                <div className="card">
                    <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
                        <div className="empty-state-icon">🧪</div>
                        <div className="empty-state-title">Nenhuma composição técnica</div>
                        <div className="empty-state-desc">Crie a primeira versão para definir quais insumos são usados na produção deste produto.</div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {composicoes.map((comp) => (
                        <div key={comp.id} className="card">
                            <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === comp.id ? null : comp.id)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{comp.nomeVersao}</span>
                                    <span className={`badge ${comp.ativo ? 'badge-success' : 'badge-neutral'}`}>{comp.ativo ? 'Ativa' : 'Inativa'}</span>
                                    <span className="text-xs text-muted">{comp.itens.length} insumo(s)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <span className="text-xs text-muted">{new Date(comp.criadoEm).toLocaleDateString('pt-BR')}</span>
                                    <span className="text-muted text-sm">{expandedId === comp.id ? '▲' : '▼'}</span>
                                </div>
                            </div>

                            {expandedId === comp.id && (
                                <div className="card-body" style={{ padding: 0 }}>
                                    {comp.observacoes && (
                                        <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                            {comp.observacoes}
                                        </div>
                                    )}
                                    <div className="table-wrapper">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: 40 }}>Ord.</th>
                                                    <th>Insumo</th>
                                                    <th>Un. Medida</th>
                                                    <th>Qtd. Base</th>
                                                    <th>Fator Perda</th>
                                                    <th>Qtd. Efetiva</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {comp.itens.sort((a, b) => a.ordem - b.ordem).map((item) => {
                                                    const qtdEfetiva = Number(item.quantidadeBase) * (1 + (Number(item.fatorPerda) || 0))
                                                    return (
                                                        <tr key={item.id}>
                                                            <td className="text-muted text-sm text-center">{item.ordem}</td>
                                                            <td className="font-medium">{item.insumo.nome}</td>
                                                            <td className="text-sm">{item.unidadeMedida}</td>
                                                            <td>{Math.round(Number(item.quantidadeBase))}</td>
                                                            <td className="text-sm text-muted">
                                                                {item.fatorPerda ? (
                                                                    <span style={{ color: 'var(--color-warning)' }}>+{Math.round(Number(item.fatorPerda) * 100)}%</span>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="font-medium" style={{ color: 'var(--color-accent)' }}>
                                                                {Math.round(qtdEfetiva)}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Custo estimado */}
                                    <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.01)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                                        <span>{comp.itens.length} insumo(s) mapeados para 1 {produto?.unidadeMedida}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal criar nova versão */}
            {showModal && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal modal-xl" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Nova Composição Técnica</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Nome da versão</label>
                                    <input className="form-control" value={form.nomeVersao} onChange={e => setForm(f => ({ ...f, nomeVersao: e.target.value }))} placeholder="Ex: Padrão, v2, Verão 2025" autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <input className="form-control" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional" />
                                </div>
                            </div>

                            <hr className="divider" />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <div>
                                    <strong style={{ fontSize: 'var(--text-sm)' }}>Insumos necessários</strong>
                                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>Quantidades por 1 {produto?.unidadeMedida} de {produto?.nome}</div>
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Adicionar insumo</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {/* Header row */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 'var(--space-3)' }}>
                                    <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', paddingLeft: 2 }}>Insumo</div>
                                    <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Qtd. Base</div>
                                    <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Fator Perda</div>
                                    <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Ordem</div>
                                    <div style={{ width: 32 }} />
                                </div>

                                {itens.map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 'var(--space-3)', alignItems: 'center' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <select className="form-control" value={item.insumoId} onChange={e => updateItem(idx, 'insumoId', e.target.value)}>
                                                <option value="">Selecionar insumo…</option>
                                                {insumos.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidadeMedida})</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <input
                                                className="form-control"
                                                type="number"
                                                step="0.0001"
                                                min="0"
                                                value={item.quantidadeBase}
                                                onChange={e => updateItem(idx, 'quantidadeBase', e.target.value)}
                                                placeholder="0.0000"
                                            />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <input
                                                className="form-control"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={item.fatorPerda}
                                                onChange={e => updateItem(idx, 'fatorPerda', e.target.value)}
                                                placeholder="0.05 = 5%"
                                            />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <input
                                                className="form-control"
                                                type="number"
                                                min="0"
                                                value={item.ordem}
                                                onChange={e => updateItem(idx, 'ordem', e.target.value)}
                                            />
                                        </div>
                                        <button
                                            className="btn-icon"
                                            style={{ color: 'var(--color-danger)' }}
                                            onClick={() => removeItem(idx)}
                                            disabled={itens.length === 1}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Preview */}
                            {itens.some(i => i.insumoId && parseFloat(i.quantidadeBase) > 0) && (
                                <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-4)', background: 'rgba(197,160,89,0.06)', borderRadius: 'var(--radius)', border: '1px solid rgba(197,160,89,0.15)' }}>
                                    <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 'var(--space-3)' }}>Prévia</div>
                                    {itens.filter(i => i.insumoId && parseFloat(i.quantidadeBase) > 0).map((item, idx) => {
                                        const insumo = insumos.find(x => x.id === item.insumoId)
                                        const qtdBase = parseFloat(item.quantidadeBase) || 0
                                        const fator = parseFloat(item.fatorPerda) || 0
                                        const qtdEfetiva = qtdBase * (1 + fator)
                                        return (
                                            <div key={idx} style={{ fontSize: 'var(--text-sm)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                                                <span>• {insumo?.nome}</span>
                                                <span>
                                                    <span className="text-muted">{Math.round(qtdBase)} {insumo?.unidadeMedida}</span>
                                                    {fator > 0 && <span style={{ color: 'var(--color-accent)', marginLeft: 8 }}>→ {Math.round(qtdEfetiva)} (c/ perda)</span>}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                onClick={save}
                                disabled={saving || !form.nomeVersao || !itens.some(i => i.insumoId && parseFloat(i.quantidadeBase) > 0)}
                                id="btn-salvar-composicao"
                            >
                                {saving ? 'Salvando...' : '🧪 Salvar Composição'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
