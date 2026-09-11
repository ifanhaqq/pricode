export type ActivityType = 'text' | 'video' | 'ia1' | 'ia2' | 'quiz'

export const ACTIVITY_SEQUENCE: ActivityType[] = ['text', 'video', 'ia1', 'ia2', 'quiz']

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  text: 'Materi Bacaan',
  video: 'Video Pembelajaran',
  ia1: 'Latihan Balok 1',
  ia2: 'Latihan Balok 2',
  quiz: 'Kuis Sub-Materi'
}

export interface SubCourseGatingItem {
  id: string
  title: string
  order: number
  course_id: string
}

export interface CourseGatingItem {
  id: string
  title: string
  order: number
}

/**
 * 1. Activity Gating: Validates if a student can access targetActivity.
 * Activities must be completed sequentially: text -> video -> ia1 -> ia2 -> quiz.
 */
export function canAccessActivity(
  completedActivities: string[] = [],
  targetActivity: ActivityType,
  isSubcourseCompleted: boolean = false
): { allowed: boolean; redirectActivity: ActivityType; reason?: string } {
  // If the subcourse is already completed, all activities are unlocked for revision
  if (isSubcourseCompleted) {
    return { allowed: true, redirectActivity: targetActivity }
  }

  // Text activity (first activity) is always accessible
  if (targetActivity === 'text') {
    return { allowed: true, redirectActivity: 'text' }
  }

  const targetIndex = ACTIVITY_SEQUENCE.indexOf(targetActivity)
  if (targetIndex <= 0) {
    return { allowed: true, redirectActivity: 'text' }
  }

  // Check that all activities prior to targetIndex are in completedActivities
  for (let i = 0; i < targetIndex; i++) {
    const requiredAct = ACTIVITY_SEQUENCE[i]
    if (!completedActivities.includes(requiredAct)) {
      return {
        allowed: false,
        redirectActivity: requiredAct,
        reason: `Akses Dibatasi: Selesaikan ${ACTIVITY_LABELS[requiredAct]} terlebih dahulu sebelum membuka ${ACTIVITY_LABELS[targetActivity]}!`
      }
    }
  }

  return { allowed: true, redirectActivity: targetActivity }
}

/**
 * 2. SubCourse Gating: Validates if a student can access a subcourse within a course.
 * Sub-courses must be completed in order of their `order` attribute.
 */
export function canAccessSubcourse(
  allSubcoursesInCourse: SubCourseGatingItem[],
  progressMap: Record<string, { status?: string }>,
  targetSubcourseId: string
): { allowed: boolean; redirectSubcourseId?: string; reason?: string } {
  if (!allSubcoursesInCourse || allSubcoursesInCourse.length === 0) {
    return { allowed: true }
  }

  // Sort subcourses ascending by order
  const sorted = [...allSubcoursesInCourse].sort((a, b) => a.order - b.order)
  const targetIndex = sorted.findIndex((s) => s.id === targetSubcourseId)

  // First subcourse is always accessible
  if (targetIndex <= 0) {
    return { allowed: true }
  }

  // Check that all preceding subcourses are 'completed'
  for (let i = 0; i < targetIndex; i++) {
    const prevSub = sorted[i]
    const p = progressMap[prevSub.id]
    if (p?.status !== 'completed') {
      return {
        allowed: false,
        redirectSubcourseId: prevSub.id,
        reason: `Akses Dibatasi: Selesaikan sub-materi "${prevSub.title}" terlebih dahulu sebelum membuka materi selanjutnya!`
      }
    }
  }

  return { allowed: true }
}

/**
 * 3. Final Quiz Gating: Validates if student has completed all subcourses before taking Final Quiz.
 */
export function canAccessFinalQuiz(
  allSubcoursesInCourse: SubCourseGatingItem[],
  progressMap: Record<string, { status?: string }>
): { allowed: boolean; redirectSubcourseId?: string; reason?: string } {
  if (!allSubcoursesInCourse || allSubcoursesInCourse.length === 0) {
    return { allowed: true }
  }

  const sorted = [...allSubcoursesInCourse].sort((a, b) => a.order - b.order)
  for (const sc of sorted) {
    const p = progressMap[sc.id]
    if (p?.status !== 'completed') {
      return {
        allowed: false,
        redirectSubcourseId: sc.id,
        reason: `Akses Dibatasi: Selesaikan semua sub-materi terlebih dahulu (belum selesai: "${sc.title}") sebelum mengerjakan Kuis Akhir!`
      }
    }
  }

  return { allowed: true }
}

/**
 * 4. Course-to-Course Gating: The next course stays locked until current course's Final Quiz is passed.
 */
export function canAccessCourse(
  allCourses: CourseGatingItem[],
  courseProgressMap: Record<string, { status?: string }>,
  targetCourseId: string
): { allowed: boolean; reason?: string } {
  if (!allCourses || allCourses.length <= 1) {
    return { allowed: true }
  }

  const sorted = [...allCourses].sort((a, b) => a.order - b.order)
  const targetIndex = sorted.findIndex((c) => c.id === targetCourseId)

  if (targetIndex <= 0) {
    return { allowed: true }
  }

  const prevCourse = sorted[targetIndex - 1]
  const prevProg = courseProgressMap[prevCourse.id]

  if (prevProg?.status !== 'completed') {
    return {
      allowed: false,
      reason: `Kursus Terkunci: Selesaikan Kuis Akhir pada "${prevCourse.title}" terlebih dahulu untuk membuka kursus ini!`
    }
  }

  return { allowed: true }
}

/**
 * 5. Persistence Helpers: Read and save activity completion state
 */
export function getActivityStorageKey(studentId: string, subcourseId: string): string {
  return `pricode_acts_${studentId}_${subcourseId}`
}

export async function fetchCompletedActivities(
  studentId: string,
  subcourseId: string,
  isSubcourseCompleted: boolean = false,
  client?: any
): Promise<string[]> {
  if (isSubcourseCompleted) {
    return ['text', 'video', 'ia1', 'ia2', 'quiz']
  }

  let acts: string[] = []

  // 1. Try reading from localStorage for instant availability
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(getActivityStorageKey(studentId, subcourseId))
      if (cached) {
        acts = JSON.parse(cached)
      }
    }
  } catch {
    // ignore
  }

  // 2. Try reading from Supabase progress table
  if (client && studentId && subcourseId) {
    try {
      const { data, error } = await client
        .from('progress')
        .select('status, completed_activities')
        .eq('student_id', studentId)
        .eq('subcourse_id', subcourseId)
        .maybeSingle()

      if (!error && data) {
        if (data.status === 'completed') {
          return ['text', 'video', 'ia1', 'ia2', 'quiz']
        }
        if (Array.isArray(data.completed_activities) && data.completed_activities.length > 0) {
          // Merge unique
          acts = Array.from(new Set([...acts, ...data.completed_activities]))
        }
      }
    } catch {
      // column completed_activities might not exist yet
    }
  }

  return acts
}

export async function markActivityCompleted(
  studentId: string,
  subcourseId: string,
  activityType: ActivityType,
  client?: any
): Promise<string[]> {
  const current = await fetchCompletedActivities(studentId, subcourseId, false, client)
  if (current.includes(activityType)) {
    return current
  }

  const updated = Array.from(new Set([...current, activityType]))

  // 1. Cache to localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getActivityStorageKey(studentId, subcourseId), JSON.stringify(updated))
    }
  } catch {
    // ignore
  }

  // 2. Save to Supabase progress
  if (client && studentId && subcourseId) {
    try {
      await client.from('progress').upsert(
        {
          student_id: studentId,
          subcourse_id: subcourseId,
          status: 'in_progress',
          completed_activities: updated,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'student_id,subcourse_id' }
      )
    } catch {
      // Ignore if completed_activities column pending migration
    }
  }

  return updated
}
