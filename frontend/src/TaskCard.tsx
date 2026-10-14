import type { Task, TaskStatus } from './api'
import { COLUMNS } from './columns'

type Props = {
  task: Task
  /** 상태를 바꾸는 요청의 응답을 기다리는 중 */
  moving: boolean
  /** 마우스처럼 정밀한 포인터가 있는 기기에서만 끌 수 있다 (휴대폰은 상태 버튼만). */
  canDrag: boolean
  onMove: (status: TaskStatus) => void
}

export function TaskCard({ task, moving, canDrag, onMove }: Props) {
  return (
    <article
      className="card"
      draggable={canDrag && !moving}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(task.id))
        event.dataTransfer.effectAllowed = 'move'
      }}
    >
      <h3 className="card-title">{task.title}</h3>
      {task.description !== null && <p className="card-description">{task.description}</p>}
      <div className="card-status-buttons">
        {/* 상태 버튼은 세 개 모두 보이고, 지금 상태 버튼은 누를 수 없다 (SCREEN-SPEC.md "S-01 보이는 요소"). */}
        {COLUMNS.map((column) => (
          <button
            key={column.status}
            type="button"
            disabled={moving || column.status === task.status}
            onClick={() => onMove(column.status)}
          >
            {column.label}
          </button>
        ))}
      </div>
    </article>
  )
}
