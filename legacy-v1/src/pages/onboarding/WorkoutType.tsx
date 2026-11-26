import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionScreen from '../../components/onboarding/QuestionScreen'
import { useOnboarding } from '../../context/OnboardingContext'

const OPTIONS = ['Weights', 'Cardio', 'Both', 'I play a sport']

export default function WorkoutType() {
  const navigate       = useNavigate()
  const { update }     = useOnboarding()
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    update({ workoutType: selected })
    navigate('/onboarding/workout-length')
  }

  return (
    <QuestionScreen
      step={5}
      section="Training"
      question="What kind of workout?"
      options={OPTIONS}
      selected={selected}
      onSelect={setSelected}
      onContinue={handleContinue}
    />
  )
}
