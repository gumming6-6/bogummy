import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ❗ 레포 이름으로 꼭 바꾸세요. 예: '/poka-list/'
  base: '/bogummy/',
})
