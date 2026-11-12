import { useEffect, useState } from 'react'
import { bulmacalariGetir } from './api/bulmacaApi'
import Bulmaca from './components/Bulmaca'
import type { BulmacaVerisi } from './lib/yerlesim'

export default function App() {
  const [bulmacalar, setBulmacalar] = useState<BulmacaVerisi[] | null>(null)
  const [seciliId, setSeciliId] = useState<number | null>(null)
  const [hata, setHata] = useState(false)

  useEffect(() => {
    bulmacalariGetir()
      .then((liste) => {
        setBulmacalar(liste)
        setSeciliId(liste[0]?.id ?? null)
      })
      .catch(() => setHata(true))
  }, [])

  if (hata) return <p className="durum">Bulmacalar yüklenemedi.</p>
  if (!bulmacalar) return <p className="durum">Yükleniyor…</p>
  if (bulmacalar.length === 0) return <p className="durum">Henüz bulmaca yok.</p>

  return (
    <div className="sayfa">
      {bulmacalar.length > 1 && (
        <nav className="bulmaca-secici" aria-label="Bulmacalar">
          {bulmacalar.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={b.id === seciliId ? 'secili' : ''}
              aria-pressed={b.id === seciliId}
              onClick={() => setSeciliId(b.id)}
            >
              {i + 1}. Bulmaca
            </button>
          ))}
        </nav>
      )}

      {/* Hepsi ekranda tutulur, yalnızca seçili olan görünür: geçişlerde yazılanlar kaybolmaz */}
      {bulmacalar.map((b) => (
        <div key={b.id} hidden={b.id !== seciliId}>
          <Bulmaca veri={b} />
        </div>
      ))}
    </div>
  )
}
