// 필드 이름과 상태 값은 API-SPEC.md "카드 필드"를 따른다.
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export type Task = {
  id: number
  title: string
  description: string | null
  status: TaskStatus
}

/** 카드 목록을 서버가 정한 순서(최근 것부터) 그대로 받는다. */
export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch('/api/tasks')
  if (!response.ok) {
    throw new Error(`GET /api/tasks failed: ${response.status}`)
  }
  return response.json()
}
