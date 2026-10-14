import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ApiInputError, type Task, type TaskStatus } from './api'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { COLUMNS } from './columns'
import {
  DELETE_FAILED_MESSAGE,
  MOVE_FAILED_MESSAGE,
  SAVE_FAILED_MESSAGE,
  TITLE_EMPTY_MESSAGE,
} from './messages'

type Props = {
  task: Task
  /** 상태를 바꾸는 요청의 응답을 기다리는 중 */
  moving: boolean
  /** 마지막 상태 바꾸기가 실패했다. 다시 시도하면 false가 된다. */
  moveFailed: boolean
  /** 마우스처럼 정밀한 포인터가 있는 기기에서만 끌 수 있다 (휴대폰은 상태 버튼만). */
  canDrag: boolean
  onMove: (status: TaskStatus) => void
  /** 성공하면 끝나고, 실패하면 오류를 던진다. */
  onSave: (title: string, description: string | null) => Promise<void>
  /** 성공하면 끝나고, 실패하면 오류를 던진다. */
  onDelete: () => Promise<void>
  /** 끌기가 끝났다 (놓았거나 그만두었다). */
  onDragEnd: () => void
}

// 수정과 삭제 확인은 카드 안에서 한다 (SCREEN-SPEC.md "대안과 결정").
type Mode = 'view' | 'edit' | 'confirmDelete'

export function TaskCard({
  task,
  moving,
  moveFailed,
  canDrag,
  onMove,
  onSave,
  onDelete,
  onDragEnd,
}: Props) {
  const [mode, setMode] = useState<Mode>('view')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showTitleError, setShowTitleError] = useState(false)
  // 저장이나 삭제의 응답을 기다리는 중. 그동안 저장, "예" 버튼을 누를 수 없다.
  const [busy, setBusy] = useState(false)
  // 실패 문구는 실패한 카드 안에 보이고, 다시 시도하면 사라진다 (SCREEN-SPEC.md "대안과 결정").
  const [saveFailed, setSaveFailed] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  // 끄는 동안 원래 자리의 카드를 흐리게 보여 준다 (DESIGN.md "부품별 규칙").
  const [dragging, setDragging] = useState(false)

  function startEdit() {
    setTitle(task.title)
    // 수정할 때는 설명 전체가 보인다 (SCREEN-SPEC.md "S-01 보이는 요소").
    setDescription(task.description ?? '')
    setShowTitleError(false)
    setSaveFailed(false)
    setMode('edit')
  }

  async function handleSave() {
    // 공백(띄어쓰기, 탭, 줄바꿈)만 있는 제목도 비어 있는 것으로 보고, 서버에 보내지 않는다.
    if (title.trim() === '') {
      setShowTitleError(true)
      return
    }
    setShowTitleError(false)
    setSaveFailed(false)
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
      } else {
        // 그 밖의 실패: 수정 중인 채로 고치던 글을 유지하고, 카드 안에 실패 문구를 보여 준다.
        setSaveFailed(true)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleteFailed(false)
    setBusy(true)
    try {
      await onDelete()
    } catch {
      // 실패하면 카드가 그대로 남고, 카드 안에 실패 문구를 보여 준다.
      setDeleteFailed(true)
      setBusy(false)
    }
  }

  function closeConfirmDelete() {
    setDeleteFailed(false)
    setMode('view')
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
        {saveFailed && (
          <p role="alert" className="action-error">
            {SAVE_FAILED_MESSAGE}
          </p>
        )}
        <div className="card-actions">
          <button type="button" className="button-primary" onClick={handleSave} disabled={busy}>
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
      data-dragging={dragging || undefined}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(task.id))
        event.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => {
        setDragging(false)
        onDragEnd()
      }}
    >
      <h3 className="card-title">{task.title}</h3>
      {task.description !== null && <p className="card-description">{task.description}</p>}
      {mode === 'confirmDelete' ? (
        <div className="card-confirm">
          <p>정말 지울까요?</p>
          {deleteFailed && (
            <p role="alert" className="action-error">
              {DELETE_FAILED_MESSAGE}
            </p>
          )}
          <div className="card-actions">
            <button type="button" className="button-danger" onClick={handleConfirmDelete} disabled={busy}>
              예
            </button>
            {/* "아니오"를 누르면 서버에 보내지 않고 카드가 그대로 남는다. */}
            <button type="button" onClick={closeConfirmDelete}>
              아니오
            </button>
          </div>
        </div>
      ) : (
        <>
          {moveFailed && (
            <p role="alert" className="action-error">
              {MOVE_FAILED_MESSAGE}
            </p>
          )}
          {/* 카드 아래 줄: 상태 버튼, 수정, 삭제 (DESIGN.md "부품별 규칙"). */}
          <div className="card-footer">
            <div className="card-status-buttons">
              {/* 상태 버튼은 세 개 모두 보이고, 지금 상태 버튼은 누를 수 없다 (SCREEN-SPEC.md "S-01 보이는 요소"). */}
              {COLUMNS.map((column) => (
                <button
                  key={column.status}
                  type="button"
                  data-current={column.status === task.status || undefined}
                  disabled={moving || column.status === task.status}
                  onClick={() => onMove(column.status)}
                >
                  {column.label}
                </button>
              ))}
            </div>
            {/* 아이콘만 보이는 버튼에도 "수정", "삭제"라는 이름을 붙인다 (DESIGN.md "아이콘"). */}
            <button
              type="button"
              className="icon-button"
              aria-label="수정"
              onClick={startEdit}
              disabled={moving}
            >
              <Pencil size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button icon-button-danger"
              aria-label="삭제"
              onClick={() => setMode('confirmDelete')}
              disabled={moving}
            >
              <Trash2 size={20} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </article>
  )
}
