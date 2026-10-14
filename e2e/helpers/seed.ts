import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { PYTHON, ROOT, TEST_DB_PATH } from './paths'

export type SeedTask = {
  id: number
  title: string
  description: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  ordered_at: number
}

/** 테스트용 저장소를 비우고 카드를 넣는다. 화면은 이 저장소에 직접 닿지 않는다. */
export function seedTasks(tasks: SeedTask[], dbPath: string = TEST_DB_PATH): void {
  execFileSync(PYTHON, [path.join(ROOT, 'e2e', 'helpers', 'seed_db.py'), dbPath], {
    input: JSON.stringify(tasks),
  })
}
