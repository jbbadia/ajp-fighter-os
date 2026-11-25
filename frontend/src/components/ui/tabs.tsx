import { useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from './button'
import { Dialog } from './dialog'

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
}) {
  return (
    <div role="tablist" className={cn('inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-muted/40 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
            value === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Button that asks for confirmation before running a destructive action. */
export function ConfirmButton({
  onConfirm,
  title,
  message,
  confirmLabel = 'Eliminar',
  children,
  ...props
}: Omit<ButtonProps, 'onClick'> & { onConfirm: () => void; title: string; message: ReactNode; confirmLabel?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button {...props} onClick={() => setOpen(true)}>
        {children ?? (
          <>
            <Trash2 /> Eliminar
          </>
        )}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false)
                onConfirm()
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{message}</p>
      </Dialog>
    </>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between gap-3">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide">{children}</h2>
      {action}
    </div>
  )
}
