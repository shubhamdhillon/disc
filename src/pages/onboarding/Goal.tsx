import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionScreen from '../../components/onboarding/QuestionScreen'
import { useOnboarding } from '../../context/OnboardingContext'

const OPTIONS = ['Lose fat', 'Maintain', 'Build muscle', 'Body recomposition']

export default function Goal() {
  const navigate       = useNavigate()
  const { update }     = useOnboarding()
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    update({ goal: selected })
    navigate('/onboarding/diet-preference')
  }

  return (
    <QuestionScreen
      step={7}
      section="Goals"
      question="What do you want?"
      options={OPTIONS}
      selected={selected}
      onSelect={setSelected}
      onContinue={handleContinue}
    />
  )
}
