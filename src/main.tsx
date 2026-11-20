import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StudyApp } from './study/StudyApp.tsx'

const studyMode = new URLSearchParams(window.location.search).get('study') === '1'
if (studyMode) document.documentElement.classList.add('study')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {studyMode ? <StudyApp /> : <App />}
  </StrictMode>,
)
