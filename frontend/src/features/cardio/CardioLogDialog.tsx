import { useState } from 'react'
import { Save } from 'lucide-react'
import type { CardioKind, CardioLog, SessionType } from '@/types/domain'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, ScaleInput, Select } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { optionalNumber, validate, type FieldErrors } from '@/lib/validation'
import { CARDIO_KIND_LABEL } from '@/domain/sessionMeta'
import type { LogRequest } from '@/features/training/SessionDialogs'
import { CommonLogFields, NotesField, commonSchema, saveDetailedLog, useLogTarget } from '@/features/training/logCommon'

const NUM_FIELDS = {
  avgHr: ['FC media (lpm)', 40, 230],
  maxHr: ['FC máxima (lpm)', 40, 240],
  distanceKm: ['Distancia (km)', 0, 300],
  speedKmh: ['Velocidad media (km/h)', 0, 80],
  intervals: ['Nº de intervalos', 0, 100],
  workSec: ['Esfuerzo (s)', 0, 3600],
  restSec: ['Recuperación (s)', 0, 3600],
  rounds: ['Rounds', 0, 50],
  roundDurationMin: ['Duración round (min)', 0, 60],
  z1: ['Z1 (min)', 0, 600],
  z2: ['Z2 (min)', 0, 600],
  z3: ['Z3 (min)', 0, 600],
  z4: ['Z4 (min)', 0, 600],
  z5: ['Z5 (min)', 0, 600],
} as const
type NumKey = keyof typeof NUM_FIELDS

const BY_KIND: Record<CardioKind, NumKey[]> = {
  z2: ['avgHr', 'maxHr', 'distanceKm', 'speedKmh'],
  hiit: ['intervals', 'workSec', 'restSec', 'avgHr', 'maxHr'],
  bjj_specific: ['rounds', 'roundDurationMin', 'restSec', 'avgHr', 'maxHr'],
}

const kindFromType = (t: SessionType): CardioKind => (t === 'hiit' ? 'hiit' : 'z2')
const typeFromKind = (k: CardioKind): SessionType => (k === 'z2' ? 'cardio_z2' : 'hiit')

export function CardioLogDialog({ request, onClose }: { request: LogRequest; onClose: () => void }) {
  const toast = useToast()
  const { session, initial } = useLogTarget(request)
  const c = session?.cardio
  const [common, setCommon] = useState(initial)
  const [kind, setKind] = useState<CardioKind>(c?.kind ?? kindFromType(request.type))
  const [machine, setMachine] = useState(c?.machine ?? '')
  const [results, setResults] = useState(c?.results ?? '')
  const [recoveryFeeling, setRF] = useState<number | null>(c?.recoveryFeeling ?? null)
  const [muscleFatigue, setMF] = useState<number | null>(c?.muscleFatigue ?? null)
  const [nums, setNums] = useState<Record<NumKey, string>>(() => {
    const v = (x: number | null | undefined) => (x == null ? '' : String(x))
    const z = c?.zoneMinutes
    return {
      avgHr: v(c?.avgHr), maxHr: v(c?.maxHr), distanceKm: v(c?.distanceKm), speedKmh: v(c?.speedKmh),
      intervals: v(c?.intervals), workSec: v(c?.workSec), restSec: v(c?.restSec), rounds: v(c?.rounds),
      roundDurationMin: v(c?.roundDurationMin),
      z1: v(z?.[0]), z2: v(z?.[1]), z3: v(z?.[2]), z4: v(z?.[3]), z5: v(z?.[4]),
    }
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const save = () => {
    const numSchema = Object.fromEntries(
      (Object.keys(NUM_FIELDS) as NumKey[]).map((k) => [k, optionalNumber(NUM_FIELDS[k][0], NUM_FIELDS[k][1], NUM_FIELDS[k][2])]),
    ) as { [K in NumKey]: ReturnType<typeof optionalNumber> }
    const schema = commonSchema
      .extend(numSchema)
      .refine((v) => v.avgHr === null || v.maxHr === null || v.avgHr <= v.maxHr, { path: ['avgHr'], message: 'La FC media no puede superar la máxima' })
    const r = validate(schema, { ...common, ...nums })
    if (!r.ok) {
      setErrors(r.errors)
      toast('Revisa los campos marcados', 'error')
      return
    }
    const d = r.data
    const zones = [d.z1, d.z2, d.z3, d.z4, d.z5]
    const used = new Set(BY_KIND[kind])
    const pick = (k: NumKey) => (used.has(k) ? d[k] : null)
    const cardio: CardioLog = {
      kind,
      avgHr: pick('avgHr'),
      maxHr: pick('maxHr'),
      distanceKm: pick('distanceKm'),
      speedKmh: pick('speedKmh'),
      machine: kind === 'z2' ? machine.trim() : '',
      zoneMinutes: zones.some((z) => z !== null) ? (zones.map((z) => z ?? 0) as CardioLog['zoneMinutes']) : null,
      intervals: pick('intervals'),
      workSec: pick('workSec'),
      restSec: pick('restSec'),
      rounds: pick('rounds'),
      roundDurationMin: pick('roundDurationMin'),
      recoveryFeeling: kind === 'bjj_specific' ? recoveryFeeling : null,
      muscleFatigue: kind === 'bjj_specific' ? muscleFatigue : null,
      results: results.trim(),
    }
    saveDetailedLog(
      session,
      typeFromKind(kind),
      { ...common, durationMin: d.durationMin, rpe: d.rpe },
      { cardio, ...(session ? {} : { type: typeFromKind(kind) }) },
      { objective: CARDIO_KIND_LABEL[kind] },
    )
    toast('Sesión de cardio guardada')
    onClose()
  }

  const numInput = (k: NumKey) => (
    <Field key={k} label={NUM_FIELDS[k][0]} htmlFor={`ca-${k}`} error={errors[k]}>
      <Input id={`ca-${k}`} inputMode="decimal" value={nums[k]} onChange={(e) => setNums((n) => ({ ...n, [k]: e.target.value }))} />
    </Field>
  )

  return (
    <Dialog
      open
      onClose={onClose}
      className="sm:max-w-xl"
      title={session ? 'Registro de cardio' : 'Registrar sesión de cardio'}
      description="Introduce solo los datos que te dé tu dispositivo. No se estiman valores fisiológicos."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}><Save /> Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tipo de sesión" htmlFor="ca-kind">
          <Select id="ca-kind" value={kind} onChange={(e) => setKind(e.target.value as CardioKind)}>
            {Object.entries(CARDIO_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <CommonLogFields value={common} onChange={setCommon} errors={errors} idPrefix="ca" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BY_KIND[kind].map(numInput)}
          {kind === 'z2' && (
            <Field label="Máquina" htmlFor="ca-machine">
              <Input id="ca-machine" value={machine} maxLength={40} placeholder="Bici, elíptica, cinta…" onChange={(e) => setMachine(e.target.value)} />
            </Field>
          )}
        </div>
        {kind === 'bjj_specific' && (
          <>
            <Field label={`Sensación de recuperación${recoveryFeeling ? ` · ${recoveryFeeling}` : ''}`}>
              <ScaleInput name="Sensación de recuperación" value={recoveryFeeling} onChange={setRF} lowLabel="Muy mala" highLabel="Excelente" />
            </Field>
            <Field label={`Fatiga muscular${muscleFatigue ? ` · ${muscleFatigue}` : ''}`}>
              <ScaleInput name="Fatiga muscular" value={muscleFatigue} onChange={setMF} lowLabel="Nada" highLabel="Máxima" />
            </Field>
          </>
        )}
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Tiempo en zonas (opcional)</summary>
          <p className="mt-1 text-xs text-muted-foreground">Solo si tu pulsómetro o reloj te da este dato.</p>
          <div className="mt-3 grid grid-cols-5 gap-2">{(['z1', 'z2', 'z3', 'z4', 'z5'] as const).map(numInput)}</div>
        </details>
        <Field label="Resultados" htmlFor="ca-res">
          <Input id="ca-res" value={results} maxLength={200} onChange={(e) => setResults(e.target.value)} />
        </Field>
        <NotesField id="ca-notes" value={common.notes} onChange={(v) => setCommon((x) => ({ ...x, notes: v }))} />
      </div>
    </Dialog>
  )
}
