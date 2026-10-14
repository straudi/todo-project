// 상태 값과 칸 이름은 DATA-MODEL.md "상태 값"을 따른다.
// 칸 순서(왼쪽부터 할 일 → 진행 중 → 완료)는 SCREEN-SPEC.md "대안과 결정"을 따른다.
const COLUMNS = [
  { status: 'TODO', label: '할 일' },
  { status: 'IN_PROGRESS', label: '진행 중' },
  { status: 'DONE', label: '완료' },
] as const

function App() {
  return (
    <main className="board">
      {/* 만들기 창(S-02)은 P-14에서 연결한다. */}
      <button type="button" className="new-card-button">
        새 카드
      </button>
      <div className="columns">
        {COLUMNS.map((column) => (
          <section key={column.status} className="column" aria-label={column.label}>
            <h2 className="column-title">{column.label}</h2>
          </section>
        ))}
      </div>
    </main>
  )
}

export default App
