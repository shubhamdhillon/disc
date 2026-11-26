import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { OnboardingProvider } from './context/OnboardingContext'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import RedirectIfAuthed from './components/RedirectIfAuthed'
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
import Settings        from './pages/Settings'
import History         from './pages/History'
import Suggest         from './pages/Suggest'
import DevReset        from './components/DevReset'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Pre-app: skip if already signed in */}
        <Route element={<RedirectIfAuthed />}>
          <Route path="/"                       element={<Navigate to="/splash" replace />} />
          <Route path="/splash"                 element={<Splash />} />
          <Route path="/intro"                  element={<Intro />} />
          <Route path="/onboarding"             element={<Navigate to="/onboarding/body-basics" replace />} />
          <Route path="/onboarding/body-basics" element={<BodyBasics />} />
          <Route path="/onboarding/work-day"    element={<WorkDay />} />
          <Route path="/onboarding/steps"             element={<Steps />} />
          <Route path="/onboarding/workout-frequency" element={<WorkoutFrequency />} />
          <Route path="/onboarding/workout-type"      element={<WorkoutType />} />
          <Route path="/onboarding/workout-length"    element={<WorkoutLength />} />
          <Route path="/onboarding/goal"              element={<Goal />} />
          <Route path="/onboarding/diet-preference"   element={<DietPreference />} />
          <Route path="/onboarding/food-prep"         element={<FoodPrep />} />
          <Route path="/onboarding/results"           element={<Results />} />
          <Route path="/create-account"         element={<CreateAccount />} />
        </Route>

        {/* App: require a session */}
        <Route element={<RequireAuth />}>
          <Route path="/today"    element={<Today />} />
          <Route path="/add-meal" element={<AddMeal />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/history"  element={<History />} />
          <Route path="/suggest"  element={<Suggest />} />
        </Route>
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    // AuthProvider makes login state + guards available app-wide.
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
