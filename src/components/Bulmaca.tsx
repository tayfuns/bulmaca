import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import {
  anahtar,
  harfNormalize,
  yerlesimOlustur,
  type BulmacaVerisi,
  type YerlesmisKelime,
  type Yon,
} from '../lib/yerlesim'
import './Bulmaca.css'

interface Hucre {
  satir: number
  sutun: number
  harf: string
  /** Bu hücreden geçen kelimelerin yerlesim.kelimeler içindeki indeksleri */
  kelimeler: Partial<Record<Yon, number>>
  /** Bu hücrede başlayan kelimelerin numaraları */
  etiketler: { no: number; yon: Yon }[]
}

type Sonuc = 'dogru' | 'yanlis'

const OZEL_HARFLER = ['Ä', 'Ö', 'Ü', 'ẞ']
const digerYon = (yon: Yon): Yon => (yon === 'yatay' ? 'dikey' : 'yatay')

function kelimeHucreleri(k: YerlesmisKelime): string[] {
  return k.harfler.map((_, i) =>
    k.yon === 'yatay' ? anahtar(k.satir, k.sutun + i) : anahtar(k.satir + i, k.sutun),
  )
}

export default function Bulmaca({ veri }: { veri: BulmacaVerisi }) {
  const yerlesim = useMemo(() => yerlesimOlustur(veri.sorular), [veri])

  const hucreler = useMemo(() => {
    const harita = new Map<string, Hucre>()
    yerlesim.kelimeler.forEach((k, indeks) => {
      k.harfler.forEach((harf, i) => {
        const satir = k.yon === 'dikey' ? k.satir + i : k.satir
        const sutun = k.yon === 'yatay' ? k.sutun + i : k.sutun
        const a = anahtar(satir, sutun)
        const hucre = harita.get(a) ?? { satir, sutun, harf, kelimeler: {}, etiketler: [] }
        hucre.kelimeler[k.yon] = indeks
        if (i === 0) hucre.etiketler.push({ no: k.no, yon: k.yon })
        harita.set(a, hucre)
      })
    })
    return harita
  }, [yerlesim])

  const [degerler, setDegerler] = useState<Record<string, string>>({})
  const [sonuclar, setSonuclar] = useState<Record<string, Sonuc>>({})
  const [ozet, setOzet] = useState<{ dogru: number; toplam: number } | null>(null)
  const [aktif, setAktif] = useState<string | null>(null)
  const [yon, setYon] = useState<Yon>('yatay')
  const girisler = useRef(new Map<string, HTMLInputElement>())

  const aktifHucre = aktif ? hucreler.get(aktif) : undefined
  const aktifKelimeIndeksi =
    aktifHucre?.kelimeler[yon] ?? aktifHucre?.kelimeler[digerYon(yon)]
  const aktifKelimeHucreleri = useMemo(
    () =>
      new Set(
        aktifKelimeIndeksi === undefined
          ? []
          : kelimeHucreleri(yerlesim.kelimeler[aktifKelimeIndeksi]),
      ),
    [aktifKelimeIndeksi, yerlesim],
  )

  const odakla = (a: string) => girisler.current.get(a)?.focus()

  function harfYaz(a: string, harf: string) {
    setDegerler((d) => ({ ...d, [a]: harf }))
    setSonuclar((s) => {
      if (!(a in s)) return s
      const kopya = { ...s }
      delete kopya[a]
      return kopya
    })
    setOzet(null)
  }

  /** Aktif kelime içinde ileri (+1) veya geri (-1) komşu hücrenin anahtarı */
  function kelimedeKomsu(a: string, fark: number): string | undefined {
    const hucre = hucreler.get(a)
    if (!hucre) return undefined
    const indeks = hucre.kelimeler[yon] ?? hucre.kelimeler[digerYon(yon)]
    if (indeks === undefined) return undefined
    const liste = kelimeHucreleri(yerlesim.kelimeler[indeks])
    return liste[liste.indexOf(a) + fark]
  }

  function harfGir(a: string, ham: string) {
    let harfler = Array.from(harfNormalize(ham)).filter((h) => /\p{L}/u.test(h))
    // Kutudaki eski harfin yanına yazıldıysa eskisini at
    if (harfler.length > 1 && harfler[0] === degerler[a]) harfler = harfler.slice(1)
    if (harfler.length === 0) return
    // Birden fazla harf geldiyse (yapıştırma vb.) kelime boyunca dağıt
    let hedef: string | undefined = a
    let son = a
    for (const harf of harfler) {
      if (!hedef) break
      harfYaz(hedef, harf)
      son = hedef
      hedef = kelimedeKomsu(hedef, 1)
    }
    odakla(hedef ?? son)
  }

  function tusBasildi(e: KeyboardEvent<HTMLInputElement>, hucre: Hucre) {
    const a = anahtar(hucre.satir, hucre.sutun)
    const oklar: Record<string, [number, number, Yon]> = {
      ArrowLeft: [0, -1, 'yatay'],
      ArrowRight: [0, 1, 'yatay'],
      ArrowUp: [-1, 0, 'dikey'],
      ArrowDown: [1, 0, 'dikey'],
    }
    if (e.key in oklar) {
      e.preventDefault()
      const [ds, dc, yeniYon] = oklar[e.key]
      const hedef = anahtar(hucre.satir + ds, hucre.sutun + dc)
      if (hucreler.has(hedef)) {
        setYon(yeniYon)
        odakla(hedef)
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      if (degerler[a]) {
        harfYaz(a, '')
      } else {
        const onceki = kelimedeKomsu(a, -1)
        if (onceki) {
          harfYaz(onceki, '')
          odakla(onceki)
        }
      }
    } else if (e.key === 'Delete') {
      e.preventDefault()
      harfYaz(a, '')
    }
  }

  function kontrolEt() {
    const yeni: Record<string, Sonuc> = {}
    for (const [a, hucre] of hucreler) {
      // Boş kutular işaretlenmez; yalnızca yazılmış harfler değerlendirilir
      if (degerler[a]) yeni[a] = degerler[a] === hucre.harf ? 'dogru' : 'yanlis'
    }
    const dogru = yerlesim.kelimeler.filter((k) =>
      kelimeHucreleri(k).every((a) => yeni[a] === 'dogru'),
    ).length
    setSonuclar(yeni)
    setOzet({ dogru, toplam: yerlesim.kelimeler.length })
  }

  function temizle() {
    setDegerler({})
    setSonuclar({})
    setOzet(null)
  }

  function cevaplariGoster() {
    const hepsi: Record<string, string> = {}
    for (const [a, hucre] of hucreler) hepsi[a] = hucre.harf
    setDegerler(hepsi)
    setSonuclar({})
    setOzet(null)
  }

  function soruSec(k: YerlesmisKelime) {
    setYon(k.yon)
    odakla(anahtar(k.satir, k.sutun))
  }

  const izgaraStili = {
    '--sutun': yerlesim.sutunSayisi,
    gridTemplateColumns: `repeat(${yerlesim.sutunSayisi}, var(--hucre))`,
    gridTemplateRows: `repeat(${yerlesim.satirSayisi}, var(--hucre))`,
  } as CSSProperties

  const hepsiDogru = ozet !== null && ozet.dogru === ozet.toplam

  return (
    <div className="bulmaca">
      <h2>{veri.baslik}</h2>

      <div className="bulmaca-govde">
        <div className="bulmaca-tahta">
          <div className="bulmaca-izgara" style={izgaraStili}>
            {[...hucreler.entries()].map(([a, hucre]) => {
              const siniflar = ['hucre']
              if (aktifKelimeHucreleri.has(a)) siniflar.push('kelimede')
              if (aktif === a) siniflar.push('aktif')
              if (sonuclar[a]) siniflar.push(sonuclar[a])
              const ikiYonlu =
                hucre.kelimeler.yatay !== undefined && hucre.kelimeler.dikey !== undefined
              return (
                <div
                  key={a}
                  className={siniflar.join(' ')}
                  style={{ gridRow: hucre.satir + 1, gridColumn: hucre.sutun + 1 }}
                >
                  {hucre.etiketler.map((e) => (
                    <span key={e.yon} className={`etiket ${e.yon}`}>
                      {e.no}
                    </span>
                  ))}
                  <input
                    ref={(el) => {
                      if (el) girisler.current.set(a, el)
                      else girisler.current.delete(a)
                    }}
                    value={degerler[a] ?? ''}
                    aria-label={`Satır ${hucre.satir + 1}, sütun ${hucre.sutun + 1}`}
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => harfGir(a, e.target.value)}
                    onKeyDown={(e) => tusBasildi(e, hucre)}
                    onMouseDown={() => {
                      // Kesişim hücresine ikinci tıklama yönü değiştirir
                      if (aktif === a && ikiYonlu) setYon(digerYon)
                    }}
                    onFocus={(e) => {
                      e.target.select()
                      setAktif(a)
                      setYon((y) => (hucre.kelimeler[y] !== undefined ? y : digerYon(y)))
                    }}
                  />
                </div>
              )
            })}
          </div>

          <div className="ozel-harfler" aria-label="Almanca özel harfler">
            {OZEL_HARFLER.map((h) => (
              <button
                key={h}
                type="button"
                disabled={!aktif}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => aktif && harfGir(aktif, h)}
              >
                {h}
              </button>
            ))}
          </div>

          <div className="eylemler">
            <button type="button" className="birincil" onClick={kontrolEt}>
              Kontrol Et
            </button>
            <button type="button" onClick={temizle}>
              Temizle
            </button>
            <button type="button" onClick={cevaplariGoster}>
              Cevapları Göster
            </button>
          </div>

          <p className={`ozet ${hepsiDogru ? 'basarili' : ''}`} role="status">
            {ozet &&
              (hepsiDogru
                ? 'Tebrikler, bütün kelimeler doğru!'
                : `${ozet.toplam} kelimeden ${ozet.dogru} tanesi doğru. Kırmızı harfler yanlış.`)}
          </p>
        </div>

        <ol className="sorular">
          {yerlesim.kelimeler.map((k, indeks) => (
            <li key={k.id} className={indeks === aktifKelimeIndeksi ? 'aktif' : ''}>
              <button type="button" onClick={() => soruSec(k)}>
                <span className="soru-no">{k.no}</span>
                <span className="soru-yon" title={k.yon === 'yatay' ? 'Yatay' : 'Dikey'}>
                  {k.yon === 'yatay' ? '→' : '↓'}
                </span>
                <span className="soru-metin">{k.soru}</span>
                <span className="soru-uzunluk">{k.harfler.length} harf</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
