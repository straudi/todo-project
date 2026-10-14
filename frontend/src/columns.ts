import { CircleCheck, ClipboardCheck, LoaderCircle, type LucideIcon } from 'lucide-react'
import type { TaskStatus } from './api'

// 상태 값과 칸 이름은 DATA-MODEL.md "상태 값"을 따른다.
// 칸 순서(왼쪽부터 할 일 → 진행 중 → 완료)는 SCREEN-SPEC.md "대안과 결정"을 따른다.
// 아이콘은 DESIGN.md "아이콘"을 따른다.
export const COLUMNS: { status: TaskStatus; label: string; Icon: LucideIcon }[] = [
  { status: 'TODO', label: '할 일', Icon: ClipboardCheck },
  { status: 'IN_PROGRESS', label: '진행 중', Icon: LoaderCircle },
  { status: 'DONE', label: '완료', Icon: CircleCheck },
]
