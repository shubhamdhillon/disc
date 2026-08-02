import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionScreen from '../../components/onboarding/QuestionScreen'
import { useOnboarding } from '../../context/OnboardingContext'

const OPTIONS = ['Vegetarian', 'Non-vegetarian', 'Eggetarian', 'Vegan']

export default function DietPreference() {
  const navigate       = useNavigate()
  const { update }     = useOnboarding()
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    update({ dietPreference: selected })
    navigate('/onboarding/food-prep')
  }

  return (
    <QuestionScreen
      step={8}
      section="Food preference"
      question="What do you prefer?"
      options={OPTIONS}
      selected={selected}
      onSelect={setSelected}
      onContinue={handleContinue}
    />
  )
}
