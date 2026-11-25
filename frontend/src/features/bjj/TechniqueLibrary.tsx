import { useState } from 'react'
import { z } from 'zod'
import { BookOpen, ExternalLink, Plus, Save, Search, Star } from 'lucide-react'
import type { Modality, Technique, TechniqueCategory, TechniqueStatus } from '@/types/domain'
import { techniqueStore, useTechniques } from '@/data'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmButton } from '@/components/ui/tabs'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form'
import { Badge, EmptyState } from '@/components/ui/misc'
import { useToast } from '@/components/ui/toast'
import { TECHNIQUE_CATEGORY_LABEL, TECHNIQUE_STATUS_LABEL } from '@/domain/sessionMeta'
import { validate, type FieldErrors } from '@/lib/validation'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<TechniqueStatus, string> = {
  to_learn: 'bg-muted text-muted-foreground',
  developing: 'bg-warning/15 text-warning',
  mastered: 'bg-good/15 text-good',
}

export function TechniqueLibrary() {
  const techniques = useTechniques()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<TechniqueCategory | ''>('')
  const [status, setStatus] = useState<TechniqueStatus | ''>('')
  const [mainOnly, setMainOnly] = useState(false)
  const [editing, setEditing] = useState<Technique | 'new' | null>(null)

  const filtered = techniques
    .filter((t) => (!category || t.category === category) && (!status || t.status === status) && (!mainOnly || t.competitionMain))
    .filter((t) => !q || `${t.name} ${t.notes}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const groups = (Object.keys(TECHNIQUE_CATEGORY_LABEL) as TechniqueCategory[])
    .map((c) => ({ c, items: filtered.filter((t) => t.category === c) }))
    .filter((g) => g.items.length)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Buscar técnica" placeholder="Buscar técnica…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Categoría" className="w-auto" value={category} onChange={(e) => setCategory(e.target.value as TechniqueCategory | '')}>
          <option value="">Todas las categorías</option>
          {Object.entries(TECHNIQUE_CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select aria-label="Estado" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as TechniqueStatus | '')}>
          <option value="">Todos los estados</option>
          {Object.entries(TECHNIQUE_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Button variant={mainOnly ? 'default' : 'outline'} onClick={() => setMainOnly((x) => !x)} aria-pressed={mainOnly}>
          <Star /> Competición
        </Button>
        <Button onClick={() => setEditing('new')}><Plus /> Nueva técnica</Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['to_learn', 'developing', 'mastered'] as const).map((s) => (
          <Card key={s} className="p-3">
            <p className="text-xs text-muted-foreground">{TECHNIQUE_STATUS_LABEL[s]}</p>
            <p className="font-display text-2xl font-bold tabular">{techniques.filter((t) => t.status === s).length}</p>
          </Card>
        ))}
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Principales de competición</p>
          <p className="font-display text-2xl font-bold tabular">{techniques.filter((t) => t.competitionMain).length}</p>
        </Card>
      </div>

      {techniques.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="Tu biblioteca técnica está vacía"
          description="Añade las técnicas que estás aprendiendo, con notas y vídeos de referencia."
          action={<Button onClick={() => setEditing('new')}><Plus /> Añadir la primera</Button>}
        />
      ) : groups.length === 0 ? (
        <EmptyState icon={<Search />} title="Sin resultados" description="Prueba con otros filtros." />
      ) : (
        groups.map(({ c, items }) => (
          <section key={c}>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{TECHNIQUE_CATEGORY_LABEL[c]} · {items.length}</h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEditing(t)}
                  className="rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{t.name}</p>
                    {t.competitionMain && <Star className="size-4 shrink-0 fill-primary text-primary" aria-label="Técnica principal de competición" />}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge className={STATUS_STYLE[t.status]}>{TECHNIQUE_STATUS_LABEL[t.status]}</Badge>
                    <Badge className="bg-muted">{t.modality === 'both' ? 'Gi y No-Gi' : t.modality === 'gi' ? 'Gi' : 'No-Gi'}</Badge>
                    {t.videoUrls.length > 0 && <Badge className="bg-muted"><ExternalLink /> {t.videoUrls.length}</Badge>}
                  </div>
                  {t.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{t.notes}</p>}
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {editing && <TechniqueDialog technique={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TechniqueDialog({ technique, onClose }: { technique: Technique | null; onClose: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({
    name: technique?.name ?? '',
    category: technique?.category ?? ('guard' as TechniqueCategory),
    status: technique?.status ?? ('to_learn' as TechniqueStatus),
    competitionMain: technique?.competitionMain ?? false,
    modality: technique?.modality ?? ('both' as Modality | 'both'),
    notes: technique?.notes ?? '',
    videoUrls: technique?.videoUrls.join('\n') ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const save = () => {
    const urls = f.videoUrls.split('\n').map((u) => u.trim()).filter(Boolean)
    const schema = z.object({
      name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
      videoUrls: z.array(z.url({ protocol: /^https?$/, error: 'Enlace no válido (debe empezar por http:// o https://)' })),
    })
    const r = validate(schema, { name: f.name, videoUrls: urls })
    if (!r.ok) {
      const urlError = Object.entries(r.errors).find(([k]) => k.startsWith('videoUrls'))?.[1]
      return setErrors({ ...r.errors, videoUrls: urlError ?? '' })
    }
    const data = { ...f, name: r.data.name, notes: f.notes.trim(), videoUrls: urls }
    if (technique) techniqueStore.update(technique.id, data)
    else techniqueStore.create(data)
    toast(technique ? 'Técnica actualizada' : 'Técnica añadida')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={technique ? 'Editar técnica' : 'Nueva técnica'}
      footer={
        <div className="flex w-full justify-between gap-2">
          {technique ? (
            <ConfirmButton variant="ghost" size="sm" title="Eliminar técnica" message={`Se eliminará «${technique.name}».`} onConfirm={() => { techniqueStore.remove(technique.id); toast('Técnica eliminada'); onClose() }} />
          ) : <span />}
          <Button onClick={save}><Save /> Guardar</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" htmlFor="t-name" error={errors.name}>
          <Input id="t-name" value={f.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Categoría" htmlFor="t-cat">
            <Select id="t-cat" value={f.category} onChange={(e) => set('category', e.target.value as TechniqueCategory)}>
              {Object.entries(TECHNIQUE_CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Estado" htmlFor="t-status">
            <Select id="t-status" value={f.status} onChange={(e) => set('status', e.target.value as TechniqueStatus)}>
              {Object.entries(TECHNIQUE_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Modalidad" htmlFor="t-mod" className="col-span-2 sm:col-span-1">
            <Select id="t-mod" value={f.modality} onChange={(e) => set('modality', e.target.value as Modality | 'both')}>
              <option value="both">Gi y No-Gi</option>
              <option value="gi">Gi</option>
              <option value="nogi">No-Gi</option>
            </Select>
          </Field>
        </div>
        <Switch id="t-main" checked={f.competitionMain} onChange={(v) => set('competitionMain', v)} label="Técnica principal de competición" description="Forma parte de tu plan de juego (A-game)." />
        <Field label="Notas personales" htmlFor="t-notes">
          <Textarea id="t-notes" value={f.notes} maxLength={4000} onChange={(e) => set('notes', e.target.value)} placeholder="Detalles clave, agarres, errores típicos…" />
        </Field>
        <Field label="Vídeos de referencia" htmlFor="t-urls" hint="Un enlace por línea" error={errors.videoUrls || undefined}>
          <Textarea id="t-urls" value={f.videoUrls} onChange={(e) => set('videoUrls', e.target.value)} placeholder="https://…" />
        </Field>
        {technique && technique.videoUrls.length > 0 && (
          <ul className="space-y-1">
            {technique.videoUrls.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1 text-xs text-primary hover:underline break-all')}>
                  <ExternalLink className="size-3 shrink-0" /> {u}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
