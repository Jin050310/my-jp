import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' : GitHub Pages 프로젝트 페이지(https://<user>.github.io/<repo>/)에서도
// 저장소 이름과 무관하게 정적 파일 경로가 깨지지 않도록 상대 경로를 사용합니다.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
});
