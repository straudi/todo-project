# 할 일 카드

할 일을 카드로 만들고, 카드의 상태를 "할 일 / 진행 중 / 완료" 중에서 바꾸는 웹앱입니다.

## 현재 상태

두 번째 버전을 완성했습니다 (2026-10-15, 태그 `v2.0.0`). 자동 테스트와 AI 확인(TEST-PLAN.md의 시나리오 중 휴대폰 T-30, T-31을 뺀 전부, [D-015](DECISIONS.md))을 통과했습니다. 첫 버전은 2026-10-14에 완성했습니다 (태그 `v1.0.0`, 사람 확인 T-01 ~ T-45 통과). 화면(`frontend/`)과 서버(`backend/`)를 이어, 저장된 카드가 상태별 칸에 보이고, 카드를 만들 수 있습니다. 새로고침하거나 브라우저를 다시 열어도 카드가 남아 있고, 좁은 화면에서는 세 칸이 세로로 쌓입니다. 카드가 없는 칸에는 "카드 없음"이 보입니다. 칸 이름 옆에 그 칸의 카드 개수가 보이고, 카드 아래 줄에는 그 카드를 만든 날짜가 보입니다. 카드의 상태 표시를 눌러 메뉴에서 고르거나, 끌어다 놓기(컴퓨터만)로 상태를 바꿀 수 있습니다. 카드 안에서 내용을 고치거나, "정말 지울까요?"를 확인한 뒤 지울 수 있습니다. 만들기, 수정, 상태 바꾸기, 삭제가 실패하면 그 자리에 안내 문구가 보입니다. 화면에는 DESIGN.md의 색, 글자, 여백, 모양 규칙이 들어가 있습니다. "실행 방법"대로 켜면 서버 하나가 화면과 카드 저장을 함께 맡고, 같은 와이파이의 휴대폰에서도 열 수 있습니다. 그 뒤 화면 다듬기(P-31, 2026-10-23)로 모양을 "또렷한 편집형"(흰 바탕, 굵은 검은 선, 어긋난 그림자, 노란 주 버튼, 상태색)으로 바꾸고, 보드 맨 위에 앱 제목 "할 일 카드"와 상태별 카드 개수 요약 줄, 만들기 창 제목 "새 카드", 상태 표시의 화살표를 더했습니다. 기능은 그대로입니다. 자동 테스트와 AI 화면 확인을 통과했고([D-016](DECISIONS.md)), DESIGN.md 3차는 사람이 승인했습니다(2026-10-23). 작업별 진행 상황은 [PLAN.md](PLAN.md) "작업 목록"에 있습니다.

- 앱 안에 AI 기능은 넣지 않습니다.

## 프로젝트 문서

| 문서 | 내용 |
| --- | --- |
| [README.md](README.md) | 이 프로젝트가 무엇이고, 지금 어떤 상태이고, 어떻게 실행하는지 (사람용) |
| [AGENTS.md](AGENTS.md) | AI가 일할 때 지킬 규칙 |
| [DECISIONS.md](DECISIONS.md) | 다르게 정할 수도 있었던 중요한 선택과 그 이유 (사람이 확정함) |
| [PLAN.md](PLAN.md) | 작업, 상태, 완료 조건, 확인 결과, 다음 행동 |
| [PRD.md](PRD.md) | 사용자가 보거나 겪는 일 (무엇을 만들지) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 부품과 책임, 데이터 흐름 (어떤 구조로) |
| [SCREEN-SPEC.md](SCREEN-SPEC.md) | 화면에서 보이는 것과 할 수 있는 행동 |
| [DATA-MODEL.md](DATA-MODEL.md) | 저장할 정보의 이름과 뜻 |
| [API-SPEC.md](API-SPEC.md) | 화면과 서버가 주고받는 약속 |
| [TEST-PLAN.md](TEST-PLAN.md) | 무엇을 보면 통과인지 (시험 문제와 정답) |
| [DESIGN.md](DESIGN.md) | 화면이 어떻게 보이는지 (색, 글자, 여백, 모양 규칙) |

## 시작 방법

1. 이 폴더를 엽니다.
2. 이 README.md를 처음부터 끝까지 읽습니다.
3. "현재 상태"에서 지금 어디까지 만들었는지 확인합니다.

## 실행 방법

Windows의 PowerShell 기준입니다. 명령은 이 폴더(`todo-project`)에서 시작합니다.

### 필요한 것

- Node.js와 npm, Python 3.12 (이 컴퓨터에 설치된 버전은 [AGENTS.md](AGENTS.md) "환경"에 있습니다)

### 처음 한 번만: 준비

서버가 쓸 Python 패키지와 화면이 쓸 패키지를 설치합니다.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
cd ..\frontend
npm install
cd ..
```

### 켜기

화면을 빌드한 뒤, 서버 하나가 화면과 카드 저장을 함께 맡습니다 ([D-013](DECISIONS.md)).

```powershell
cd frontend
npm run build
cd ..\backend
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- 브라우저에서 http://localhost:8000 을 엽니다.
- 카드는 `backend/data/tasks.db`에 저장됩니다. 껐다 켜도 남아 있습니다.
- 개발 서버(아래 "개발할 때")가 켜져 있으면 포트 8000이 겹쳐 켜지지 않습니다. 개발 서버를 먼저 끕니다.

### 끄기

서버를 켠 PowerShell 창에서 `Ctrl + C`를 누릅니다.

### 휴대폰에서 열기

내 컴퓨터와 같은 와이파이에 연결된 휴대폰에서 열 수 있습니다 ([D-009](DECISIONS.md)).

1. 처음 켤 때 Windows 방화벽 창이 뜨면 **"개인 네트워크"만** 허용합니다. 로그인이 없어서 같은 네트워크의 누구나 카드를 볼 수 있으므로, 공용 와이파이에서는 허용하지 않습니다.
2. PowerShell에서 `ipconfig`를 실행해, 연결된 와이파이의 "IPv4 주소"(예: `192.168.0.10`)를 확인합니다.
3. 휴대폰 브라우저에서 `http://<IPv4 주소>:8000` 을 엽니다.

### 개발할 때

화면 개발 서버와 서버를 따로 켭니다. 화면 개발 서버가 `/api` 요청을 서버로 넘깁니다 ([D-013](DECISIONS.md)). 이때 서버는 내 컴퓨터에서만 열립니다.

```powershell
cd backend
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```powershell
cd frontend
npm run dev
```

- 화면: http://localhost:5173

### 자동 테스트

```powershell
cd backend
.venv\Scripts\python -m pytest -v
```

```powershell
cd e2e
npm install
npx playwright test
```

- 브라우저 테스트는 이 컴퓨터에 설치된 Chrome을 쓰고, 실제 카드(`backend/data/tasks.db`)를 건드리지 않습니다 ([D-012](DECISIONS.md)).

## 확인과 기록

- 무언가를 만들거나 바꾸면 "현재 상태"를 그에 맞게 고칩니다.
- 새 문서를 만들면 "프로젝트 문서" 표에 추가합니다. PLAN.md의 "참고 문서" 표와 AGENTS.md의 "문서 역할" 표도 함께 고칩니다.
- 실행 방법이 정해지면 "실행 방법"을 채웁니다.
