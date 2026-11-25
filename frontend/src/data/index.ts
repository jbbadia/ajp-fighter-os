import type {
  AthleteProfile,
  DailyLog,
  Exercise,
  NutritionLog,
  Routine,
  Simulation,
  Supplement,
  SupplementIntake,
  Technique,
  TrainingSession,
  WeeklyGoal,
} from '@/types/domain'
import { generatePlannedSessions } from '@/domain/planTemplate'
import { addDays, toISODate, todayISO, weekRange } from '@/lib/dates'
import { createAdapter } from './adapters'
import { CollectionStore, useCollection } from './store'
import { PLAN_VERSION, replanFutureTemplateSessions } from './plan'
import { isSyncConfigured, syncNow } from './sync'
import { initialExercises, initialProfile, initialRoutines, migrateProfile, PROFILE_ID } from './seed'

const adapter = createAdapter()

export const profileStore = new CollectionStore<AthleteProfile>('profile', adapter)
export const sessionStore = new CollectionStore<TrainingSession>('sessions', adapter)
export const dailyLogStore = new CollectionStore<DailyLog>('dailyLogs', adapter)
export const exerciseStore = new CollectionStore<Exercise>('exercises', adapter)
export const routineStore = new CollectionStore<Routine>('routines', adapter)
export const techniqueStore = new CollectionStore<Technique>('techniques', adapter)
export const nutritionStore = new CollectionStore<NutritionLog>('nutrition', adapter)
export const supplementStore = new CollectionStore<Supplement>('supplements', adapter)
export const intakeStore = new CollectionStore<SupplementIntake>('supplementIntakes', adapter)
export const goalStore = new CollectionStore<WeeklyGoal>('goals', adapter)
export const simulationStore = new CollectionStore<Simulation>('simulations', adapter)

export const ALL_STORES = {
  profile: profileStore,
  sessions: sessionStore,
  dailyLogs: dailyLogStore,
  exercises: exerciseStore,
  routines: routineStore,
  techniques: techniqueStore,
  nutrition: nutritionStore,
  supplements: supplementStore,
  supplementIntakes: intakeStore,
  goals: goalStore,
  simulations: simulationStore,
} as const

const stores = Object.values(ALL_STORES) as CollectionStore<never>[]

export function setStoreErrorHandler(handler: (e: unknown) => void) {
  stores.forEach((s) => (s.onError = handler))
}

let booting: Promise<void> | null = null

/** Load all collections; on first run create the profile and the initial plan. Idempotent. */
export function bootstrap(userName?: string): Promise<void> {
  booting ??= doBootstrap(userName).catch((e) => {
    booting = null
    throw e
  })
  return booting
}

/** Forget loaded data (used on logout) so the next bootstrap reloads from the adapter. */
export function resetStores() {
  booting = null
  stores.forEach((s) => s.clear())
}

async function doBootstrap(userName?: string) {
  await Promise.all(stores.map((s) => s.hydrate()))
  // Bring the other devices' data first, so a fresh device never creates a second initial plan.
  if (isSyncConfigured()) await syncNow()
  const existing = profileStore.get(PROFILE_ID)
  if (!existing) {
    const profile = profileStore.create({ ...initialProfile(userName), planVersion: PLAN_VERSION })
    // Plan from today to the end of next week. Past days are never back-filled.
    const end = toISODate(addDays(weekRange().end, 7))
    generatePlannedSessions(profile.shoulder, todayISO(), end).forEach((s) => sessionStore.create(s))
  } else {
    const migrated = migrateProfile(existing)
    if (migrated) profileStore.update(PROFILE_ID, migrated)
    // Template changed since this plan was generated: refresh the athlete's future planned sessions once.
    if ((existing.planVersion ?? 1) < PLAN_VERSION) {
      replanFutureTemplateSessions(existing.shoulder, todayISO())
      profileStore.update(PROFILE_ID, { planVersion: PLAN_VERSION })
    }
  }
  if (exerciseStore.getSnapshot().length === 0) {
    const exercises = initialExercises().map((e) => exerciseStore.create(e))
    if (routineStore.getSnapshot().length === 0) initialRoutines(exercises).forEach((r) => routineStore.create(r))
  }
}

export function useProfile(): AthleteProfile {
  const profiles = useCollection(profileStore)
  const profile = profiles.find((p) => p.id === PROFILE_ID)
  if (!profile) throw new Error('Perfil no inicializado')
  return profile
}

export const useSessions = () => useCollection(sessionStore)
export const useDailyLogs = () => useCollection(dailyLogStore)
export const useExercises = () => useCollection(exerciseStore)
export const useRoutines = () => useCollection(routineStore)
export const useTechniques = () => useCollection(techniqueStore)
export const useNutrition = () => useCollection(nutritionStore)
export const useSupplements = () => useCollection(supplementStore)
export const useIntakes = () => useCollection(intakeStore)
export const useGoals = () => useCollection(goalStore)
export const useSimulations = () => useCollection(simulationStore)