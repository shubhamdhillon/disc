import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { OnboardingProvider } from './context/OnboardingContext'
import { AuthProvider } from './context/AuthContext'
import Splash          from './pages/Splash'
import Intro           from './pages/Intro'
import BodyBasics      from './pages/onboarding/BodyBasics'
import WorkDay           from './pages/onboarding/WorkDay'
import Steps             from './pages/onboarding/Steps'
import WorkoutFrequency  from './pages/onboarding/WorkoutFrequency'
import WorkoutType       from './pages/onboarding/WorkoutType'
import WorkoutLength     from './pages/onboarding/WorkoutLength'
import Goal              from './pages/onboarding/Goal'
import DietPreference    from './pages/onboarding/DietPreference'
import FoodPrep          from './pages/onboarding/FoodPrep'
import Results           from './pages/onboarding/Results'
import CreateAccount   from './pages/CreateAccount'
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
        {/* /onboarding redirects to first question — old "Let's get to know you" screen removed */}
        <Route path="/onboarding"             element={<Navigate to="/onboarding/body-basics" replace />} />
        <Route path="/onboarding/body-basics" element={<BodyBasics />} />
        <Route path="/onboarding/work-day"   element={<WorkDay />} />
        <Route path="/onboarding/steps"             element={<Steps />} />
        <Route path="/onboarding/workout-frequency" element={<WorkoutFrequency />} />
        <Route path="/onboarding/workout-type"      element={<WorkoutType />} />
        <Route path="/onboarding/workout-length"    element={<WorkoutLength />} />
        <Route path="/onboarding/goal"              element={<Goal />} />
        <Route path="/onboarding/diet-preference"   element={<DietPreference />} />
        <Route path="/onboarding/food-prep"         element={<FoodPrep />} />
        <Route path="/onboarding/results"           element={<Results />} />
        <Route path="/create-account"         element={<CreateAccount />} />
        <Route path="/today"                  element={<Today />} />
        <Route path="/add-meal"               element={<AddMeal />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    // AuthProvider makes login state available app-wide (no route guards yet).
    // OnboardingProvider wraps the rest so any screen can read/write
    // the collected onboarding data without prop-drilling.
    <AuthProvider>
      <OnboardingProvider>
        <BrowserRouter>
          <AnimatedRoutes />
          <DevReset />
        </BrowserRouter>
      </OnboardingProvider>
    </AuthProvider>
  )
}
