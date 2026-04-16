'use client'
import { signOut } from 'next-auth/react'

export function SignOutButton() {
    return (
        <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn btn-sm btn-ghost"
            style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)' }}
        >
            Sair
        </button>
    )
}
