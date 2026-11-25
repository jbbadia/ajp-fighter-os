import { useState } from 'react'
import { z } from 'zod'
import { LogIn, UserPlus } from 'lucide-react'
import { login, register } from '@/data/auth'
import { ApiError } from '@/data/http'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { Alert } from '@/components/ui/misc'
import { validate, type FieldErrors } from '@/lib/validation'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const schema = z.object({
      name: mode === 'register' ? z.string().trim().min(1, 'Indica tu nombre').max(60) : z.string(),
      email: z.email('Email no válido'),
      password: mode === 'register'
        ? z.string().min(8, 'Mínimo 8 caracteres').max(100).regex(/[A-Za-z]/, 'Debe incluir letras').regex(/\d/, 'Debe incluir números')
        : z.string().min(1, 'Introduce la contraseña'),
    })
    const r = validate(schema, { ...f, email: f.email.trim() })
    if (!r.ok) return setErrors(r.errors)
    setErrors({})
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') await login(r.data.email, f.password)
      else await register(r.data.name, r.data.email, f.password)
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors)
        setError(e.status === 0 ? 'No se puede conectar con el servidor. ¿Está arrancado el backend?' : e.message)
      } else setError('Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary font-display text-xl font-bold text-primary-foreground">AJP</div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-wide">FIGHTER OS</h1>
          <p className="text-sm text-muted-foreground">{mode === 'login' ? 'Inicia sesión para continuar tu preparación' : 'Crea tu cuenta de deportista'}</p>
        </div>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          {error && <Alert severity="critical" title={error} />}
          {mode === 'register' && (
            <Field label="Nombre" htmlFor="au-name" error={errors.name}>
              <Input id="au-name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
          )}
          <Field label="Email" htmlFor="au-email" error={errors.email}>
            <Input id="au-email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Contraseña" htmlFor="au-pass" error={errors.password} hint={mode === 'register' ? 'Mínimo 8 caracteres, con letras y números' : undefined}>
            <Input id="au-pass" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {mode === 'login' ? <><LogIn /> Entrar</> : <><UserPlus /> Crear cuenta</>}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline cursor-pointer"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setErrors({})
              setError(null)
            }}
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
