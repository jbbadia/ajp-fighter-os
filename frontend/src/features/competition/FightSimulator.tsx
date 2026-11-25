import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Pause, Play, Save, SkipForward, Swords, Timer, Trash2 } from 'lucide-react'
import type { Modality, RoundResult, Simulation, SimulationRound } from '@/types/domain'
import { simulationStore, useProfile, useSimulations } from '@/data'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmButton } from '@/components/ui/tabs'
import { Field, Input, ScaleInput, Select, Textarea } from '@/components/ui/form'
import { Alert, EmptyState } from '@/components/ui/misc'
import { LineTrend } from '@/components/charts/TrendChart'
import { useToast } from '@/components/ui/toast'
import { RESULT_LABEL } from '@/domain/sessionMeta'
import { requiredNumber, validate, type FieldErrors } from '@/lib/validation'
import { fmt, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'

interface Config {
  rounds: number
  durationMin: number
  restMin: number
  modality: Modality
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function FightSimulator() {
  const profile = useProfile()
  const sims = useSimulations()
  const [config, setConfig] = useState({
    rounds: '3',
    durationMin: profile.rules.matchDurationMin ? String(profile.rules.matchDurationMin) : '',
    restMin: '2',
    modality: profile.competition.modalities[0] ?? ('gi' as Modality),
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [running, setRunning] = useState<Config | null>(null)
  const [viewing, setViewing] = useState<Simulation | null>(null)
  const sorted = [...sims].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const selected = viewing ?? sorted[0] ?? null

  const start = () => {
    const r = validate(
      z.object({
        rounds: requiredNumber('Rounds', 1, 20).refine(Number.isInteger, 'Número entero'),
        durationMin: requiredNumber('Duración del combate', 0.5, 30),
        restMin: requiredNumber('Descanso', 0, 30),
      }),
      // An empty duration falls back to the one saved in the competition rules.
      { ...config, durationMin: config.durationMin || String(profile.rules.matchDurationMin ?? '') },
    )
    if (!r.ok) return setErrors(r.errors)
    setErrors({})
    setRunning({ ...r.data, modality: config.modality })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Simulador de combate" description="Rounds consecutivos con descanso, a ritmo de competición" icon={<Swords />} />
        <CardContent className="space-y-4">
          {!profile.shoulder.intenseSparringAuthorized && (
            <Alert severity="warning" title="Sparring intenso sin autorización médica">
              Mientras no tengas autorización, realiza las simulaciones a intensidad controlada.
            </Alert>
          )}
          {!profile.rules.matchDurationMin && (
            <p className="text-xs text-muted-foreground">
              La duración del combate no se asume: introdúcela según el reglamento AJP de tu división o guárdala en «Reglamento».
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Rounds" htmlFor="fs-r" error={errors.rounds}>
              <Input id="fs-r" inputMode="numeric" value={config.rounds} onChange={(e) => setConfig({ ...config, rounds: e.target.value })} />
            </Field>
            <Field label="Duración (min)" htmlFor="fs-d" error={errors.durationMin}>
              <Input id="fs-d" inputMode="decimal" placeholder={profile.rules.matchDurationMin ? String(profile.rules.matchDurationMin) : 'Reglamento'} value={config.durationMin} onChange={(e) => setConfig({ ...config, durationMin: e.target.value })} />
            </Field>
            <Field label="Descanso (min)" htmlFor="fs-rest" error={errors.restMin}>
              <Input id="fs-rest" inputMode="decimal" value={config.restMin} onChange={(e) => setConfig({ ...config, restMin: e.target.value })} />
            </Field>
            <Field label="Modalidad" htmlFor="fs-m">
              <Select id="fs-m" value={config.modality} onChange={(e) => setConfig({ ...config, modality: e.target.value as Modality })}>
                <option value="gi">Gi</option>
                <option value="nogi">No-Gi</option>
              </Select>
            </Field>
          </div>
          <Button size="lg" className="w-full" onClick={start}><Play /> Iniciar simulación</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Evolución de la fatiga"
          description={selected ? `Simulación del ${fmt(selected.date, 'd MMM yyyy')} · ${selected.modality === 'gi' ? 'Gi' : 'No-Gi'}` : 'Por round'}
          icon={<Timer />}
          action={sorted.length > 1 && (
            <Select aria-label="Simulación" className="h-9 w-auto" value={selected?.id} onChange={(e) => setViewing(sims.find((s) => s.id === e.target.value) ?? null)}>
              {sorted.map((s) => <option key={s.id} value={s.id}>{fmt(s.date, 'd MMM')} · {s.rounds.length} rounds</option>)}
            </Select>
          )}
        />
        <CardContent>
          {!selected ? (
            <EmptyState icon={<Swords />} title="Sin simulaciones" description="Completa tu primera simulación para ver cómo evoluciona tu fatiga round a round." />
          ) : (
            <div className="space-y-3">
              {selected.rounds.filter((r) => r.fatigue !== null).length >= 2 ? (
                <LineTrend data={selected.rounds.map((r, i) => ({ label: `R${i + 1}`, value: r.fatigue ?? 0, value2: r.rpe }))} seriesNames={['Fatiga', 'RPE']} format={(v) => `${v}/10`} ariaLabel="Fatiga y RPE por round" />
              ) : (
                <p className="text-xs text-muted-foreground">Registra la fatiga en al menos 2 rounds para ver la curva.</p>
              )}
              <ul className="divide-y divide-border text-sm">
                {selected.rounds.map((r, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>Round {i + 1} · {r.durationMin} min</span>
                    <span className="text-xs text-muted-foreground">
                      {[r.result && RESULT_LABEL[r.result], r.rpe && `RPE ${r.rpe}`, r.fatigue && `Fatiga ${r.fatigue}`].filter(Boolean).join(' · ') || 'Sin datos'}
                    </span>
                  </li>
                ))}
              </ul>
              {selected.notes && <p className="text-xs text-muted-foreground">{selected.notes}</p>}
              <ConfirmButton variant="ghost" size="sm" title="Eliminar simulación" message="Se eliminará esta simulación." onConfirm={() => { simulationStore.remove(selected.id); setViewing(null) }}>
                <Trash2 /> Eliminar
              </ConfirmButton>
            </div>
          )}
        </CardContent>
      </Card>
      {running && <SimulationRunner config={running} onClose={() => setRunning(null)} />}
    </div>
  )
}

type Phase = 'fight' | 'rest' | 'log' | 'done'

function SimulationRunner({ config, onClose }: { config: Config; onClose: () => void }) {
  const toast = useToast()
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<Phase>('fight')
  const [remaining, setRemaining] = useState(config.durationMin * 60)
  const [paused, setPaused] = useState(false)
  const [rounds, setRounds] = useState<SimulationRound[]>([])
  const [current, setCurrent] = useState<{ result: RoundResult | null; rpe: number | null; fatigue: number | null; notes: string }>({ result: null, rpe: null, fatigue: null, notes: '' })
  const [notes, setNotes] = useState('')
  const endAt = useRef<number>(0)

  const nextRound = () => {
    setRound((r) => r + 1)
    setRemaining(config.durationMin * 60)
    setPhase('fight')
  }


  useEffect(() => {
    if (paused || (phase !== 'fight' && phase !== 'rest')) return
    endAt.current = Date.now() + remaining * 1000
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        clearInterval(t)
        beep()
        if (phase === 'fight') setPhase('log')
        else nextRound()
      }
    }, 250)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused])

  const saveRound = () => {
    const next = [...rounds, { durationMin: config.durationMin, restMin: config.restMin, ...current, notes: current.notes.trim() }]
    setRounds(next)
    setCurrent({ result: null, rpe: null, fatigue: null, notes: '' })
    if (next.length >= config.rounds) return setPhase('done')
    if (config.restMin > 0) {
      setRemaining(config.restMin * 60)
      setPhase('rest')
    } else nextRound()
  }

  const finish = () => {
    if (!rounds.length) return onClose()
    simulationStore.create({ date: todayISO(), modality: config.modality, rounds, notes: notes.trim() })
    toast('Simulación guardada')
    onClose()
  }

  return (
    <Dialog open onClose={() => (rounds.length ? setPhase('done') : onClose())} title={`Simulación · Round ${Math.min(round + 1, config.rounds)} de ${config.rounds}`}>
      {(phase === 'fight' || phase === 'rest') && (
        <div className="space-y-4 text-center">
          <p className={cn('text-sm font-semibold uppercase tracking-widest', phase === 'fight' ? 'text-primary' : 'text-muted-foreground')}>
            {phase === 'fight' ? 'Combate' : 'Descanso'}
          </p>
          <p className="font-display text-8xl font-bold tabular" aria-live="off">{mmss(remaining)}</p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={() => setPaused((p) => !p)}>{paused ? <><Play /> Reanudar</> : <><Pause /> Pausar</>}</Button>
            <Button variant="ghost" onClick={() => (phase === 'fight' ? setPhase('log') : nextRound())}><SkipForward /> {phase === 'fight' ? 'Terminar round' : 'Saltar descanso'}</Button>
          </div>
        </div>
      )}
      {phase === 'log' && (
        <div className="space-y-4">
          <p className="text-sm font-medium">¿Cómo ha ido el round {rounds.length + 1}?</p>
          <Field label="Resultado" htmlFor="sim-res">
            <Select id="sim-res" value={current.result ?? ''} onChange={(e) => setCurrent({ ...current, result: (e.target.value || null) as RoundResult | null })}>
              <option value="">—</option>
              {Object.entries(RESULT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label={`RPE${current.rpe ? ` · ${current.rpe}` : ''}`}>
            <ScaleInput name="RPE" value={current.rpe} onChange={(v) => setCurrent({ ...current, rpe: v })} />
          </Field>
          <Field label={`Fatiga${current.fatigue ? ` · ${current.fatigue}` : ''}`}>
            <ScaleInput name="Fatiga" value={current.fatigue} onChange={(v) => setCurrent({ ...current, fatigue: v })} lowLabel="Fresco" highLabel="Agotado" />
          </Field>
          <Field label="Notas" htmlFor="sim-n">
            <Input id="sim-n" value={current.notes} onChange={(e) => setCurrent({ ...current, notes: e.target.value })} />
          </Field>
          <Button className="w-full" onClick={saveRound}><Save /> Guardar round</Button>
        </div>
      )}
      {phase === 'done' && (
        <div className="space-y-4">
          <p className="text-sm">{rounds.length} round{rounds.length === 1 ? '' : 's'} registrados.</p>
          <Field label="Observaciones de la simulación" htmlFor="sim-notes">
            <Textarea id="sim-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Descartar</Button>
            <Button onClick={finish}><Save /> Guardar simulación</Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    o.frequency.value = 880
    o.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.4)
  } catch {
    /* audio unavailable */
  }
}
