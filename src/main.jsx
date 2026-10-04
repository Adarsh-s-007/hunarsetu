import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from './AppContext'
import App from './App'
import './styles/base.css'
import './styles/home.css'
import './styles/counsel.css'
import './styles/pages.css'
import './styles/admin.css'
import './styles/layout.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
