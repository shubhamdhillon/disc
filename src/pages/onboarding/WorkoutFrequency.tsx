import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionScreen from '../../components/onboarding/QuestionScreen'
import { useOnboarding } from '../../context/OnboardingContext'

const OPTIONS = ['No', '1-2 days/week', '3-4 days/week', '5-6 days/week']

export default function WorkoutFrequency() {
  const navigate       = useNavigate()
  const { update }     = useOnboarding()
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    if (selected === 'No') {
      // User doesn't train — clear downstream fields and jump to step 7.
      // Screens 5 and 6 are skipped; the progress bar will jump from 4/9 to
      // 7/9 on the next screen, which naturally signals the user moved ahead.
      update({ workoutFrequency: selected, workoutType: null, workoutLength: null })
      navigate('/onboarding/goal')
    } else {
      update({ workoutFrequency: selected })
      navigate('/onboarding/workout-type')
    }
  }

  return (
    <QuestionScreen
      step={4}
      section="Training"
      question="Do you workout?"
      options={OPTIONS}
      selected={selected}
      onSelect={setSelected}
      onContinue={handleContinue}
    />
  )
}
