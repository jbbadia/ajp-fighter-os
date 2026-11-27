import { useState } from 'react'
import { z } from 'zod'
import { Plus, Save, Trash2 } from 'lucide-react'
import type { Modality, RoundResult, SparringRound } from '@/types/domain'
import { useProfile } from '@/data'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, ScaleInput, Select, Textarea } from '@/components/ui/form'
import { Alert } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { optionalNumber, requiredNumber, validate, type FieldErrors } from '@/lib/validation'
import { uid } from '@/lib/utils'
import { RESULT_LABEL } from '@/domain/sessionMeta'
import { clearanceWarning } from '@/domain/recovery'
import type { LogRequest } from '@/features/training/SessionDialogs'
import { CommonLogFields, NotesField, commonSchema, saveDetailedLog, useLogTarget } from '@/features/training/logCommon'
import { UndoSessionButton } from '@/features/training/UndoSessionButton'

type RoundForm = Omit<SparringRound, 'durationMin' | 'submissionsAttempted' | 'submissionsReceived' | 'guardPasses' | 'sweeps' | 'takedowns'> & {
  durationMin: string
  submissionsAttempted: string
  submissionsReceived: string
  guardPasses: string
  sweeps: string
  takedowns: string
}

const COUNTERS: [keyof RoundForm, string][] = [
  ['submissionsAttempted', 'Sumisiones intentadas'],
  ['submissionsReceived', 'Sumisiones recibidas'],
  ['guardPasses', 'Pases de guardia'],
  ['sweeps', 'Barridos'],
  ['takedowns', 'Derribos'],
]

const toRoundForm = (r: SparringRound): RoundForm => ({
  ...r,
  durationMin: String(r.durationMin),
  submissionsAttempted: String(r.submissionsAttempted),
  submissionsReceived: String(r.submissionsReceived),
  guardPasses: String(r.guardPasses),
  sweeps: String(r.sweeps),
  takedowns: String(r.takedowns),
})

const emptyRound = (durationMin: string): RoundForm => ({
  id: uid(),
  durationMin,
  result: null,
  startPosition: '',
  endPosition: '',
  submissionsAttempted: '0',
  submissionsReceived: '0',
  guardPasses: '0',
  sweeps: '0',
  takedowns: '0',
  mistakes: '',
  positives: '',
})

export function BjjLogDialog({ request, onClose }: { request: LogRequest; onClose: () => void }) {
  const profile = useProfile()
  const toast = useToast()
  const { session, initial } = useLogTarget(request)
  const bjj = session?.bjj
  const [common, setCommon] = useState(initial)
  const [modality, setModality] = useState<Modality>(bjj?.modality ?? (request.type === 'bjj_nogi' ? 'nogi' : 'gi'))
  const [nums, setNums] = useState({
    rounds: String(bjj?.rounds ?? ''),
    roundDurationMin: String(bjj?.roundDurationMin ?? ''),
    partners: String(bjj?.partners ?? ''),
  })
  const [technicalQuality, setTQ] = useState<number | null>(bjj?.technicalQuality ?? null)
  const [finalFatigue, setFF] = useState<number | null>(bjj?.finalFatigue ?? null)
  const [rounds, setRounds] = useState<RoundForm[]>(bjj?.sparring.map(toRoundForm) ?? [])
  const [errors, setErrors] = useState<FieldErrors>({})

  const warning = session ? clearanceWarning(session.requiresClearance, profile.shoulder) : null

  const updateRound = (id: string, patch: Partial<RoundForm>) => setRounds((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const save = () => {
    const count = (label: string) => requiredNumber(label, 0, 99).refine(Number.isInteger, `${label}: número entero`)
    const roundSchema = z.object({
      durationMin: requiredNumber('Duración del round', 0.5, 60),
      submissionsAttempted: count('Sumisiones intentadas'),
      submissionsReceived: count('Sumisiones recibidas'),
      guardPasses: count('Pases'),
      sweeps: count('Barridos'),
      takedowns: count('Derribos'),
    })
    const schema = commonSchema.extend({
      rounds: optionalNumber('Número de rounds', 0, 50),
      roundDurationMin: optionalNumber('Duración de cada round', 0.5, 60),
      partners: optionalNumber('Número de compañeros', 0, 50),
      sparring: z.array(roundSchema),
    })
    const r = validate(schema, { ...common, ...nums, sparring: rounds })
    if (!r.ok) {
      setErrors(r.errors)
      toast('Revisa los campos marcados', 'error')
      return
    }
    const d = r.data
    saveDetailedLog(
      session,
      modality === 'gi' ? 'bjj_gi' : 'bjj_nogi',
      { ...common, durationMin: d.durationMin, rpe: d.rpe },
      {
        type: modality === 'gi' ? 'bjj_gi' : 'bjj_nogi',
        bjj: {
          modality,
          rounds: d.rounds ?? rounds.length,
          roundDurationMin: d.roundDurationMin ?? 0,
          partners: d.partners ?? 0,
          technicalQuality,
          finalFatigue,
          sparring: rounds.map((rf, i) => ({
            ...rf,
            ...d.sparring[i],
            startPosition: rf.startPosition.trim(),
            endPosition: rf.endPosition.trim(),
            mistakes: rf.mistakes.trim(),
            positives: rf.positives.trim(),
          })),
        },
      },
      { objective: 'Sesión no planificada' },
    )
    toast('Sesión de BJJ guardada')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={session ? 'Registro de BJJ' : 'Registrar sesión de BJJ'}
      description={session?.objective}
      footer={
        <>
          {session && <UndoSessionButton session={session} onDone={onClose} />}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}><Save /> Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        {warning && <Alert severity="warning" title="Autorización médica pendiente">{warning}</Alert>}
        <Field label="Modalidad" htmlFor="bj-mod">
          <Select id="bj-mod" value={modality} onChange={(e) => setModality(e.target.value as Modality)}>
            <option value="gi">Gi</option>
            <option value="nogi">No-Gi</option>
          </Select>
        </Field>
        <CommonLogFields value={common} onChange={setCommon} errors={errors} idPrefix="bj" />
        <div className="grid grid-cols-3 gap-3">
          {([
            ['rounds', 'Nº de rounds'],
            ['roundDurationMin', 'Min por round'],
            ['partners', 'Nº compañeros'],
          ] as const).map(([k, l]) => (
            <Field key={k} label={l} htmlFor={`bj-${k}`} error={errors[k]}>
              <Input id={`bj-${k}`} inputMode="decimal" value={nums[k]} onChange={(e) => setNums((n) => ({ ...n, [k]: e.target.value }))} />
            </Field>
          ))}
        </div>
        <Field label={`Calidad técnica${technicalQuality ? ` · ${technicalQuality}` : ''}`}>
          <ScaleInput name="Calidad técnica" value={technicalQuality} onChange={setTQ} lowLabel="Muy baja" highLabel="Excelente" />
        </Field>
        <Field label={`Fatiga final${finalFatigue ? ` · ${finalFatigue}` : ''}`}>
          <ScaleInput name="Fatiga final" value={finalFatigue} onChange={setFF} lowLabel="Fresco" highLabel="Agotado" />
        </Field>
        <NotesField id="bj-notes" value={common.notes} onChange={(v) => setCommon((c) => ({ ...c, notes: v }))} />

        <div className="border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Registro de sparring</h3>
              <p className="text-xs text-muted-foreground">Opcional, round a round</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setRounds((rs) => [...rs, emptyRound(nums.roundDurationMin || '5')])}>
              <Plus /> Añadir round
            </Button>
          </div>
          <div className="space-y-3">
            {rounds.map((r, i) => (
              <fieldset key={r.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-medium">Round {i + 1}</legend>
                  <Button size="icon" variant="ghost" aria-label={`Eliminar round ${i + 1}`} onClick={() => setRounds((rs) => rs.filter((x) => x.id !== r.id))}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Duración (min)" htmlFor={`r-${r.id}-d`} error={errors[`sparring.${i}.durationMin`]}>
                    <Input id={`r-${r.id}-d`} inputMode="decimal" value={r.durationMin} onChange={(e) => updateRound(r.id, { durationMin: e.target.value })} />
                  </Field>
                  <Field label="Resultado" htmlFor={`r-${r.id}-res`}>
                    <Select id={`r-${r.id}-res`} value={r.result ?? ''} onChange={(e) => updateRound(r.id, { result: (e.target.value || null) as RoundResult | null })}>
                      <option value="">—</option>
                      {Object.entries(RESULT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  </Field>
                  <Field label="Posición inicial" htmlFor={`r-${r.id}-sp`}>
                    <Input id={`r-${r.id}-sp`} value={r.startPosition} maxLength={60} onChange={(e) => updateRound(r.id, { startPosition: e.target.value })} />
                  </Field>
                  <Field label="Posición final" htmlFor={`r-${r.id}-ep`}>
                    <Input id={`r-${r.id}-ep`} value={r.endPosition} maxLength={60} onChange={(e) => updateRound(r.id, { endPosition: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {COUNTERS.map(([k, l]) => (
                    <Field key={k} label={l} htmlFor={`r-${r.id}-${k}`} error={errors[`sparring.${i}.${k}`]}>
                      <Input id={`r-${r.id}-${k}`} inputMode="numeric" value={r[k] as string} onChange={(e) => updateRound(r.id, { [k]: e.target.value })} />
                    </Field>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Errores detectados" htmlFor={`r-${r.id}-m`}>
                    <Textarea id={`r-${r.id}-m`} className="min-h-14" value={r.mistakes} onChange={(e) => updateRound(r.id, { mistakes: e.target.value })} />
                  </Field>
                  <Field label="Aspectos positivos" htmlFor={`r-${r.id}-p`}>
                    <Textarea id={`r-${r.id}-p`} className="min-h-14" value={r.positives} onChange={(e) => updateRound(r.id, { positives: e.target.value })} />
                  </Field>
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
