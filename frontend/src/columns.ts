import { CircleCheck, ClipboardCheck, LoaderCircle, type LucideIcon } from 'lucide-react'
import type { TaskStatus } from './api'

// 상태 값과 칸 이름은 DATA-MODEL.md "상태 값"을 따른다.
// 칸 순서(왼쪽부터 할 일 → 진행 중 → 완료)는 SCREEN-SPEC.md "대안과 결정"을 따른다.
// 칸 설명은 SCREEN-SPEC.md "S-01 보이는 요소", 아이콘은 DESIGN.md "아이콘"을 따른다.
export const COLUMNS: { status: TaskStatus; label: string; description: string; Icon: LucideIcon }[] = [
  { status: 'TODO', label: '할 일', description: '해야 할 일을 정리해요', Icon: ClipboardCheck },
  { status: 'IN_PROGRESS', label: '진행 중', description: '지금 진행하고 있어요', Icon: LoaderCircle },
  { status: 'DONE', label: '완료', description: '완료된 작업들이에요', Icon: CircleCheck },
]
