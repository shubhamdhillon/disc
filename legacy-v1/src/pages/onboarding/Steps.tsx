import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionScreen from '../../components/onboarding/QuestionScreen'
import { useOnboarding } from '../../context/OnboardingContext'

const OPTIONS = ['Under 3k', '3k-6k', '6k-10k', '10k+']

export default function Steps() {
  const navigate          = useNavigate()
  const { update }        = useOnboarding()
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    update({ stepsPerDay: selected })
    navigate('/onboarding/workout-frequency')
  }

  return (
    <QuestionScreen
      step={3}
      section="Activity level"
      question="Roughly how many steps a day?"
      options={OPTIONS}
      selected={selected}
      onSelect={setSelected}
      onContinue={handleContinue}
      hint="Check your phone's health app, we'll wait"
    />
  )
}
