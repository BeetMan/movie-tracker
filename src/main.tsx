import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import { applyInitialTheme } from '@/hooks/useTheme'

applyInitialTheme()

// 子路径部署（如 Cloudflare 上的 /movie/）时给路由加 basename；base 为相对路径 './' 时不设
// 去掉尾斜杠：/movie 与 /movie/ 两种访问都能匹配
const basename = import.meta.env.BASE_URL.startsWith('/')
  ? import.meta.env.BASE_URL.replace(/\/$/, '')
  : undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
