import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { TaskStatus } from './api'
import { COLUMNS } from './columns'

type Props = {
  status: TaskStatus
  open: boolean
  /** 상태를 바꾸는 요청의 응답을 기다리는 중이면 누를 수 없다. */
  disabled: boolean
  onToggle: () => void
  onClose: () => void
  onPick: (status: TaskStatus) => void
}

/**
 * 카드의 상태 표시와 상태 메뉴 (SCREEN-SPEC.md "상태 표시와 상태 메뉴").
 * 세 상태가 모두 보이고, 지금 상태는 체크 표시와 함께 고를 수 없다.
 * 고르기, 메뉴 바깥 누르기, Esc 키, 상태 표시 다시 누르기로 닫힌다.
 */
export function StatusMenu({ status, open, disabled, onToggle, onClose, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const current = COLUMNS.find((column) => column.status === status)!

  useEffect(() => {
    if (!open) {
      return
    }
    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  return (
    <div className="status-menu" ref={ref} data-status={status}>
      <button
        type="button"
        className="status-pill"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={onToggle}
      >
        <current.Icon size={16} aria-hidden="true" />
        {current.label}
        {/* 메뉴가 닫혀 있으면 아래, 열려 있으면 위를 가리킨다 (DESIGN.md "아이콘"). */}
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
      {open && (
        <div className="status-menu-list" role="group" aria-label="상태 고르기">
          {COLUMNS.map((column) => {
            const isCurrent = column.status === status
            return (
              <button
                key={column.status}
                type="button"
                className="status-menu-item"
                data-status={column.status}
                data-current={isCurrent || undefined}
                disabled={isCurrent}
                onClick={() => onPick(column.status)}
              >
                <column.Icon className="status-menu-icon" size={12} absoluteStrokeWidth aria-hidden="true" />
                <span className="status-menu-label">{column.label}</span>
                {isCurrent && <Check size={16} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
