import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발할 때는 /api 요청을 FastAPI 서버로 넘긴다 (DECISIONS.md D-013).
// 브라우저 테스트는 API_TARGET으로 테스트용 서버를 가리킨다.
const apiTarget = process.env.API_TARGET ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiTarget,
    },
  },
})
