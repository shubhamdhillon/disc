import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionScreen from '../../components/onboarding/QuestionScreen'
import { useOnboarding } from '../../context/OnboardingContext'

const OPTIONS = [
  'Mostly sitting',
  'Mix of sitting and moving',
  'On feet most of the day',
  'Physical work',
]

export default function WorkDay() {
  const navigate          = useNavigate()
  const { update }        = useOnboarding()
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    update({ workDay: selected })
    navigate('/onboarding/steps')
  }

  return (
    <QuestionScreen
      step={2}
      section="Activity level"
      question="Your typical day?"
      options={OPTIONS}
      selected={selected}
      onSelect={setSelected}
      onContinue={handleContinue}
    />
  )
}
