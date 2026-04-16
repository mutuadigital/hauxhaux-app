'use client'

type StepperProps = {
    value: number
    onChange: (v: number) => void
    min?: number
    max?: number
    disabled?: boolean
}

/** Large +/- stepper with an editable number input for integer quantity fields */
export function Stepper({ value, onChange, min = 0, max, disabled = false }: StepperProps) {
    const canDec = !disabled && value > min
    const canInc = !disabled && (max === undefined || value < max)

    function handleInput(raw: string) {
        const n = parseInt(raw, 10)
        if (isNaN(n)) return
        const clamped = max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n)
        onChange(clamped)
    }

    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 0,
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
            overflow: 'hidden', background: 'var(--color-bg-card)',
        }}>
            <button
                type="button"
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={!canDec}
                aria-label="Diminuir"
                style={{
                    width: 44, height: 44, fontSize: '1.5rem', fontWeight: 700, lineHeight: 1,
                    background: 'transparent', border: 'none', borderRight: '1px solid var(--color-border)',
                    cursor: canDec ? 'pointer' : 'not-allowed',
                    color: canDec ? 'var(--color-text)' : 'var(--color-border)',
                    transition: 'background 0.15s', userSelect: 'none', flexShrink: 0,
                }}
                onMouseEnter={e => { if (canDec) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >−</button>

            <input
                type="number"
                value={value}
                min={min}
                max={max}
                disabled={disabled}
                onChange={e => handleInput(e.target.value)}
                onBlur={e => handleInput(e.target.value)}
                style={{
                    width: 58, height: 44, textAlign: 'center', fontWeight: 700,
                    fontSize: 'var(--text-base)', border: 'none', outline: 'none',
                    background: 'transparent', color: disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
                    /* hide arrows */
                    MozAppearance: 'textfield',
                }}
            />

            <button
                type="button"
                onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
                disabled={!canInc}
                aria-label="Aumentar"
                style={{
                    width: 44, height: 44, fontSize: '1.5rem', fontWeight: 700, lineHeight: 1,
                    background: 'transparent', border: 'none', borderLeft: '1px solid var(--color-border)',
                    cursor: canInc ? 'pointer' : 'not-allowed',
                    color: canInc ? 'var(--color-text)' : 'var(--color-border)',
                    transition: 'background 0.15s', userSelect: 'none', flexShrink: 0,
                }}
                onMouseEnter={e => { if (canInc) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >+</button>
        </div>
    )
}
