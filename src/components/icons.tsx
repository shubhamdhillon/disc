/* Answer icons: Phosphor (MIT licence), duotone weight, coloured by CSS.
   Only the duotone drawings we use are bundled, so the app stays light.
   To add one: import its -duotone.svg?raw below and add it to the map. */
import arrowsClockwise from '@phosphor-icons/core/assets/duotone/arrows-clockwise-duotone.svg?raw'
import barbell from '@phosphor-icons/core/assets/duotone/barbell-duotone.svg?raw'
import batteryEmpty from '@phosphor-icons/core/assets/duotone/battery-empty-duotone.svg?raw'
import batteryFull from '@phosphor-icons/core/assets/duotone/battery-full-duotone.svg?raw'
import batteryLow from '@phosphor-icons/core/assets/duotone/battery-low-duotone.svg?raw'
import batteryMedium from '@phosphor-icons/core/assets/duotone/battery-medium-duotone.svg?raw'
import bowlFood from '@phosphor-icons/core/assets/duotone/bowl-food-duotone.svg?raw'
import butterfly from '@phosphor-icons/core/assets/duotone/butterfly-duotone.svg?raw'
import calendarCheck from '@phosphor-icons/core/assets/duotone/calendar-check-duotone.svg?raw'
import carSimple from '@phosphor-icons/core/assets/duotone/car-simple-duotone.svg?raw'
import carrot from '@phosphor-icons/core/assets/duotone/carrot-duotone.svg?raw'
import clipboardText from '@phosphor-icons/core/assets/duotone/clipboard-text-duotone.svg?raw'
import cookingPot from '@phosphor-icons/core/assets/duotone/cooking-pot-duotone.svg?raw'
import drop from '@phosphor-icons/core/assets/duotone/drop-duotone.svg?raw'
import egg from '@phosphor-icons/core/assets/duotone/egg-duotone.svg?raw'
import fish from '@phosphor-icons/core/assets/duotone/fish-duotone.svg?raw'
import flame from '@phosphor-icons/core/assets/duotone/flame-duotone.svg?raw'
import footprints from '@phosphor-icons/core/assets/duotone/footprints-duotone.svg?raw'
import forkKnife from '@phosphor-icons/core/assets/duotone/fork-knife-duotone.svg?raw'
import genderFemale from '@phosphor-icons/core/assets/duotone/gender-female-duotone.svg?raw'
import genderMale from '@phosphor-icons/core/assets/duotone/gender-male-duotone.svg?raw'
import heartbeat from '@phosphor-icons/core/assets/duotone/heartbeat-duotone.svg?raw'
import houseLine from '@phosphor-icons/core/assets/duotone/house-line-duotone.svg?raw'
import leaf from '@phosphor-icons/core/assets/duotone/leaf-duotone.svg?raw'
import magicWand from '@phosphor-icons/core/assets/duotone/magic-wand-duotone.svg?raw'
import moped from '@phosphor-icons/core/assets/duotone/moped-duotone.svg?raw'
import officeChair from '@phosphor-icons/core/assets/duotone/office-chair-duotone.svg?raw'
import personSimpleRun from '@phosphor-icons/core/assets/duotone/person-simple-run-duotone.svg?raw'
import personSimpleTaiChi from '@phosphor-icons/core/assets/duotone/person-simple-tai-chi-duotone.svg?raw'
import personSimpleWalk from '@phosphor-icons/core/assets/duotone/person-simple-walk-duotone.svg?raw'
import plant from '@phosphor-icons/core/assets/duotone/plant-duotone.svg?raw'
import repeat from '@phosphor-icons/core/assets/duotone/repeat-duotone.svg?raw'
import shuffle from '@phosphor-icons/core/assets/duotone/shuffle-duotone.svg?raw'
import sneakerMove from '@phosphor-icons/core/assets/duotone/sneaker-move-duotone.svg?raw'
import soccerBall from '@phosphor-icons/core/assets/duotone/soccer-ball-duotone.svg?raw'
import trainSimple from '@phosphor-icons/core/assets/duotone/train-simple-duotone.svg?raw'
import userCircle from '@phosphor-icons/core/assets/duotone/user-circle-duotone.svg?raw'
import usersThree from '@phosphor-icons/core/assets/duotone/users-three-duotone.svg?raw'

const svgs = {
  'arrows-clockwise': arrowsClockwise,
  'barbell': barbell,
  'battery-empty': batteryEmpty,
  'battery-full': batteryFull,
  'battery-low': batteryLow,
  'battery-medium': batteryMedium,
  'bowl-food': bowlFood,
  'butterfly': butterfly,
  'calendar-check': calendarCheck,
  'car-simple': carSimple,
  'carrot': carrot,
  'clipboard-text': clipboardText,
  'cooking-pot': cookingPot,
  'drop': drop,
  'egg': egg,
  'fish': fish,
  'flame': flame,
  'footprints': footprints,
  'fork-knife': forkKnife,
  'gender-female': genderFemale,
  'gender-male': genderMale,
  'heartbeat': heartbeat,
  'house-line': houseLine,
  'leaf': leaf,
  'magic-wand': magicWand,
  'moped': moped,
  'office-chair': officeChair,
  'person-simple-run': personSimpleRun,
  'person-simple-tai-chi': personSimpleTaiChi,
  'person-simple-walk': personSimpleWalk,
  'plant': plant,
  'repeat': repeat,
  'shuffle': shuffle,
  'sneaker-move': sneakerMove,
  'soccer-ball': soccerBall,
  'train-simple': trainSimple,
  'user-circle': userCircle,
  'users-three': usersThree,
}
export type IconName = keyof typeof svgs

const inner = (raw: string) => raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

export function I({ name }: { name: IconName }) {
  return <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: inner(svgs[name]) }} />
}

/** The tick used on chosen answers. */
export function Tick() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.6 7.4l2.8 2.8 6-6.4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
