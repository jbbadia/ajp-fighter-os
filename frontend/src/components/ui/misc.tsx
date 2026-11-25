import type { HTMLAttributes, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, OctagonAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecoveryLevel } from '@/domain/recovery'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium [&_svg]:size-3', className)}
      {...props}
    />
  )
}

export function Progress({ value, className, label }: { value: number; className?: string; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${value}%` }} />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center', className)}>
      <div className="text-muted-foreground [&_svg]:size-6">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Status is always icon + label + color, never color alone. */
const STATUS_META: Record<RecoveryLevel, { icon: typeof CheckCircle2; cls: string; dot: string }> = {
  green: { icon: CheckCircle2, cls: 'bg-good/15 text-good', dot: 'bg-good' },
  yellow: { icon: AlertTriangle, cls: 'bg-warning/15 text-warning', dot: 'bg-warning' },
  red: { icon: OctagonAlert, cls: 'bg-critical/15 text-critical', dot: 'bg-critical' },
  unknown: { icon: CircleHelp, cls: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
}

export function StatusBadge({ level, label, className }: { level: RecoveryLevel; label: string; className?: string }) {
  const m = STATUS_META[level]
  return (
    <Badge className={cn(m.cls, className)}>
      <m.icon aria-hidden />
      {label}
    </Badge>
  )
}

export function Alert({
  severity,
  title,
  children,
  className,
}: {
  severity: 'info' | 'warning' | 'critical'
  title: string
  children?: ReactNode
  className?: string
}) {
  const Icon = severity === 'critical' ? OctagonAlert : severity === 'warning' ? AlertTriangle : CircleHelp
  return (
    <div
      role={severity === 'info' ? 'status' : 'alert'}
      className={cn(
        'flex gap-3 rounded-lg border p-3 text-sm',
        severity === 'critical' && 'border-critical/40 bg-critical/10',
        severity === 'warning' && 'border-warning/40 bg-warning/10',
        severity === 'info' && 'border-border bg-muted/50',
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          severity === 'critical' ? 'text-critical' : severity === 'warning' ? 'text-warning' : 'text-muted-foreground',
        )}
      />
      <div>
        <p className="font-medium">{title}</p>
        {children && <div className="mt-0.5 text-xs text-muted-foreground">{children}</div>}
      </div>
    </div>
  )
}
