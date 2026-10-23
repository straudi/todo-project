import { useState } from 'react'
import { ApiInputError, createTask, type Task } from './api'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { SAVE_FAILED_MESSAGE, TITLE_EMPTY_MESSAGE } from './messages'

type Props = {
  onCreated: (task: Task) => void
  onCancel: () => void
}

/** S-02 카드 만들기 창. 취소 버튼으로만 닫힌다 (SCREEN-SPEC.md "대안과 결정"). */
export function CreateTaskDialog({ onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showTitleError, setShowTitleError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  async function handleCreate() {
    // 공백(띄어쓰기, 탭, 줄바꿈)만 있는 제목도 비어 있는 것으로 보고, 서버에 보내지 않는다.
    if (title.trim() === '') {
      setShowTitleError(true)
      return
    }
    setShowTitleError(false)
    setSaveFailed(false)
    // 응답이 올 때까지 만들기 버튼을 누를 수 없다 (같은 카드가 두 장 생기지 않게).
    setSubmitting(true)
    try {
      const task = await createTask(title, description.trim() === '' ? null : description)
      onCreated(task)
    } catch (error) {
      if (
        error instanceof ApiInputError &&
        error.errors.some((e) => e.field === 'title' && e.reason === 'TITLE_EMPTY')
      ) {
        setShowTitleError(true)
      } else {
        // 그 밖의 실패: 창을 열어 둔 채 입력한 내용을 유지하고 (D-008), 창 안에 실패 문구를 보여 준다.
        setSaveFailed(true)
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop">
      <div role="dialog" aria-modal="true" aria-label="카드 만들기" className="dialog">
        {/* 보이는 창 제목 (SCREEN-SPEC.md S-02 "창 제목"). 화면 읽기 이름은 "카드 만들기" 그대로 둔다. */}
        <h2 className="dialog-title">새 카드</h2>
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
        <div className="dialog-actions">
          <button type="button" className="button-primary" onClick={handleCreate} disabled={submitting}>
            만들기
          </button>
          {/* 처리 중에는 취소도 누를 수 없다. 이미 보낸 요청을 되돌릴 수 없기 때문이다 (SCREEN-SPEC.md "대안과 결정"). */}
          <button type="button" onClick={onCancel} disabled={submitting}>
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
