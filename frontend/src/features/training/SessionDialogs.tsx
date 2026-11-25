import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { SessionType, TrainingSession } from '@/types/domain'
import { sessionStore } from '@/data'
import { hasDetailedLog, SESSION_TYPES } from '@/domain/sessionMeta'
import { SessionRunner } from './SessionRunner'
import { SessionEditor } from './SessionEditor'
import { BjjLogDialog } from '@/features/bjj/BjjLogDialog'
import { GymLogDialog } from '@/features/gym/GymLogDialog'
import { CardioLogDialog } from '@/features/cardio/CardioLogDialog'

export interface LogRequest {
  /** Existing session to log into; null creates an unplanned session. */
  sessionId: string | null
  type: SessionType
  /** Pre-filled actual duration (e.g. from the live timer). */
  durationMin?: number
}

interface Ctx {
  edit: (sessionId: string | null, defaults?: Partial<TrainingSession>) => void
  run: (sessionId: string) => void
  log: (req: LogRequest) => void
  /** Opens the most appropriate dialog for a session. */
  open: (sessionId: string) => void
}

const SessionDialogsContext = createContext<Ctx | null>(null)


export function SessionDialogsProvider({ children }: { children: ReactNode }) {
  const [editState, setEditState] = useState<{ id: string | null; defaults?: Partial<TrainingSession> } | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [logReq, setLogReq] = useState<LogRequest | null>(null)

  const log = useCallback((req: LogRequest) => setLogReq(req), [])
  const ctx = useMemo<Ctx>(
    () => ({
      edit: (id, defaults) => setEditState({ id, defaults }),
      run: setRunId,
      log,
      open: (id) => {
        const s = sessionStore.get(id)
        if (!s) return
        if (s.status === 'completed' && hasDetailedLog(s.type)) log({ sessionId: id, type: s.type })
        else if (s.status === 'completed' || s.status === 'skipped' || s.type === 'rest') setEditState({ id })
        else setRunId(id)
      },
    }),
    [log],
  )

  const discipline = logReq ? SESSION_TYPES[logReq.type].discipline : null
  const closeLog = () => setLogReq(null)

  return (
    <SessionDialogsContext.Provider value={ctx}>
      {children}
      {editState && <SessionEditor sessionId={editState.id} defaults={editState.defaults} onClose={() => setEditState(null)} />}
      <SessionRunner
        sessionId={runId}
        onClose={() => setRunId(null)}
        onFinishDetailed={(s, durationMin) => {
          setRunId(null)
          log({ sessionId: s.id, type: s.type, durationMin })
        }}
      />
      {logReq && discipline === 'bjj' && <BjjLogDialog request={logReq} onClose={closeLog} />}
      {logReq && discipline === 'gym' && <GymLogDialog request={logReq} onClose={closeLog} />}
      {logReq && discipline === 'cardio' && <CardioLogDialog request={logReq} onClose={closeLog} />}
    </SessionDialogsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSessionDialogs(): Ctx {
  const ctx = useContext(SessionDialogsContext)
  if (!ctx) throw new Error('useSessionDialogs fuera de SessionDialogsProvider')
  return ctx
}
