import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { OnboardingProvider } from './context/OnboardingContext'
import Splash          from './pages/Splash'
import Intro           from './pages/Intro'
import OnboardingIntro from './pages/OnboardingIntro'
import BodyBasics      from './pages/onboarding/BodyBasics'
import Today           from './pages/Today'
import AddMeal         from './pages/AddMeal'
import DevReset        from './components/DevReset'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/"                       element={<Navigate to="/splash" replace />} />
        <Route path="/splash"                 element={<Splash />} />
        <Route path="/intro"                  element={<Intro />} />
        {/* /onboarding is the intro card ("Let's get to know you!") */}
        <Route path="/onboarding"             element={<OnboardingIntro />} />
        {/* /onboarding/body-basics is question screen 1 of 9 */}
        <Route path="/onboarding/body-basics" element={<BodyBasics />} />
        <Route path="/today"                  element={<Today />} />
        <Route path="/add-meal"               element={<AddMeal />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    // OnboardingProvider wraps the whole app so any screen can read/write
    // the collected onboarding data without prop-drilling.
    <OnboardingProvider>
      <BrowserRouter>
        <AnimatedRoutes />
        <DevReset />
      </BrowserRouter>
    </OnboardingProvider>
  )
}
