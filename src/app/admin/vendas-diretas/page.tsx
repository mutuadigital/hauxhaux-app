'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { Stepper } from '@/components/Stepper'

type ClienteCRM = { id: string; nome: string; documento?: string | null; telefone?: string | null }
type Produto = { id: string; nome: string; unidadeMedida: string; precoPadrao: number; estoque?: { quantidadeAtual: number } | null }
type ItemForm = { produtoId: string; quantidade: number; valorUnit: number }
type VendaDiretaItemType = { id: string; produto: { nome: string; unidadeMedida: string }; quantidade: number; valorUnit: number; valorTotal: number }
type VendaDireta = {
    id: string; dataVenda: string; clienteId?: string | null; clienteNome?: string | null
    desconto: number; valorFrete: number; valorTotal: number
    itens: VendaDiretaItemType[]; contasReceber: { id: string; status: string; saldoAberto: number }[]
    cliente?: { id: string; nome: string; documento?: string | null } | null
}

export default function VendasDiretasPage() {
    const [vendas, setVendas] = useState<VendaDireta[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [clientes, setClientes] = useState<ClienteCRM[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [clienteId, setClienteId] = useState('')
    const [clienteNome, setClienteNome] = useState('')
    const [clienteDoc, setClienteDoc] = useState('')
    const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0])
    const [obs, setObs] = useState('')
    const [desconto, setDesconto] = useState(0)
    const [valorFrete, setValorFrete] = useState(0)
    const [itens, setItens] = useState<ItemForm[]>([{ produtoId: '', quantidade: 1, valorUnit: 0 }])
    const [erro, setErro] = useState<string | null>(null)
    const [editando, setEditando] = useState<VendaDireta | null>(null)
    const [editItens, setEditItens] = useState<ItemForm[]>([])
    const [editNome, setEditNome] = useState('')
    const [editDoc, setEditDoc] = useState('')
    const [editData, setEditData] = useState('')
    const [editObs, setEditObs] = useState('')
    const [editDesconto, setEditDesconto] = useState(0)
    const [editFrete, setEditFrete] = useState(0)
    const [editClienteId, setEditClienteId] = useState('')
    const [editSaving, setEditSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true); setErro(null)
        try {
            const [r1, r2, r3] = await Promise.all([fetch('/api/vendas-diretas'), fetch('/api/produtos'), fetch('/api/clientes')])
            if (!r1.ok) throw new Error(`Vendas: ${r1.status}`)
            setVendas(Array.isArray(await r1.clone().json()) ? await r1.json() : [])
            setProdutos(Array.isArray(await r2.clone().json()) ? await r2.json() : [])
            setClientes(Array.isArray(await r3.clone().json()) ? await r3.json() : [])
        } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao carregar dados') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    function handleClienteSelect(id: string) {
        setClienteId(id)
        const c = clientes.find(x => x.id === id)
        if (c) { setClienteNome(c.nome); setClienteDoc(c.documento || '') }
    }

    function openModal() {
        setClienteId(''); setClienteNome(''); setClienteDoc(''); setObs('')
        setDataVenda(new Date().toISOString().split('T')[0])
        setDesconto(0); setValorFrete(0)
        setItens([{ produtoId: '', quantidade: 1, valorUnit: 0 }])
        setShowModal(true)
    }

    function setItemProduto(idx: number, produtoId: string) {
        const prod = produtos.find(p => p.id === produtoId)
        setItens(prev => { const n = [...prev]; n[idx] = { ...n[idx], produtoId, valorUnit: prod ? Number(prod.precoPadrao) : 0 }; return n })
    }

    const subtotal = itens.filter(i => i.produtoId).reduce((s, i) => s + i.quantidade * i.valorUnit, 0)
    const totalVenda = subtotal - desconto + valorFrete

    async function save() {
        setSaving(true)
        const res = await fetch('/api/vendas-diretas', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dataVenda, clienteId: clienteId || null, clienteNome: clienteNome || null,
                clienteDoc: clienteDoc || null, observacoes: obs || null, desconto, valorFrete,
                itens: itens.filter(i => i.produtoId && i.quantidade > 0).map(i => ({ produtoId: i.produtoId, quantidade: i.quantidade, valorUnit: i.valorUnit })),
            }),
        })
        setSaving(false)
        if (!res.ok) { const e = await res.json(); alert(e.error || 'Erro'); return }
        setShowModal(false); load()
    }

    async function removeVenda(id: string) {
        if (!confirm('Excluir esta venda? A cobrança associada será cancelada e o estoque devolvido.')) return
        await fetch(`/api/vendas-diretas/${id}`, { method: 'DELETE' }); load()
    }

    function openEdit(v: VendaDireta) {
        setEditando(v); setEditNome(v.clienteNome || ''); setEditDoc(''); setEditObs('')
        setEditData(new Date(v.dataVenda).toISOString().split('T')[0])
        setEditDesconto(Number(v.desconto) || 0); setEditFrete(Number(v.valorFrete) || 0)
        setEditClienteId(v.clienteId || '')
        setEditItens(v.itens.map(it => {
            const prod = produtos.find(p => p.nome === it.produto.nome)
            return { produtoId: prod?.id ?? '', quantidade: Math.round(Number(it.quantidade)), valorUnit: Number(it.valorUnit) }
        }))
    }

    async function salvarEdicao() {
        if (!editando) return
        setEditSaving(true)
        const res = await fetch(`/api/vendas-diretas/${editando.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dataVenda: editData, clienteId: editClienteId || null,
                clienteNome: editNome || null, clienteDoc: editDoc || null,
                observacoes: editObs || null, desconto: editDesconto, valorFrete: editFrete,
                itens: editItens.filter(i => i.produtoId && i.quantidade > 0),
            }),
        })
        setEditSaving(false)
        if (!res.ok) { const e = await res.json(); alert(e.error || 'Erro'); return }
        setEditando(null); load()
    }

    const editSubtotal = editItens.filter(i => i.produtoId).reduce((s, i) => s + i.quantidade * i.valorUnit, 0)
    const totalEditItens = editSubtotal - editDesconto + editFrete

    // Helper to render product item rows
    const renderItemRow = (item: ItemForm, idx: number, items: ItemForm[], setItems: (fn: (prev: ItemForm[]) => ItemForm[]) => void, isEdit = false) => {
        const prod = produtos.find(p => p.id === item.produtoId)
        const saldo = Math.floor(Number(prod?.estoque?.quantidadeAtual ?? 999))
        return (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.5fr auto 140px 90px auto', gap: 'var(--space-3)', alignItems: 'start' }}>
                <div className="form-group" style={{ margin: 0 }}>
                    <select className="form-control" value={item.produtoId} onChange={e => {
                        const p = produtos.find(x => x.id === e.target.value)
                        setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], produtoId: e.target.value, valorUnit: p ? Number(p.precoPadrao) : n[idx].valorUnit }; return n })
                    }}>
                        <option value="">Selecionar produto…</option>
                        {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.unidadeMedida})</option>)}
                    </select>
                </div>
                <Stepper value={item.quantidade} onChange={v => setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], quantidade: v }; return n })} min={1} max={isEdit ? undefined : saldo} disabled={!item.produtoId} />
                <div className="form-group" style={{ margin: 0 }}>
                    <input className="form-control" type="number" step="0.01" min="0" value={item.valorUnit}
                        onChange={e => setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], valorUnit: parseFloat(e.target.value) || 0 }; return n })}
                        style={{ textAlign: 'right' }} disabled={!item.produtoId} />
                </div>
                <div style={{ fontWeight: 700, textAlign: 'right', lineHeight: '46px', color: item.produtoId ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                    {item.produtoId ? `R$ ${(item.quantidade * item.valorUnit).toFixed(2)}` : '—'}
                </div>
                <button className="btn-icon" style={{ color: 'var(--color-danger)', marginTop: 2 }}
                    onClick={() => setItems(i => i.filter((_, j) => j !== idx))} disabled={items.length === 1}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                </button>
            </div>
        )
    }

    // Breakdown footer component
    const renderBreakdown = (sub: number, disc: number, frete: number, total: number) => (
        <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-3) var(--space-4)', background: 'rgba(197,160,89,0.08)', borderRadius: 'var(--radius)', border: '1px solid rgba(197,160,89,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div className="text-sm text-muted" style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <span>Subtotal: <strong>R$ {sub.toFixed(2)}</strong></span>
                    {disc > 0 && <span style={{ color: 'var(--color-success)' }}>Desconto: <strong>−R$ {disc.toFixed(2)}</strong></span>}
                    {frete > 0 && <span>Frete: <strong>+R$ {frete.toFixed(2)}</strong></span>}
                </div>
                <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--color-accent)' }}>Total: R$ {total.toFixed(2)}</span>
            </div>
        </div>
    )

    // Client selector component
    const renderClienteSelector = (cId: string, setCId: (v: string) => void, nome: string, setNome: (v: string) => void, doc: string, setDoc: (v: string) => void) => (
        <>
            <div className="form-group">
                <label className="form-label">Cliente cadastrado</label>
                <select className="form-control" value={cId} onChange={e => {
                    setCId(e.target.value)
                    const c = clientes.find(x => x.id === e.target.value)
                    if (c) { setNome(c.nome); setDoc(c.documento || '') } else { setNome(''); setDoc('') }
                }}>
                    <option value="">Selecionar ou digitar abaixo…</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.documento ? ` (${c.documento})` : ''}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label className="form-label">Nome do cliente</label>
                <input className="form-control" value={nome} onChange={e => { setNome(e.target.value); if (cId) setCId('') }} placeholder="Nome do cliente" />
            </div>
            <div className="form-group">
                <label className="form-label">CPF / CNPJ</label>
                <input className="form-control" value={doc} onChange={e => setDoc(e.target.value)} placeholder="Opcional" />
            </div>
        </>
    )

    return (
        <div className="page-body anim-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Vendas Diretas</h1>
                    <p className="page-header-sub">Vendas ao cliente final — sem comissão, valor integral para a HauxHaux</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={openModal} id="btn-nova-venda-direta">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nova Venda
                    </button>
                </div>
            </div>

            {erro && <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>❌ {erro}</div>}

            <div className="card">
                <div className="table-wrapper">
                    {loading ? <div className="loading-center"><div className="spinner" /></div> : vendas.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">🛍</div><div className="empty-state-title">Nenhuma venda direta</div><div className="empty-state-desc">Registre vendas realizadas diretamente a clientes finais.</div></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th style={{ width: 28 }} /><th>Data</th><th>Cliente</th><th>Produtos</th><th>Desc.</th><th>Frete</th><th>Total</th><th>Cobrança</th><th style={{ width: 60 }}>Ações</th></tr></thead>
                            <tbody>
                                {vendas.map(v => {
                                    const expanded = expandedId === v.id
                                    const conta = v.contasReceber[0]
                                    return (
                                        <Fragment key={v.id}>
                                            <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : v.id)}>
                                                <td className="text-muted text-sm text-center">{expanded ? '▲' : '▼'}</td>
                                                <td className="text-sm">{new Date(v.dataVenda).toLocaleDateString('pt-BR')}</td>
                                                <td className="font-medium">{v.cliente?.nome || v.clienteNome || <span className="text-muted">—</span>}</td>
                                                <td><span className="badge badge-neutral">{v.itens.length} produto(s)</span></td>
                                                <td className="text-sm">{Number(v.desconto) > 0 ? <span style={{ color: 'var(--color-success)' }}>−R$ {Number(v.desconto).toFixed(2)}</span> : <span className="text-muted">—</span>}</td>
                                                <td className="text-sm">{Number(v.valorFrete) > 0 ? `R$ ${Number(v.valorFrete).toFixed(2)}` : <span className="text-muted">—</span>}</td>
                                                <td className="font-medium" style={{ color: 'var(--color-accent)' }}>R$ {Number(v.valorTotal).toFixed(2)}</td>
                                                <td>{conta ? <span className={`badge ${conta.status === 'RECEBIDO' ? 'badge-success' : 'badge-warning'}`}>{conta.status.replace('_', ' ')}</span> : <span className="text-muted text-xs">—</span>}</td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <div className="table-actions">
                                                        <button className="btn-icon" title="Editar" onClick={() => openEdit(v)}>
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                        </button>
                                                        <button className="btn-icon" title="Excluir" onClick={() => removeVenda(v.id)} style={{ color: 'var(--color-danger)' }}>
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expanded && (
                                                <tr><td colSpan={9} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                                                    <table className="table" style={{ margin: 0 }}>
                                                        <thead><tr><th style={{ paddingLeft: 48 }}>Produto</th><th>Qtd.</th><th>Vlr. Unit.</th><th>Total</th></tr></thead>
                                                        <tbody>{v.itens.map(it => (
                                                            <tr key={it.id}>
                                                                <td style={{ paddingLeft: 48 }} className="font-medium">{it.produto.nome}</td>
                                                                <td>{Math.round(Number(it.quantidade))} {it.produto.unidadeMedida}</td>
                                                                <td>R$ {Number(it.valorUnit).toFixed(2)}</td>
                                                                <td className="font-medium" style={{ color: 'var(--color-accent)' }}>R$ {Number(it.valorTotal).toFixed(2)}</td>
                                                            </tr>
                                                        ))}</tbody>
                                                    </table>
                                                </td></tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal modal-xl" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Nova Venda Direta</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                                {renderClienteSelector(clienteId, setClienteId, clienteNome, setClienteNome, clienteDoc, setClienteDoc)}
                                <div className="form-group">
                                    <label className="form-label">Data da venda</label>
                                    <input className="form-control" type="date" value={dataVenda} onChange={e => setDataVenda(e.target.value)} />
                                </div>
                            </div>
                            <hr className="divider" />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <strong style={{ fontSize: 'var(--text-sm)' }}>Produtos</strong>
                                <button className="btn btn-secondary btn-sm" onClick={() => setItens(i => [...i, { produtoId: '', quantidade: 1, valorUnit: 0 }])}>+ Produto</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr auto 140px 90px auto', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                                {['Produto', 'Quantidade', 'Vlr. Unit. (R$)', 'Subtotal', ''].map((h, i) => (
                                    <div key={i} className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{h}</div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                {itens.map((item, idx) => renderItemRow(item, idx, itens, setItens))}
                            </div>
                            <hr className="divider" style={{ margin: 'var(--space-4) 0' }} />
                            <div className="form-grid form-grid-3" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Desconto (R$)</label>
                                    <input className="form-control" type="number" step="0.01" min="0" value={desconto} onChange={e => setDesconto(parseFloat(e.target.value) || 0)} style={{ textAlign: 'right' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Frete (R$)</label>
                                    <input className="form-control" type="number" step="0.01" min="0" value={valorFrete} onChange={e => setValorFrete(parseFloat(e.target.value) || 0)} style={{ textAlign: 'right' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <input className="form-control" value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" />
                                </div>
                            </div>
                            {renderBreakdown(subtotal, desconto, valorFrete, totalVenda)}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving || !itens.some(i => i.produtoId && i.quantidade > 0)} id="btn-salvar-venda-direta">
                                {saving ? 'Registrando...' : `🛍 Confirmar — R$ ${totalVenda.toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editando && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditando(null)}>
                    <div className="modal modal-xl" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Editar Venda</h2>
                            <button className="btn-icon" onClick={() => setEditando(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                                {renderClienteSelector(editClienteId, setEditClienteId, editNome, setEditNome, editDoc, setEditDoc)}
                                <div className="form-group">
                                    <label className="form-label">Data da venda</label>
                                    <input className="form-control" type="date" value={editData} onChange={e => setEditData(e.target.value)} />
                                </div>
                            </div>
                            <hr className="divider" />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <strong style={{ fontSize: 'var(--text-sm)' }}>Produtos</strong>
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditItens(i => [...i, { produtoId: '', quantidade: 1, valorUnit: 0 }])}>+ Produto</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {editItens.map((item, idx) => renderItemRow(item, idx, editItens, setEditItens, true))}
                            </div>
                            <hr className="divider" style={{ margin: 'var(--space-4) 0' }} />
                            <div className="form-grid form-grid-3" style={{ gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Desconto (R$)</label>
                                    <input className="form-control" type="number" step="0.01" min="0" value={editDesconto} onChange={e => setEditDesconto(parseFloat(e.target.value) || 0)} style={{ textAlign: 'right' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Frete (R$)</label>
                                    <input className="form-control" type="number" step="0.01" min="0" value={editFrete} onChange={e => setEditFrete(parseFloat(e.target.value) || 0)} style={{ textAlign: 'right' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <input className="form-control" value={editObs} onChange={e => setEditObs(e.target.value)} placeholder="Opcional" />
                                </div>
                            </div>
                            {renderBreakdown(editSubtotal, editDesconto, editFrete, totalEditItens)}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={salvarEdicao} disabled={editSaving || !editItens.some(i => i.produtoId && i.quantidade > 0)}>
                                {editSaving ? 'Salvando...' : `✅ Salvar — R$ ${totalEditItens.toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
