import { Plus } from 'lucide-react'
import type { TaskStatus } from './api'
import { COLUMNS } from './columns'

/** 칸별 카드 개수. 칸 머리와 요약 줄이 같은 값을 쓴다. */
export type StatusCounts = Record<TaskStatus, number>

type Props = {
  /** 목록을 받지 못했으면 null이고, 요약 줄을 그리지 않는다. */
  counts: StatusCounts | null
  onCreate: () => void
}

/** 보드 머리 영역: 앱 제목, 새 카드 버튼, 요약 줄 (SCREEN-SPEC.md S-01 "앱 제목", "요약 줄"). */
export function BoardHeader({ counts, onCreate }: Props) {
  return (
    <header className="board-header">
      <div className="board-header-row">
        <h1 className="board-title">할 일 카드</h1>
        <button type="button" className="new-card-button button-primary" onClick={onCreate}>
          <Plus size={20} aria-hidden="true" />
          새 카드
        </button>
      </div>
      {counts && (
        <div role="group" aria-label="상태별 카드 개수" className="board-summary">
          {COLUMNS.map((column) => (
            <span key={column.status} className="summary-tag" data-status={column.status}>
              {column.label} {counts[column.status]}
            </span>
          ))}
          <span className="summary-total">
            · 모두 {COLUMNS.reduce((sum, column) => sum + counts[column.status], 0)}장
          </span>
        </div>
      )}
    </header>
  )
}
