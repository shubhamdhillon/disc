import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionScreen from '../../components/onboarding/QuestionScreen'
import { useOnboarding } from '../../context/OnboardingContext'

const OPTIONS = ['Under 30 min', '30-60 min', '60-90 min', '90 min+']

export default function WorkoutLength() {
  const navigate       = useNavigate()
  const { update }     = useOnboarding()
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    update({ workoutLength: selected })
    navigate('/onboarding/goal')
  }

  return (
    <QuestionScreen
      step={6}
      section="Training"
      question="Typical workout session length?"
      options={OPTIONS}
      selected={selected}
      onSelect={setSelected}
      onContinue={handleContinue}
    />
  )
}
