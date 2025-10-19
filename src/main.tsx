import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// -------- (추가) admin=1일 때 인증 완료 전까지 렌더 지연 --------
const params = new URLSearchParams(location.search);
const isAdminMode = params.get('admin') === '1';
if (isAdminMode && !document.documentElement.classList.contains('admin-on')) {
  // html.admin-on 클래스가 붙을 때까지 기다렸다가 렌더 시작
  throw new Promise<void>((resolve) => {
    const obs = new MutationObserver(() => {
      if (document.documentElement.classList.contains('admin-on')) {
        obs.disconnect();
        resolve();
      }
    });
    obs.observe(document.documentElement, { attributes: true });
  });
}
// ------------------------------------------------------------------

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
