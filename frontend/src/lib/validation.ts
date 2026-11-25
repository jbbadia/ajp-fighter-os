import { z } from 'zod'

/** Optional numeric text field ('' → null). Accepts comma decimals. */
export const optionalNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= min && v <= max), {
      message: `${label}: introduce un valor entre ${min} y ${max}`,
    })

/** Required numeric text field. */
export const requiredNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} es obligatorio`)
    .transform((v) => Number(v.replace(',', '.')))
    .refine((v) => !Number.isNaN(v) && v >= min && v <= max, {
      message: `${label}: introduce un valor entre ${min} y ${max}`,
    })

export type FieldErrors = Record<string, string>

export function validate<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { ok: true; data: z.output<S> } | { ok: false; errors: FieldErrors } {
  const r = schema.safeParse(values)
  if (r.success) return { ok: true, data: r.data }
  const errors: FieldErrors = {}
  for (const issue of r.error.issues) {
    const key = issue.path.join('.')
    errors[key] ??= issue.message
  }
  return { ok: false, errors }
}
