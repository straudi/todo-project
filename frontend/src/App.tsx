import { useEffect, useState } from 'react'
import { fetchTasks, type Task, type TaskStatus } from './api'

// 상태 값과 칸 이름은 DATA-MODEL.md "상태 값"을 따른다.
// 칸 순서(왼쪽부터 할 일 → 진행 중 → 완료)는 SCREEN-SPEC.md "대안과 결정"을 따른다.
const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: '할 일' },
  { status: 'IN_PROGRESS', label: '진행 중' },
  { status: 'DONE', label: '완료' },
]

function App() {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    // 목록을 받지 못했을 때 보여 줄 것은 SCREEN-SPEC.md "미정"이라, 빈 칸 그대로 둔다.
    fetchTasks()
      .then(setTasks)
      .catch(() => {})
  }, [])

  return (
    <main className="board">
      {/* 만들기 창(S-02)은 P-14에서 연결한다. */}
      <button type="button" className="new-card-button">
        새 카드
      </button>
      <div className="columns">
        {COLUMNS.map((column) => (
          <section key={column.status} className="column" aria-label={column.label}>
            <h2 className="column-title">{column.label}</h2>
            {/* 서버가 준 순서를 바꾸지 않고 칸별로 나눈다. */}
            {tasks
              .filter((task) => task.status === column.status)
              .map((task) => (
                <article key={task.id} className="card">
                  <h3 className="card-title">{task.title}</h3>
                  {task.description !== null && (
                    <p className="card-description">{task.description}</p>
                  )}
                </article>
              ))}
          </section>
        ))}
      </div>
    </main>
  )
}

export default App
