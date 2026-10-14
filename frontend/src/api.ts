// 필드 이름과 상태 값은 API-SPEC.md "카드 필드"를 따른다.
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export type Task = {
  id: number
  title: string
  description: string | null
  status: TaskStatus
}

// 입력 오류는 칸별로 온다 (API-SPEC.md "오류").
export type InputError = { field: string | null; reason: string }

export class ApiInputError extends Error {
  errors: InputError[]

  constructor(errors: InputError[]) {
    super('input error')
    this.errors = errors
  }
}

/** 이미 지워진 카드에 대한 요청 (404 TASK_NOT_FOUND). 다른 기기에서 지웠을 수 있다. */
export class TaskNotFoundError extends Error {
  constructor() {
    super('task not found')
  }
}

async function throwIfTaskNotFound(response: Response): Promise<void> {
  if (response.status !== 404) {
    return
  }
  const body = await response.json().catch(() => null)
  if (body?.errors?.some((e: InputError) => e.reason === 'TASK_NOT_FOUND')) {
    throw new TaskNotFoundError()
  }
}

/** 카드 목록을 서버가 정한 순서(최근 것부터) 그대로 받는다. */
export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch('/api/tasks')
  if (!response.ok) {
    throw new Error(`GET /api/tasks failed: ${response.status}`)
  }
  return response.json()
}

/** 새 카드를 만든다. 상태는 서버가 TODO로 정한다. */
export async function createTask(title: string, description: string | null): Promise<Task> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  })
  if (response.status === 422) {
    const body = await response.json()
    throw new ApiInputError(body.errors ?? [])
  }
  if (!response.ok) {
    throw new Error(`POST /api/tasks failed: ${response.status}`)
  }
  return response.json()
}

/** 카드를 다른 상태로 옮긴다. 서버가 순서 기준 시각을 정한다. */
export async function changeTaskStatus(id: number, status: TaskStatus): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  await throwIfTaskNotFound(response)
  if (!response.ok) {
    throw new Error(`PATCH /api/tasks/${id}/status failed: ${response.status}`)
  }
  return response.json()
}

/** 카드의 제목과 설명을 고친다. 상태와 칸 안 자리는 그대로다. */
export async function updateTask(id: number, title: string, description: string | null): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  })
  if (response.status === 422) {
    const body = await response.json()
    throw new ApiInputError(body.errors ?? [])
  }
  await throwIfTaskNotFound(response)
  if (!response.ok) {
    throw new Error(`PATCH /api/tasks/${id} failed: ${response.status}`)
  }
  return response.json()
}

/** 카드를 지운다. 성공 응답(204)에는 본문이 없다. */
export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  await throwIfTaskNotFound(response)
  if (!response.ok) {
    throw new Error(`DELETE /api/tasks/${id} failed: ${response.status}`)
  }
}
