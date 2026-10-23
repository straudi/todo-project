import { useCallback, useEffect, useState } from 'react'
import {
  changeTaskStatus,
  deleteTask,
  fetchTasks,
  TaskNotFoundError,
  updateTask,
  type Task,
  type TaskStatus,
} from './api'
import { BoardHeader, type StatusCounts } from './BoardHeader'
import { COLUMNS } from './columns'
import { DELETED_ELSEWHERE_MESSAGE, LOAD_FAILED_MESSAGE } from './messages'
import { CreateTaskDialog } from './CreateTaskDialog'
import { TaskCard } from './TaskCard'

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [creating, setCreating] = useState(false)
  // 상태를 바꾸는 중인 카드. 응답이 올 때까지 그 카드의 상태 버튼과 끌기를 막는다.
  const [movingIds, setMovingIds] = useState<ReadonlySet<number>>(new Set())
  // 마지막 상태 바꾸기가 실패한 카드. 그 카드 안에 실패 문구가 보인다.
  const [moveFailedIds, setMoveFailedIds] = useState<ReadonlySet<number>>(new Set())
  // 처음 열 때 목록을 받지 못했다 (SCREEN-SPEC.md "대안과 결정").
  const [loadFailed, setLoadFailed] = useState(false)
  // 카드를 끄는 동안 마우스가 올라간 칸. 그 칸에 테두리를 두른다 (DESIGN.md "부품별 규칙").
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)
  // 상태 메뉴가 열린 카드. 메뉴는 한 번에 하나만 열린다 (SCREEN-SPEC.md "상태 표시와 상태 메뉴").
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const closeMenu = useCallback(() => setOpenMenuId(null), [])
  // 이미 지워진 카드를 건드렸을 때 보드 위에 보이는 안내. "닫기"로 닫는다.
  const [deletedElsewhere, setDeletedElsewhere] = useState(false)
  // 휴대폰은 상태 버튼만 쓴다 (SCREEN-SPEC.md "대안과 결정").
  const [canDrag] = useState(() => window.matchMedia('(pointer: fine)').matches)

  useEffect(() => {
    fetchTasks()
      .then((loaded) => {
        setTasks(loaded)
        setLoadFailed(false)
      })
      .catch(() => setLoadFailed(true))
  }, [])

  function handleCreated(task: Task) {
    // 새 카드는 "할 일" 칸 맨 위에 놓는다 (ARCHITECTURE.md "주요 데이터 흐름").
    setTasks((previous) => [task, ...previous])
    setCreating(false)
  }

  // 서버가 "그 카드가 없다"고 알려 주면(다른 기기에서 지움) 화면에서도 그 카드를 뺀다.
  function dropFromBoard(id: number) {
    setTasks((previous) => previous.filter((t) => t.id !== id))
    setOpenMenuId((current) => (current === id ? null : current))
    setMoveFailedIds((previous) => withoutId(previous, id))
  }

  async function moveTask(task: Task, status: TaskStatus) {
    // 원래 칸으로는 보내지 않는다. 자리도 그대로다 (API-SPEC.md "API 계약 결정 기록").
    if (task.status === status || movingIds.has(task.id)) {
      return
    }
    setMovingIds((previous) => new Set(previous).add(task.id))
    setMoveFailedIds((previous) => withoutId(previous, task.id))
    try {
      const moved = await changeTaskStatus(task.id, status)
      // 서버가 성공을 알린 뒤에 카드를 새 칸 맨 위에 놓는다.
      setTasks((previous) => [moved, ...previous.filter((t) => t.id !== moved.id)])
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        dropFromBoard(task.id)
        setDeletedElsewhere(true)
        return
      }
      // 실패하면 카드는 원래 칸, 원래 자리에 있고, 카드 안에 실패 문구가 보인다.
      setMoveFailedIds((previous) => new Set(previous).add(task.id))
    } finally {
      setMovingIds((previous) => withoutId(previous, task.id))
    }
  }

  async function saveTask(task: Task, title: string, description: string | null) {
    let updated: Task
    try {
      updated = await updateTask(task.id, title, description)
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        // 저장할 카드가 없으므로 고치던 글과 함께 카드를 뺀다.
        dropFromBoard(task.id)
        setDeletedElsewhere(true)
        return
      }
      throw error
    }
    // 내용만 고친 카드는 칸 안의 자리가 바뀌지 않는다 (PRD.md F-02).
    setTasks((previous) => previous.map((t) => (t.id === updated.id ? updated : t)))
  }

  async function removeTask(task: Task) {
    try {
      await deleteTask(task.id)
    } catch (error) {
      // 이미 지워져 있으면 지우려던 결과가 이루어진 것이므로, 안내 없이 카드만 뺀다.
      if (!(error instanceof TaskNotFoundError)) {
        throw error
      }
    }
    dropFromBoard(task.id)
  }

  // 칸에 들어오거나 칸 위에 있으면 그 칸에 테두리를 두른다.
  function handleDragOver(event: React.DragEvent, status: TaskStatus) {
    event.preventDefault()
    setDropTarget(status)
  }

  function handleDragLeave(event: React.DragEvent, status: TaskStatus) {
    // 칸 안의 카드로 옮겨 갈 때도 dragleave가 온다. 끌기 중에는 relatedTarget이 비어 있을 수 있어서,
    // 마우스가 아직 칸 영역 안에 있으면 칸을 떠난 것으로 보지 않는다.
    const box = event.currentTarget.getBoundingClientRect()
    const inside =
      event.clientX > box.left &&
      event.clientX < box.right &&
      event.clientY > box.top &&
      event.clientY < box.bottom
    if (!inside) {
      // 다른 칸에 먼저 들어온 뒤에 이 칸의 dragleave가 올 수 있으니, 이 칸의 테두리만 지운다.
      setDropTarget((current) => (current === status ? null : current))
    }
  }

  function handleDrop(event: React.DragEvent, status: TaskStatus) {
    event.preventDefault()
    setDropTarget(null)
    const id = Number(event.dataTransfer.getData('text/plain'))
    const task = tasks.find((t) => t.id === id)
    if (task) {
      // 놓은 자리와 상관없이 새 칸 맨 위에 놓인다 (SCREEN-SPEC.md "사용자 조작").
      void moveTask(task, status)
    }
  }

  // 칸별 개수는 한 번만 세어 칸 머리와 요약 줄에 함께 쓴다. 목록을 받지 못했으면 null (PRD.md F-05).
  const counts: StatusCounts | null = loadFailed
    ? null
    : {
        TODO: tasks.filter((task) => task.status === 'TODO').length,
        IN_PROGRESS: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
        DONE: tasks.filter((task) => task.status === 'DONE').length,
      }

  return (
    <main className="board">
      <BoardHeader counts={counts} onCreate={() => setCreating(true)} />
      {loadFailed && (
        <p role="alert" className="action-error">
          {LOAD_FAILED_MESSAGE}
        </p>
      )}
      {deletedElsewhere && (
        <div role="status" className="board-notice">
          <p>{DELETED_ELSEWHERE_MESSAGE}</p>
          <button type="button" onClick={() => setDeletedElsewhere(false)}>
            닫기
          </button>
        </div>
      )}
      <div className="columns">
        {COLUMNS.map((column) => {
          // 서버가 준 순서를 바꾸지 않고 칸별로 나눈다.
          const columnTasks = tasks.filter((task) => task.status === column.status)
          return (
            <section
              key={column.status}
              className="column"
              aria-label={column.label}
              data-status={column.status}
              data-drop-target={dropTarget === column.status || undefined}
              onDragEnter={canDrag ? (event) => handleDragOver(event, column.status) : undefined}
              onDragOver={canDrag ? (event) => handleDragOver(event, column.status) : undefined}
              onDragLeave={canDrag ? (event) => handleDragLeave(event, column.status) : undefined}
              onDrop={canDrag ? (event) => handleDrop(event, column.status) : undefined}
            >
              <header className="column-header">
                <column.Icon className="column-icon" size={28} aria-hidden="true" />
                <h2 className="column-title">{column.label}</h2>
                {/* 칸별 카드 개수. 목록을 받지 못했으면 보이지 않는다 (PRD.md F-05). */}
                {counts && (
                  <span className="column-count" aria-label={`카드 ${counts[column.status]}장`}>
                    {counts[column.status]}
                  </span>
                )}
              </header>
              {/* 카드가 없는 칸의 문구는 PRD.md F-05를 따른다. 목록을 받지 못했으면 보이지 않는다. */}
              {columnTasks.length === 0 && !loadFailed && <p className="column-empty">카드 없음</p>}
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  moving={movingIds.has(task.id)}
                  moveFailed={moveFailedIds.has(task.id)}
                  canDrag={canDrag}
                  menuOpen={openMenuId === task.id}
                  onMenuToggle={() =>
                    setOpenMenuId((current) => (current === task.id ? null : task.id))
                  }
                  onMenuClose={closeMenu}
                  onMove={(status) => void moveTask(task, status)}
                  onSave={(title, description) => saveTask(task, title, description)}
                  onDelete={() => removeTask(task)}
                  onDragEnd={() => setDropTarget(null)}
                />
              ))}
            </section>
          )
        })}
      </div>
      {creating && (
        <CreateTaskDialog onCreated={handleCreated} onCancel={() => setCreating(false)} />
      )}
    </main>
  )
}

function withoutId(ids: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const next = new Set(ids)
  next.delete(id)
  return next
}

export default App
