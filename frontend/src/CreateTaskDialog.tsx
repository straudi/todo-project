import { useState } from 'react'
import { ApiInputError, createTask, type Task } from './api'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { TITLE_EMPTY_MESSAGE } from './messages'

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

  async function handleCreate() {
    // 공백(띄어쓰기, 탭, 줄바꿈)만 있는 제목도 비어 있는 것으로 보고, 서버에 보내지 않는다.
    if (title.trim() === '') {
      setShowTitleError(true)
      return
    }
    setShowTitleError(false)
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
      }
      // 그 밖의 실패: 창을 열어 둔 채 입력한 내용을 유지한다 (D-008). 실패 알림은 SCREEN-SPEC.md "미정".
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop">
      <div role="dialog" aria-modal="true" aria-label="카드 만들기" className="dialog">
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
        <div className="dialog-actions">
          <button type="button" onClick={handleCreate} disabled={submitting}>
            만들기
          </button>
          <button type="button" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
