import { useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'

/* On a laptop: the app runs right here in a phone-sized frame, so anyone
   (a recruiter, say) can try it without a phone. Beside it, a QR code to
   open it on a phone, where it's meant to live. */
export default function DesktopFrame({ children }: { children: ReactNode }) {
  const [qr, setQr] = useState('')
  const link = `${location.origin}/`
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 280, color: { dark: '#16171C', light: '#F4F1EA' } })
      .then(setQr).catch(() => setQr(''))
  }, [link])

  return (
    <div className="desk">
      <div className="desk__phone">{children}</div>
      <aside className="desk__side">
        <p className="desk__mark" aria-hidden="true">D</p>
        <h2 className="desk__title">Disc is made for your phone</h2>
        <p className="desk__text">You can try it right here. To use it day to day, scan this and add it to your home screen.</p>
        {qr && <img className="desk__qr" src={qr} alt={`QR code for ${link}`} width={140} height={140} />}
        <p className="desk__link">{link.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
      </aside>
    </div>
  )
}
