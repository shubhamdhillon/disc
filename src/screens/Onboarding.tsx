import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import BackButton from '../components/BackButton'
import { Chips, OptionRows, OptionTiles, toggle, type Option } from '../components/inputs/Options'
import Wheel, { range } from '../components/inputs/Wheel'
import Stepper from '../components/inputs/Stepper'
import PlanUpload from '../components/PlanUpload'
import BurnCard from '../components/BurnCard'
import { I } from '../components/icons'
import {
  containerMl, loadAnswers, lowestHealthy, saveAnswers, type Answers, type Container, type Cook, type Diet, type Goal,
  type Health, type Path, type Sex, type Steps, type Variety, type Weekday, type Workday, type WorkoutType, type Workouts,
} from '../onboarding/answers'
import { weeksRange } from '../onboarding/plan'

/* Setup questions. One question per screen, answers kept on the phone,
   the progress bar split into four parts: You, Your day, Your food, Your plan. */

type Section = 0 | 1 | 2 | 3
const SECTIONS = ['You', 'Your day', 'Your food', 'Your plan']

interface Step {
  id: string
  section: Section
  title: (a: Answers) => string
  help?: (a: Answers) => string | undefined
  ready: (a: Answers) => boolean
  optional?: boolean
  when?: (a: Answers) => boolean
  body: (a: Answers, set: (p: Partial<Answers>) => void) => ReactNode
}

const timeLabel = (m: number) => {
  const h = Math.floor(m / 60), min = m % 60
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const times = range(0, 23 * 60 + 30, 30)
const buildPath = (a: Answers) => a.path === 'build'
const ownPath = (a: Answers) => a.path === 'own'
const defaultTarget = (a: Answers) =>
  a.goal === 'lose' ? Math.max(lowestHealthy(a.height), a.weight - 5) : a.weight + 3
const canLose = (a: Answers) => a.weight - lowestHealthy(a.height) >= 1
const one = <T extends string>(v: T | undefined) => (v ? [v] : [])
const feetLabel = (inches: number) => `${Math.floor(inches / 12)}′ ${inches % 12}″`

const goals: Option<Goal>[] = [
  { value: 'lose', label: 'Lose fat', hint: 'Your weight goes down', icon: <I name="flame" /> },
  { value: 'recomp', label: 'Lose fat and build muscle', hint: 'Weight stays about the same', icon: <I name="butterfly" /> },
  { value: 'muscle', label: 'Build muscle', hint: 'Your weight goes up a little', icon: <I name="barbell" /> },
  { value: 'steady', label: 'Stay in shape', hint: 'Your weight holds where it is', icon: <I name="heartbeat" /> },
  { value: 'better', label: 'Just eat better', hint: 'No weight target', icon: <I name="carrot" /> },
]
const diets: Option<Diet>[] = [
  { value: 'veg', label: 'Veg', icon: <I name="leaf" /> },
  { value: 'egg', label: 'Veg + eggs', icon: <I name="egg" /> },
  { value: 'nonveg', label: 'Non-veg', icon: <I name="fish" /> },
  { value: 'vegan', label: 'Vegan', icon: <I name="plant" /> },
]
const skipsFor = (d: Diet | undefined): Option<string>[] => [
  { value: 'onion-garlic', label: 'Onion & garlic' },
  { value: 'root-veg', label: 'Root vegetables (Jain)' },
  ...(d === 'vegan' ? [] : [{ value: 'dairy', label: 'Dairy' }]),
  { value: 'gluten', label: 'Gluten' },
  { value: 'nuts', label: 'Nuts' },
  ...(d === 'nonveg' ? [{ value: 'beef', label: 'Beef' }, { value: 'pork', label: 'Pork' }, { value: 'seafood', label: 'Seafood' }] : []),
  { value: 'sugar', label: 'Added sugar' },
  { value: 'fried', label: 'Fried food' },
]
// The amount is the picture here: no library has honest bottle icons
const big = (n: string, unit: string) => <span className="option-tile__big">{n}<small>{unit}</small></span>
const containers: Option<Container>[] = [
  { value: 'glass', label: 'A glass', art: big('250', 'ml') },
  { value: 'small', label: 'A small bottle', art: big('500', 'ml') },
  { value: 'sipper', label: 'A sipper', art: big('750', 'ml') },
  { value: 'big', label: 'A big bottle', art: big('1', 'litre') },
]
const days: Option<Weekday>[] = [
  { value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' }, { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' }, { value: 'fri', label: 'Fri' }, { value: 'sat', label: 'Sat' }, { value: 'sun', label: 'Sun' },
]
const healthFor = (a: Answers): Option<Health>[] => [
  ...(a.sex === 'male' ? [] : [{ value: 'pregnant' as Health, label: 'Pregnant or breastfeeding' }]),
  { value: 'diabetes', label: 'Diabetes or prediabetes' },
  { value: 'bp', label: 'Blood pressure' },
  { value: 'thyroid', label: 'Thyroid' },
  ...(a.sex === 'male' ? [] : [{ value: 'pcos' as Health, label: 'PCOS or PCOD' }]),
  { value: 'kidney', label: 'Kidney condition' },
  { value: 'eating', label: 'A hard time with food, like bingeing or restricting' },
  { value: 'none', label: 'None of these' },
]

const STEPS: Step[] = [
  // ── You ──────────────────────────────────────────────
  {
    id: 'fork', section: 0,
    title: () => 'Already following a diet or fitness plan?',
    ready: a => !!a.path,
    body: (a, set) => (
      <OptionRows<Path>
        options={[
          { value: 'build', label: 'Not yet, make me one', icon: <I name="magic-wand" /> },
          { value: 'own', label: "Yes, I'll add mine", icon: <I name="clipboard-text" /> },
        ]}
        selected={one(a.path)}
        onPick={v => set({ path: v })}
      />
    ),
  },
  {
    id: 'my-source', section: 0, when: ownPath,
    title: () => 'How do you want to add it?',
    help: () => 'A photo or PDF of your plan works.',
    ready: a => a.planSource === 'type' || (a.planSource === 'upload' && !!a.planFound),
    body: (a, set) => <PlanUpload a={a} set={set} />,
  },
  {
    id: 'goal', section: 0,
    title: () => 'What are you working towards?',
    ready: a => !!a.goal,
    body: (a, set) => <OptionRows options={goals} selected={one(a.goal)} onPick={v => set({ goal: v, target: undefined })} />,
  },
  {
    id: 'sex', section: 0, when: buildPath,
    title: () => "What's your sex?",
    help: () => 'Only used for the calorie maths.',
    ready: a => !!a.sex,
    body: (a, set) => (
      <OptionRows<Sex>
        options={[
          { value: 'male', label: 'Male', icon: <I name="gender-male" /> },
          { value: 'female', label: 'Female', icon: <I name="gender-female" /> },
          { value: 'unsaid', label: "I'd rather not say", icon: <I name="user-circle" /> },
        ]}
        selected={one(a.sex)}
        onPick={v => set({ sex: v, weight: a.weight === 70 || a.weight === 60 ? (v === 'female' ? 60 : 70) : a.weight, health: a.health.filter(h => v !== 'male' || (h !== 'pregnant' && h !== 'pcos')) })}
      />
    ),
  },
  {
    id: 'age', section: 0, when: buildPath,
    title: () => 'How old are you?',
    ready: () => true,
    body: (a, set) => (
      <div className="wheels">
        <Wheel values={range(18, 80)} value={a.age} format={v => `${v} years`} onChange={v => set({ age: v })} />
      </div>
    ),
  },
  {
    id: 'body', section: 0, when: buildPath,
    title: () => 'Your height and weight',
    help: () => 'Roughly is fine.',
    ready: () => true,
    body: (a, set) => (
      <>
        <div className="segmented" role="group" aria-label="Height unit">
          {(['cm', 'ft'] as const).map(u => (
            <button key={u} type="button" aria-pressed={a.heightUnit === u} onClick={() => set({ heightUnit: u })}>
              {u === 'cm' ? 'cm' : 'feet & inches'}
            </button>
          ))}
        </div>
        <div className="wheels">
          {a.heightUnit === 'ft'
            ? <Wheel key="ft" label="Height" values={range(55, 83)} value={Math.round(a.height / 2.54)} format={feetLabel} onChange={v => set({ height: Math.round(v * 2.54) })} />
            : <Wheel key="cm" label="Height" values={range(140, 210)} value={a.height} format={v => `${v} cm`} onChange={v => set({ height: v })} />}
          <Wheel label="Weight" values={range(35, 180)} value={a.weight} format={v => `${v} kg`} onChange={v => set({ weight: v })} />
        </div>
        <BurnCard a={a} step="body" />
      </>
    ),
  },
  {
    id: 'target', section: 0, when: a => buildPath(a) && (a.goal === 'lose' || a.goal === 'muscle'),
    title: a => (a.goal === 'lose' ? (canLose(a) ? 'Where would you like to get to?' : 'Quick thing before we go on') : 'What weight are you aiming for?'),
    ready: () => true,
    body: (a, set) => {
      if (a.goal === 'lose' && !canLose(a)) {
        return (
          <div className="answer-note answer-note--warn">
            <p>You're already light for your height, so we won't help you lose more.</p>
            <p style={{ marginTop: 8 }}>To look leaner, <b>losing fat while building muscle</b> works better.</p>
            <button type="button" className="chip-option" style={{ marginTop: 12 }} onClick={() => set({ goal: 'recomp', target: undefined })}>
              Switch to that goal
            </button>
          </div>
        )
      }
      const values = a.goal === 'lose' ? range(lowestHealthy(a.height), a.weight - 1) : range(a.weight + 1, a.weight + 25)
      const value = Math.min(Math.max(a.target ?? defaultTarget(a), values[0]), values[values.length - 1])
      const w = weeksRange({ ...a, target: value })
      return (
        <>
          <div className="wheels">
            <Wheel key={`${a.goal}-${a.weight}`} values={values} value={value} format={v => `${v} kg`} onChange={v => set({ target: v })} />
          </div>
          {w && (
            <p className="answer-note">
              At a pace you can keep, that's about <b>{w[0]} to {w[1]} weeks</b>.
            </p>
          )}
          {a.goal === 'lose' && <p className="field-note">We stop at a healthy weight for your height, so the list ends at {values[0]} kg.</p>}
        </>
      )
    },
  },
  {
    id: 'my-weight', section: 0, when: ownPath,
    title: () => 'What do you weigh right now?',
    help: () => 'Roughly is fine. It gives your weekly check-ins a starting point.',
    ready: () => true,
    body: (a, set) => (
      <div className="wheels">
        <Wheel values={range(35, 180)} value={a.weight} format={v => `${v} kg`} onChange={v => set({ weight: v })} />
      </div>
    ),
  },

  // ── Your day ─────────────────────────────────────────
  {
    id: 'workday', section: 1, when: buildPath,
    title: () => 'What does a usual workday look like?',
    ready: a => !!a.workday,
    body: (a, set) => (
      <>
      <OptionRows<Workday>
        options={[
          { value: 'sitting', label: 'Mostly sitting', icon: <I name="office-chair" /> },
          { value: 'mix', label: 'A mix', icon: <I name="person-simple-walk" /> },
          { value: 'feet', label: 'On my feet', icon: <I name="footprints" /> },
        ]}
        selected={one(a.workday)}
        onPick={v => set({ workday: v })}
      />
      <BurnCard a={a} step="workday" />
      </>
    ),
  },
  {
    id: 'times', section: 1, when: buildPath,
    title: () => 'When does your day start and end?',
    help: () => 'Night shifts work too.',
    ready: () => true,
    body: (a, set) => (
      <div className="wheels">
        <Wheel label="Wake up" values={times} value={a.wake} format={timeLabel} onChange={v => set({ wake: v })} />
        <Wheel label="Sleep" values={times} value={a.sleep} format={timeLabel} onChange={v => set({ sleep: v })} />
      </div>
    ),
  },
  {
    id: 'steps', section: 1, when: buildPath,
    title: () => 'How much do you walk on a usual day?',
    help: () => "Not sure? Your phone's Health app has it.",
    ready: a => !!a.steps,
    body: (a, set) => (
      <>
        <OptionRows<Steps>
          options={[
            { value: 'low', label: 'Not much', hint: 'Under 3,000 steps', icon: <I name="car-simple" /> },
            { value: 'some', label: 'A bit', hint: '3,000 to 7,000 steps', icon: <I name="person-simple-walk" /> },
            { value: 'good', label: 'Quite a lot', hint: '7,000 to 10,000 steps', icon: <I name="train-simple" /> },
            { value: 'lots', label: 'Loads', hint: 'Over 10,000 steps', icon: <I name="sneaker-move" /> },
          ]}
          selected={one(a.steps)}
          onPick={v => set({ steps: v })}
        />
        <BurnCard a={a} step="steps" />
      </>
    ),
  },
  {
    id: 'workouts', section: 1, when: buildPath,
    title: () => 'How often do you work out?',
    ready: a => !!a.workouts && (a.workouts === 'none' || a.workoutTypes.length > 0),
    body: (a, set) => (
      <>
        <OptionRows<Workouts>
          options={[
            { value: 'none', label: 'Not right now', icon: <I name="battery-empty" /> },
            { value: 'some', label: 'Once or twice a week', icon: <I name="battery-low" /> },
            { value: 'regular', label: 'Three or four times a week', icon: <I name="battery-medium" /> },
            { value: 'lots', label: 'Five or more times a week', icon: <I name="battery-full" /> },
          ]}
          selected={one(a.workouts)}
          onPick={v => set({ workouts: v, workoutTypes: v === 'none' ? [] : a.workoutTypes })}
        />
        <BurnCard a={a} step="workouts" />
        {a.workouts && a.workouts !== 'none' && (
          <>
            <p className="sub-label">What kind? Pick any</p>
            <Chips<WorkoutType>
              options={[
                { value: 'weights', label: 'Gym, weights', icon: <I name="barbell" /> },
                { value: 'home', label: 'Home workouts', icon: <I name="house-line" /> },
                { value: 'cardio', label: 'Running, cycling', icon: <I name="person-simple-run" /> },
                { value: 'yoga', label: 'Yoga', icon: <I name="person-simple-tai-chi" /> },
                { value: 'sport', label: 'A sport', icon: <I name="soccer-ball" /> },
              ]}
              selected={a.workoutTypes}
              onPick={v => set({ workoutTypes: toggle(a.workoutTypes, v) })}
            />
          </>
        )}
      </>
    ),
  },
  {
    id: 'my-workouts', section: 1, when: ownPath,
    title: () => 'How many days a week do you work out?',
    ready: a => a.myWorkoutDays !== undefined,
    body: (a, set) => (
      <Chips<string>
        options={['0', '1', '2', '3', '4', '5', '6', '7'].map(n => ({ value: n, label: n === '0' ? 'Not yet' : `${n} day${n === '1' ? '' : 's'}` }))}
        selected={a.myWorkoutDays === undefined ? [] : [String(a.myWorkoutDays)]}
        onPick={v => set({ myWorkoutDays: Number(v) })}
      />
    ),
  },

  // ── Your food ────────────────────────────────────────
  {
    id: 'cooks', section: 2, when: buildPath,
    title: () => 'Where does most of your food come from?',
    ready: a => a.cooks.length > 0,
    body: (a, set) => (
      <OptionRows<Cook>
        options={[
          { value: 'me', label: 'I cook', icon: <I name="cooking-pot" /> },
          { value: 'family', label: 'Family or a cook makes it', icon: <I name="users-three" /> },
          { value: 'tiffin', label: 'Tiffin, mess or office canteen', icon: <I name="bowl-food" /> },
          { value: 'order', label: 'I order in', icon: <I name="moped" /> },
          { value: 'out', label: 'I eat out', icon: <I name="fork-knife" /> },
        ]}
        multi
        selected={a.cooks}
        onPick={v => set({ cooks: toggle(a.cooks, v) })}
      />
    ),
  },
  {
    id: 'variety', section: 2, when: buildPath,
    title: () => 'Same food most days?',
    ready: a => !!a.variety,
    body: (a, set) => (
      <OptionRows<Variety>
        options={[
          { value: 'same', label: 'Pretty much the same every day', icon: <I name="repeat" /> },
          { value: 'rotate', label: 'A few meals on rotation', icon: <I name="arrows-clockwise" /> },
          { value: 'varies', label: 'It changes a lot', icon: <I name="shuffle" /> },
        ]}
        selected={one(a.variety)}
        onPick={v => set({ variety: v })}
      />
    ),
  },
  {
    id: 'diet', section: 2, when: buildPath,
    title: () => 'How do you eat?',
    ready: a => !!a.diet,
    body: (a, set) => (
      <>
        <div className="option-grid--short">
          <OptionTiles options={diets} selected={one(a.diet)}
            onPick={v => set({ diet: v, skips: a.skips.filter(x => skipsFor(v).some(o => o.value === x)) })} />
        </div>
        <p className="sub-label">Anything you avoid? (optional)</p>
        <Chips options={skipsFor(a.diet)} selected={a.skips} onPick={v => set({ skips: toggle(a.skips, v) })} />
      </>
    ),
  },
  {
    id: 'my-food', section: 2, when: ownPath,
    title: a => (a.planSource === 'upload' ? 'Do these look right?' : 'Your daily food numbers'),
    help: a => (a.planSource === 'upload' ? 'From your plan. Tap a number to change it.' : 'Tap the number to type it, or use − and +.'),
    ready: () => true,
    body: (a, set) => (
      <>
        <p className="sub-label" style={{ marginTop: 0 }}>Calories</p>
        <Stepper value={a.myCalories} onChange={v => set({ myCalories: v })} step={50} min={800} max={6000} unit="kcal" />
        <p className="sub-label">Protein</p>
        <Stepper value={a.myProtein} onChange={v => set({ myProtein: v })} step={5} min={20} max={400} unit="g" />
        {a.myCalories < 1200 && (
          <p className="answer-note answer-note--warn">
            That's lower than most adults should go without a doctor's say. <b>1,200 or more</b> is a safer floor. Your call though.
          </p>
        )}
        {a.myProtein > a.weight * 2.2 && (
          <p className="answer-note answer-note--warn">That's a lot of protein for your weight. Most people do well under <b>2 g per kg</b>.</p>
        )}
      </>
    ),
  },
  {
    id: 'water', section: 2,
    title: () => 'What do you usually drink water from?',
    ready: a => !!a.container,
    body: (a, set) => (
      <OptionTiles options={containers} selected={one(a.container)}
        onPick={v => set({ container: v, myWater: Math.max(1, Math.round((a.myWaterMl ?? 2500) / containerMl[v])) })} />
    ),
  },
  {
    id: 'my-water', section: 2, when: ownPath,
    title: a => `How many ${a.container === 'glass' ? 'glasses' : a.container === 'sipper' ? 'sippers' : 'bottles'} a day?`,
    ready: () => true,
    body: (a, set) => <Stepper value={a.myWater} onChange={v => set({ myWater: v })} step={1} min={1} max={20} unit="a day" />,
  },

  // ── Your plan ────────────────────────────────────────
  {
    id: 'weigh-in', section: 3, when: ownPath,
    title: () => 'Which day should we weigh in?',
    help: () => 'Once a week, before breakfast.',
    ready: a => !!a.weighIn,
    body: (a, set) => <Chips options={days} selected={one(a.weighIn)} onPick={v => set({ weighIn: v })} />,
  },
  {
    id: 'health', section: 3,
    title: () => 'Anything we should be careful about?',
    help: () => 'This keeps your plan safe.',
    ready: a => a.health.length > 0,
    body: (a, set) => (
      <>
        <OptionRows<Health>
          options={healthFor(a)}
          multi
          selected={a.health}
          onPick={v => set({ health: toggle(a.health, v, ['none']) })}
        />
        {a.health.includes('eating') && (
          <p className="answer-note">Thanks for telling us. No calorie cut, just regular, good meals.</p>
        )}
        {a.health.some(h => h !== 'none' && h !== 'eating') && (
          <p className="answer-note">Thanks for telling us. We'll keep things gentle. Check anything medical with your doctor.</p>
        )}
      </>
    ),
  },
  {
    id: 'notes', section: 3, optional: true, when: buildPath,
    title: () => 'Anything else we should know?',
    help: () => 'Injuries, medicines or foods you love.',
    ready: () => true,
    body: (a, set) => (
      <textarea
        className="text-box"
        placeholder="e.g. Bad knee, so no running"
        value={a.notes}
        onChange={e => set({ notes: e.target.value })}
        maxLength={500}
      />
    ),
  },
]

export default function Onboarding({ onExit, onDone }: { onExit: () => void; onDone: (a: Answers) => void }) {
  const saved = useMemo(loadAnswers, [])
  const [answers, setAnswers] = useState<Answers>(saved.answers)
  const steps = useMemo(() => STEPS.filter(s => !s.when || s.when(answers)), [answers])
  const [index, setIndex] = useState(Math.min(saved.step, steps.length - 1))
  const step = steps[Math.min(index, steps.length - 1)]

  useEffect(() => { saveAnswers(answers, index) }, [answers, index])

  const set = (p: Partial<Answers>) => setAnswers(a => ({ ...a, ...p }))
  const next = () => {
    let a = answers
    if (step.id === 'target' && a.target === undefined) { a = { ...a, target: defaultTarget(a) }; setAnswers(a) }
    if (index + 1 < steps.length) setIndex(index + 1)
    else onDone(a)
  }
  const back = () => (index === 0 ? onExit() : setIndex(index - 1))

  // Progress: each section's bar fills with the steps done in it
  const fill = (sec: Section) => {
    const inSec = steps.filter(s => s.section === sec)
    const done = inSec.filter(s => steps.indexOf(s) < index).length
    return inSec.length ? (done / inSec.length) * 100 : 0
  }

  const help = step.help?.(answers)
  return (
    <main className="question" key={step.id}>
      <div className="question__top">
        <BackButton onClick={back} />
        <div className="progress" aria-label={`Question ${index + 1} of ${steps.length}`}>
          {([0, 1, 2, 3] as Section[]).map(s => (
            <div key={s} className="progress__segment">
              <div className="progress__fill" style={{ '--value': `${fill(s)}%` } as CSSProperties} />
            </div>
          ))}
        </div>
      </div>
      <p className="question__section">{SECTIONS[step.section]}</p>
      <h1 className={`question__title${help ? '' : ' question__title--alone'}`}>{step.title(answers)}</h1>
      {help && <p className="question__help">{help}</p>}
      <div className="question__body">{step.body(answers, set)}</div>
      <div className="question__footer">
        <button className="button" disabled={!step.ready(answers)} onClick={next}>Continue</button>
        {step.optional && <button className="text-button" onClick={next}>Skip for now</button>}
      </div>
    </main>
  )
}

