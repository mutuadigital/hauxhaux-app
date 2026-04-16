'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { Stepper } from '@/components/Stepper'

type Produto = { id: string; nome: string; unidadeMedida: string; precoPadrao: number; estoque?: { quantidadeAtual: number } | null }
type ItemForm = { produtoId: string; quantidade: number; valorUnit: number }
type VendaDiretaItemType = { id: string; produto: { nome: string; unidadeMedida: string }; quantidade: number; valorUnit: number; valorTotal: number }
type VendaDireta = {
    id: string
    dataVenda: string
    clienteNome?: string | null
    valorTotal: number
    itens: VendaDiretaItemType[]
    contasReceber: { id: string; status: string; saldoAberto: number }[]
}

export default function VendasDiretasPage() {
    const [vendas, setVendas] = useState<VendaDireta[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [clienteNome, setClienteNome] = useState('')
    const [clienteDoc, setClienteDoc] = useState('')
    const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0])
    const [obs, setObs] = useState('')
    const [itens, setItens] = useState<ItemForm[]>([{ produtoId: '', quantidade: 1, valorUnit: 0 }])
    const [erro, setErro] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setErro(null)
        try {
            const [r1, r2] = await Promise.all([
                fetch('/api/vendas-diretas'),
                fetch('/api/produtos'),
            ])
            if (!r1.ok) throw new Error(`Vendas: ${r1.status}`)
            if (!r2.ok) throw new Error(`Produtos: ${r2.status}`)
            const [vendasData, produtosData] = await Promise.all([r1.json(), r2.json()])
            setVendas(Array.isArray(vendasData) ? vendasData : [])
            setProdutos(Array.isArray(produtosData) ? produtosData : [])
        } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro ao carregar dados')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    function openModal() {
        setClienteNome(''); setClienteDoc(''); setObs(''); setDataVenda(new Date().toISOString().split('T')[0])
        setItens([{ produtoId: '', quantidade: 1, valorUnit: 0 }])
        setShowModal(true)
    }

    function setItemProduto(idx: number, produtoId: string) {
        const prod = produtos.find(p => p.id === produtoId)
        setItens(prev => { const n = [...prev]; n[idx] = { ...n[idx], produtoId, valorUnit: prod ? Number(prod.precoPadrao) : 0 }; return n })
    }

    function setItemQtd(idx: number, quantidade: number) {
        setItens(prev => { const n = [...prev]; n[idx] = { ...n[idx], quantidade }; return n })
    }

    function setItemValor(idx: number, valorUnit: number) {
        setItens(prev => { const n = [...prev]; n[idx] = { ...n[idx], valorUnit }; return n })
    }

    const totalVenda = itens.filter(i => i.produtoId).reduce((s, i) => s + i.quantidade * i.valorUnit, 0)

    async function save() {
        setSaving(true)
        const res = await fetch('/api/vendas-diretas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dataVenda,
                clienteNome: clienteNome || null,
                clienteDoc: clienteDoc || null,
                observacoes: obs || null,
                itens: itens.filter(i => i.produtoId && i.quantidade > 0).map(i => ({
                    produtoId: i.produtoId,
                    quantidade: i.quantidade,
                    valorUnit: i.valorUnit,
                })),
            }),
        })
        setSaving(false)
        if (!res.ok) { const e = await res.json(); alert(e.error || 'Erro'); return }
        setShowModal(false); load()
    }

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
                            <thead><tr><th style={{ width: 28 }} /><th>Data</th><th>Cliente</th><th>Produtos</th><th>Total</th><th>Cobrança</th></tr></thead>
                            <tbody>
                                {vendas.map(v => {
                                    const expanded = expandedId === v.id
                                    const conta = v.contasReceber[0]
                                    return (
                                        <Fragment key={v.id}>
                                            <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : v.id)}>
                                                <td className="text-muted text-sm text-center">{expanded ? '▲' : '▼'}</td>
                                                <td className="text-sm">{new Date(v.dataVenda).toLocaleDateString('pt-BR')}</td>
                                                <td className="font-medium">{v.clienteNome || <span className="text-muted">—</span>}</td>
                                                <td><span className="badge badge-neutral">{v.itens.length} produto(s)</span></td>
                                                <td className="font-medium" style={{ color: 'var(--color-accent)' }}>R$ {Number(v.valorTotal).toFixed(2)}</td>
                                                <td>
                                                    {conta ? (
                                                        <span className={`badge ${conta.status === 'RECEBIDO' ? 'badge-success' : 'badge-warning'}`}>
                                                            {conta.status.replace('_', ' ')} — R$ {Number(conta.saldoAberto).toFixed(2)}
                                                        </span>
                                                    ) : <span className="text-muted text-xs">—</span>}
                                                </td>
                                            </tr>
                                            {expanded && (
                                                <tr><td colSpan={6} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                                                    <table className="table" style={{ margin: 0 }}>
                                                        <thead><tr><th style={{ paddingLeft: 48 }}>Produto</th><th>Qtd.</th><th>Vlr. Unit.</th><th>Total</th></tr></thead>
                                                        <tbody>
                                                            {v.itens.map(it => (
                                                                <tr key={it.id}>
                                                                    <td style={{ paddingLeft: 48 }} className="font-medium">{it.produto.nome}</td>
                                                                    <td>{Math.round(Number(it.quantidade))} {it.produto.unidadeMedida}</td>
                                                                    <td>R$ {Number(it.valorUnit).toFixed(2)}</td>
                                                                    <td className="font-medium" style={{ color: 'var(--color-accent)' }}>R$ {Number(it.valorTotal).toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
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

            {showModal && (
                <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal modal-xl" role="dialog">
                        <div className="modal-header">
                            <h2 className="modal-title">Nova Venda Direta</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                                <div className="form-group">
                                    <label className="form-label">Cliente</label>
                                    <input className="form-control" value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome do cliente" autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">CPF / CNPJ</label>
                                    <input className="form-control" value={clienteDoc} onChange={e => setClienteDoc(e.target.value)} placeholder="Opcional" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Data da venda</label>
                                    <input className="form-control" type="date" value={dataVenda} onChange={e => setDataVenda(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <input className="form-control" value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" />
                                </div>
                            </div>

                            <hr className="divider" />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <strong style={{ fontSize: 'var(--text-sm)' }}>Produtos</strong>
                                <button className="btn btn-secondary btn-sm" onClick={() => setItens(i => [...i, { produtoId: '', quantidade: 1, valorUnit: 0 }])}>+ Produto</button>
                            </div>

                            {/* Column headers */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr auto 140px 90px auto', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', paddingRight: 'var(--space-1)' }}>
                                {['Produto', 'Quantidade', 'Vlr. Unit. (R$)', 'Subtotal', ''].map((h, i) => (
                                    <div key={i} className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{h}</div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                {itens.map((item, idx) => {
                                    const prod = produtos.find(p => p.id === item.produtoId)
                                    const saldo = Math.floor(Number(prod?.estoque?.quantidadeAtual ?? 999))
                                    return (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.5fr auto 140px 90px auto', gap: 'var(--space-3)', alignItems: 'start' }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <select className="form-control" value={item.produtoId} onChange={e => setItemProduto(idx, e.target.value)}>
                                                    <option value="">Selecionar produto…</option>
                                                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.unidadeMedida})</option>)}
                                                </select>
                                                {produtos.length === 0 && !loading && <div className="text-xs" style={{ color: 'var(--color-danger)', marginTop: 4 }}>Sem produtos cadastrados</div>}
                                            </div>
                                            <div>
                                                <Stepper
                                                    value={item.quantidade}
                                                    onChange={v => setItemQtd(idx, v)}
                                                    min={1}
                                                    max={saldo}
                                                    disabled={!item.produtoId}
                                                />
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <input
                                                    className="form-control"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={item.valorUnit}
                                                    onChange={e => setItemValor(idx, parseFloat(e.target.value) || 0)}
                                                    style={{ textAlign: 'right' }}
                                                    disabled={!item.produtoId}
                                                />
                                            </div>
                                            <div style={{ fontWeight: 700, textAlign: 'right', lineHeight: '46px', color: item.produtoId ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                                                {item.produtoId ? `R$ ${(item.quantidade * item.valorUnit).toFixed(2)}` : '—'}
                                            </div>
                                            <button
                                                className="btn-icon"
                                                style={{ color: 'var(--color-danger)', marginTop: 2 }}
                                                onClick={() => setItens(i => i.filter((_, j) => j !== idx))}
                                                disabled={itens.length === 1}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>

                            <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-3) var(--space-4)', background: 'rgba(197,160,89,0.08)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(197,160,89,0.2)' }}>
                                <span className="text-sm text-muted">Sem comissão — valor integral para a HauxHaux</span>
                                <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--color-accent)' }}>Total: R$ {totalVenda.toFixed(2)}</span>
                            </div>
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
        </div>
    )
}
