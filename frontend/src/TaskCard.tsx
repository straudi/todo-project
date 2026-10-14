import { useState } from 'react'
import { ApiInputError, type Task, type TaskStatus } from './api'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { COLUMNS } from './columns'
import { TITLE_EMPTY_MESSAGE } from './messages'

type Props = {
  task: Task
  /** 상태를 바꾸는 요청의 응답을 기다리는 중 */
  moving: boolean
  /** 마우스처럼 정밀한 포인터가 있는 기기에서만 끌 수 있다 (휴대폰은 상태 버튼만). */
  canDrag: boolean
  onMove: (status: TaskStatus) => void
  /** 성공하면 끝나고, 실패하면 오류를 던진다. */
  onSave: (title: string, description: string | null) => Promise<void>
  /** 성공하면 끝나고, 실패하면 오류를 던진다. */
  onDelete: () => Promise<void>
}

// 수정과 삭제 확인은 카드 안에서 한다 (SCREEN-SPEC.md "대안과 결정").
type Mode = 'view' | 'edit' | 'confirmDelete'

export function TaskCard({ task, moving, canDrag, onMove, onSave, onDelete }: Props) {
  const [mode, setMode] = useState<Mode>('view')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showTitleError, setShowTitleError] = useState(false)
  // 저장이나 삭제의 응답을 기다리는 중. 그동안 저장, "예" 버튼을 누를 수 없다.
  const [busy, setBusy] = useState(false)

  function startEdit() {
    setTitle(task.title)
    // 수정할 때는 설명 전체가 보인다 (SCREEN-SPEC.md "S-01 보이는 요소").
    setDescription(task.description ?? '')
    setShowTitleError(false)
    setMode('edit')
  }

  async function handleSave() {
    // 공백(띄어쓰기, 탭, 줄바꿈)만 있는 제목도 비어 있는 것으로 보고, 서버에 보내지 않는다.
    if (title.trim() === '') {
      setShowTitleError(true)
      return
    }
    setShowTitleError(false)
    setBusy(true)
    try {
      await onSave(title, description.trim() === '' ? null : description)
      setMode('view')
    } catch (error) {
      if (
        error instanceof ApiInputError &&
        error.errors.some((e) => e.field === 'title' && e.reason === 'TITLE_EMPTY')
      ) {
        setShowTitleError(true)
      }
      // 그 밖의 실패: 수정 중인 채로 고치던 글을 유지한다. 실패 알림은 SCREEN-SPEC.md "미정".
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmDelete() {
    setBusy(true)
    try {
      await onDelete()
    } catch {
      // 실패하면 카드가 그대로 남는다. 실패 알림은 SCREEN-SPEC.md "미정".
      setBusy(false)
    }
  }

  if (mode === 'edit') {
    // 수정 중에는 제목칸, 설명칸, 저장, 취소만 보인다. 상태 버튼, 삭제, 끌기는 없다.
    return (
      <article className="card card-editing">
        <label className="field">
          제목
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {showTitleError && (
          <p role="alert" className="field-error">
            {TITLE_EMPTY_MESSAGE}
          </p>
        )}
        <label className="field">
          설명
          <AutoGrowTextarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="card-actions">
          <button type="button" onClick={handleSave} disabled={busy}>
            저장
          </button>
          {/* 취소하면 서버에 보내지 않고 원래 내용을 보여 준다. */}
          <button type="button" onClick={() => setMode('view')}>
            취소
          </button>
        </div>
      </article>
    )
  }

  return (
    <article
      className="card"
      draggable={canDrag && !moving && mode === 'view'}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(task.id))
        event.dataTransfer.effectAllowed = 'move'
      }}
    >
      <h3 className="card-title">{task.title}</h3>
      {task.description !== null && <p className="card-description">{task.description}</p>}
      {mode === 'confirmDelete' ? (
        <div className="card-confirm">
          <p>정말 지울까요?</p>
          <div className="card-actions">
            <button type="button" onClick={handleConfirmDelete} disabled={busy}>
              예
            </button>
            {/* "아니오"를 누르면 서버에 보내지 않고 카드가 그대로 남는다. */}
            <button type="button" onClick={() => setMode('view')}>
              아니오
            </button>
          </div>
        </div>
      ) : (
        <>
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
          <div className="card-actions">
            <button type="button" onClick={startEdit} disabled={moving}>
              수정
            </button>
            <button type="button" onClick={() => setMode('confirmDelete')} disabled={moving}>
              삭제
            </button>
          </div>
        </>
      )}
    </article>
  )
}
