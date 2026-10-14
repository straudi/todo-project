import { useEffect, useState } from 'react'
import { changeTaskStatus, fetchTasks, type Task, type TaskStatus } from './api'
import { COLUMNS } from './columns'
import { CreateTaskDialog } from './CreateTaskDialog'
import { TaskCard } from './TaskCard'

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [creating, setCreating] = useState(false)
  // 상태를 바꾸는 중인 카드. 응답이 올 때까지 그 카드의 상태 버튼과 끌기를 막는다.
  const [movingIds, setMovingIds] = useState<ReadonlySet<number>>(new Set())
  // 휴대폰은 상태 버튼만 쓴다 (SCREEN-SPEC.md "대안과 결정").
  const [canDrag] = useState(() => window.matchMedia('(pointer: fine)').matches)

  useEffect(() => {
    // 목록을 받지 못했을 때 보여 줄 것은 SCREEN-SPEC.md "미정"이라, 빈 칸 그대로 둔다.
    fetchTasks()
      .then(setTasks)
      .catch(() => {})
  }, [])

  function handleCreated(task: Task) {
    // 새 카드는 "할 일" 칸 맨 위에 놓는다 (ARCHITECTURE.md "주요 데이터 흐름").
    setTasks((previous) => [task, ...previous])
    setCreating(false)
  }

  async function moveTask(task: Task, status: TaskStatus) {
    // 원래 칸으로는 보내지 않는다. 자리도 그대로다 (API-SPEC.md "API 계약 결정 기록").
    if (task.status === status || movingIds.has(task.id)) {
      return
    }
    setMovingIds((previous) => new Set(previous).add(task.id))
    try {
      const moved = await changeTaskStatus(task.id, status)
      // 서버가 성공을 알린 뒤에 카드를 새 칸 맨 위에 놓는다.
      setTasks((previous) => [moved, ...previous.filter((t) => t.id !== moved.id)])
    } catch {
      // 실패하면 카드는 원래 칸, 원래 자리에 있다. 실패 알림은 SCREEN-SPEC.md "미정".
    } finally {
      setMovingIds((previous) => {
        const next = new Set(previous)
        next.delete(task.id)
        return next
      })
    }
  }

  function handleDrop(event: React.DragEvent, status: TaskStatus) {
    event.preventDefault()
    const id = Number(event.dataTransfer.getData('text/plain'))
    const task = tasks.find((t) => t.id === id)
    if (task) {
      // 놓은 자리와 상관없이 새 칸 맨 위에 놓인다 (SCREEN-SPEC.md "사용자 조작").
      void moveTask(task, status)
    }
  }

  return (
    <main className="board">
      <button type="button" className="new-card-button" onClick={() => setCreating(true)}>
        새 카드
      </button>
      <div className="columns">
        {COLUMNS.map((column) => {
          // 서버가 준 순서를 바꾸지 않고 칸별로 나눈다.
          const columnTasks = tasks.filter((task) => task.status === column.status)
          return (
            <section
              key={column.status}
              className="column"
              aria-label={column.label}
              onDragOver={canDrag ? (event) => event.preventDefault() : undefined}
              onDrop={canDrag ? (event) => handleDrop(event, column.status) : undefined}
            >
              <h2 className="column-title">{column.label}</h2>
              {/* 카드가 없는 칸의 문구는 PRD.md F-05를 따른다. */}
              {columnTasks.length === 0 && <p className="column-empty">카드 없음</p>}
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  moving={movingIds.has(task.id)}
                  canDrag={canDrag}
                  onMove={(status) => void moveTask(task, status)}
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

export default App
