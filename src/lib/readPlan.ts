/* Sends a plan photo or PDF to /api/read-plan and returns the numbers found. */

export interface ReadPlanResult {
  notAPlan: boolean
  calories?: number
  protein?: number
  estimated: boolean
  workoutDays?: number
  waterMl?: number
  summary?: string
}

const MAX_PDF = 4 * 1024 * 1024

/** Shrinks a photo to at most 1600px on its long side, so it uploads fast on mobile data. */
async function shrinkImage(file: File): Promise<{ data: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL('image/jpeg', 0.85)
  return { data: url.split(',')[1], mimeType: 'image/jpeg' }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export class ReadPlanError extends Error {}

export async function readPlan(file: File): Promise<ReadPlanResult> {
  let payload: { data: string; mimeType: string }
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF) throw new ReadPlanError("That PDF is a bit big. Try a photo of the page with your numbers instead.")
    payload = { data: await toBase64(file), mimeType: 'application/pdf' }
  } else if (file.type.startsWith('image/')) {
    try { payload = await shrinkImage(file) }
    catch { throw new ReadPlanError("Couldn't open that photo. Try a screenshot or a different picture.") }
  } else {
    throw new ReadPlanError('Disc can read photos and PDFs. Try one of those?')
  }

  let res: Response
  try {
    res = await fetch('/api/read-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  } catch {
    throw new ReadPlanError("Couldn't reach us. Check your internet and try again.")
  }
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: '' }))
    throw new ReadPlanError(
      error === 'busy' ? "We're getting a lot of plans right now. Try again in a minute, or type the numbers in."
      : error === 'too-big' ? 'That file is a bit big. Try a photo of the page with your numbers instead.'
      : error === 'not-set-up' ? "Reading plans isn't switched on in this version yet. Type the numbers in for now."
      : "We couldn't read that one. Try a clearer photo, or type the numbers in.",
    )
  }
  return res.json()
}
