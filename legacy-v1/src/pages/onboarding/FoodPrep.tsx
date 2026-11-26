import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionScreen from '../../components/onboarding/QuestionScreen'
import { useOnboarding } from '../../context/OnboardingContext'
import { calculateTargets } from '../../lib/calculateTargets'

const OPTIONS = [
  'Home/Family cooks',
  'I cook for myself',
  'Mess or PG food',
  'Mostly outside/Delivery',
]

export default function FoodPrep() {
  const navigate       = useNavigate()
  const { data, update } = useOnboarding()
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    // Build the complete dataset synchronously — React state updates are async
    // so we can't rely on the context having foodPrep yet when we calculate.
    const finalData = { ...data, foodPrep: selected }
    const targets   = calculateTargets(finalData)

    update({ foodPrep: selected, targets })
    localStorage.setItem('disc_targets', JSON.stringify(targets))

    navigate('/onboarding/results')
  }

  return (
    <QuestionScreen
      step={9}
      section="Food preference"
      question="How is your food prepared?"
      options={OPTIONS}
      selected={selected}
      onSelect={setSelected}
      onContinue={handleContinue}
    />
  )
}
