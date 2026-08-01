import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Splash from './pages/Splash'
import Intro from './pages/Intro'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import AddMeal from './pages/AddMeal'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/splash" replace />} />
        <Route path="/splash" element={<Splash />} />
        <Route path="/intro" element={<Intro />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/today" element={<Today />} />
        <Route path="/add-meal" element={<AddMeal />} />
      </Routes>
    </BrowserRouter>
  )
}
