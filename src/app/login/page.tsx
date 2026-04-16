'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)
        const res = await signIn('credentials', {
            email, password, redirect: false,
        })
        setLoading(false)
        if (res?.error) {
            setError('Email ou senha inválidos.')
        } else {
            router.push('/admin')
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg-dark)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Decorative background */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `
          radial-gradient(ellipse at 20% 50%, rgba(197,160,89,0.12) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 20%, rgba(197,160,89,0.08) 0%, transparent 50%)
        `,
                pointerEvents: 'none',
            }} />

            <div style={{ position: 'relative', width: '100%', maxWidth: '420px', padding: 'var(--space-4)' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
                    <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '3.5rem',
                        color: 'var(--color-accent)',
                        letterSpacing: '4px',
                        lineHeight: 1,
                    }}>
                        HAUXHAUX
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)', letterSpacing: '3px', textTransform: 'uppercase' }}>
                        Sistema de Gestão
                    </div>
                </div>

                {/* Card */}
                <div style={{
                    background: 'var(--color-bg-card)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-8)',
                    boxShadow: 'var(--shadow-xl)',
                    border: '1px solid rgba(197,160,89,0.2)',
                }}>
                    <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-6)', textAlign: 'center', fontFamily: 'var(--font-display)' }}>
                        Entrar
                    </h1>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label required">E-mail</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="form-control"
                                placeholder="seu@email.com"
                                required
                                autoFocus
                                autoComplete="email"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label required">Senha</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="form-control"
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <div className="alert alert-danger" role="alert">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg w-full"
                            disabled={loading}
                            style={{ marginTop: 'var(--space-2)' }}
                        >
                            {loading ? (
                                <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Entrando...</>
                            ) : (
                                'Entrar'
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', color: 'rgba(255,255,255,0.25)', fontSize: 'var(--text-xs)' }}>
                    © 2025 HAUXHAUX • Todos os direitos reservados
                </p>
            </div>
        </div>
    )
}
