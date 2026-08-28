import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import { applyInitialTheme } from '@/hooks/useTheme'

applyInitialTheme()

// 子路径部署（如 Cloudflare 上的 /movie/）时给路由加 basename；base 为相对路径 './' 时不设
const basename = import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
