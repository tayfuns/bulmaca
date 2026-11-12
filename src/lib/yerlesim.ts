export type Yon = 'yatay' | 'dikey'

/** Veritabanından gelen tek bir soru. satir/sutun/yon opsiyoneldir. */
export interface SoruVerisi {
  id: number
  soru: string
  cevap: string
  satir?: number
  sutun?: number
  yon?: Yon
}

export interface BulmacaVerisi {
  id: number
  baslik: string
  sorular: SoruVerisi[]
}

export interface YerlesmisKelime {
  id: number
  /** Ekranda görünen soru numarası (1'den başlar, JSON sırası) */
  no: number
  soru: string
  harfler: string[]
  satir: number
  sutun: number
  yon: Yon
}

export interface Yerlesim {
  satirSayisi: number
  sutunSayisi: number
  kelimeler: YerlesmisKelime[]
  /** Başka kelimeyle kesişemediği için ayrı duran kelimelerin id'leri */
  kesisimsizler: number[]
}

/** Tek harfi bulmaca biçimine çevirir: büyük harf, ß -> ẞ, Türkçe İ/ı -> I */
export function harfNormalize(metin: string): string {
  return metin
    .replace(/ß/g, 'ẞ')
    .replace(/[İı]/g, 'I')
    .toLocaleUpperCase('de-DE')
}

/** Cevabı harflere böler; boşluk, tire vb. atılır. */
export function harfleriAyir(cevap: string): string[] {
  return Array.from(harfNormalize(cevap)).filter((h) => /\p{L}/u.test(h))
}

export const anahtar = (satir: number, sutun: number) => `${satir},${sutun}`

interface Aday {
  indeks: number
  harfler: string[]
}

interface Konum {
  satir: number
  sutun: number
  yon: Yon
}

interface IzgaraHucresi {
  harf: string
  satir: number
  sutun: number
  yatay: boolean
  dikey: boolean
}

interface Deneme {
  konumlar: Map<number, Konum>
  adalar: number[]
  puan: number
}

function rastgeleUretici(tohum: number) {
  let a = tohum >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sinirlar(izgara: Map<string, IzgaraHucresi>) {
  let minS = Infinity
  let maxS = -Infinity
  let minC = Infinity
  let maxC = -Infinity
  for (const h of izgara.values()) {
    minS = Math.min(minS, h.satir)
    maxS = Math.max(maxS, h.satir)
    minC = Math.min(minC, h.sutun)
    maxC = Math.max(maxC, h.sutun)
  }
  return { minS, maxS, minC, maxC }
}

function adim(yon: Yon) {
  return yon === 'yatay' ? { ds: 0, dc: 1 } : { ds: 1, dc: 0 }
}

/** Kelime bu konuma kurallara uygun girebiliyorsa kesişim sayısını, giremiyorsa -1 döner. */
function kesisimSay(
  izgara: Map<string, IzgaraHucresi>,
  harfler: string[],
  konum: Konum,
): number {
  const { ds, dc } = adim(konum.yon)
  const n = harfler.length
  // Kelimenin hemen öncesi ve sonrası boş olmalı
  if (izgara.has(anahtar(konum.satir - ds, konum.sutun - dc))) return -1
  if (izgara.has(anahtar(konum.satir + ds * n, konum.sutun + dc * n))) return -1

  let kesisim = 0
  for (let i = 0; i < n; i++) {
    const s = konum.satir + ds * i
    const c = konum.sutun + dc * i
    const mevcut = izgara.get(anahtar(s, c))
    if (mevcut) {
      if (mevcut.harf !== harfler[i]) return -1
      if (mevcut[konum.yon]) return -1 // aynı yönde üst üste binme
      kesisim++
    } else {
      // Boş hücrenin yan komşuları dolu olursa istenmeyen bitişik kelime oluşur
      if (izgara.has(anahtar(s + dc, c + ds))) return -1
      if (izgara.has(anahtar(s - dc, c - ds))) return -1
    }
  }
  return kesisim
}

function yerlestir(
  izgara: Map<string, IzgaraHucresi>,
  harfler: string[],
  konum: Konum,
) {
  const { ds, dc } = adim(konum.yon)
  harfler.forEach((harf, i) => {
    const satir = konum.satir + ds * i
    const sutun = konum.sutun + dc * i
    const k = anahtar(satir, sutun)
    const hucre = izgara.get(k) ?? { harf, satir, sutun, yatay: false, dikey: false }
    hucre[konum.yon] = true
    izgara.set(k, hucre)
  })
}

function enIyiKonum(
  izgara: Map<string, IzgaraHucresi>,
  harfler: string[],
): Konum | null {
  const { minS, maxS, minC, maxC } = sinirlar(izgara)
  let enIyi: Konum | null = null
  let enIyiPuan = -Infinity
  const hucreler = [...izgara.values()]

  harfler.forEach((harf, i) => {
    for (const hucre of hucreler) {
      if (hucre.harf !== harf) continue
      for (const yon of ['yatay', 'dikey'] as const) {
        const { ds, dc } = adim(yon)
        const konum: Konum = {
          satir: hucre.satir - ds * i,
          sutun: hucre.sutun - dc * i,
          yon,
        }
        const kesisim = kesisimSay(izgara, harfler, konum)
        if (kesisim < 1) continue
        const sonS = konum.satir + ds * (harfler.length - 1)
        const sonC = konum.sutun + dc * (harfler.length - 1)
        const yukseklik = Math.max(maxS, sonS) - Math.min(minS, konum.satir) + 1
        const genislik = Math.max(maxC, sonC) - Math.min(minC, konum.sutun) + 1
        const puan = kesisim * 1000 - yukseklik * genislik - Math.abs(genislik - yukseklik)
        if (puan > enIyiPuan) {
          enIyiPuan = puan
          enIyi = konum
        }
      }
    }
  })
  return enIyi
}

function dene(adaylar: Aday[]): Deneme {
  const izgara = new Map<string, IzgaraHucresi>()
  const konumlar = new Map<number, Konum>()
  const ilk = adaylar[0]
  const ilkKonum: Konum = { satir: 0, sutun: 0, yon: 'yatay' }
  yerlestir(izgara, ilk.harfler, ilkKonum)
  konumlar.set(ilk.indeks, ilkKonum)

  let kalan = adaylar.slice(1)
  let ilerleme = true
  while (kalan.length && ilerleme) {
    ilerleme = false
    const sonraki: Aday[] = []
    for (const aday of kalan) {
      const konum = enIyiKonum(izgara, aday.harfler)
      if (konum) {
        yerlestir(izgara, aday.harfler, konum)
        konumlar.set(aday.indeks, konum)
        ilerleme = true
      } else {
        sonraki.push(aday)
      }
    }
    kalan = sonraki
  }

  const { minS, maxS, minC, maxC } = sinirlar(izgara)
  const alan = (maxS - minS + 1) * (maxC - minC + 1)
  const puan = konumlar.size * 100000 - alan - Math.abs(maxS - minS - (maxC - minC)) * 3

  // Kesişemeyen kelimeler oynanabilir kalsın diye ızgaranın altına ayrı satırlara konur
  const adalar: number[] = []
  let satir = maxS + 2
  for (const aday of kalan) {
    const konum: Konum = { satir, sutun: minC, yon: 'yatay' }
    yerlestir(izgara, aday.harfler, konum)
    konumlar.set(aday.indeks, konum)
    adalar.push(aday.indeks)
    satir += 2
  }
  return { konumlar, adalar, puan }
}

const DENEME_SAYISI = 80

/**
 * Soruları ızgaraya yerleştirir.
 * - Bütün sorularda satir/sutun/yon varsa onlar aynen kullanılır.
 * - Yoksa kelimeler ortak harflerinden kesişecek şekilde otomatik yerleştirilir.
 *   Aynı kelimeler ve aynı tohum her zaman aynı düzeni üretir.
 */
export function yerlesimOlustur(sorular: SoruVerisi[], tohum = 1): Yerlesim {
  const adaylar: Aday[] = sorular
    .map((s, indeks) => ({ indeks, harfler: harfleriAyir(s.cevap) }))
    .filter((a) => a.harfler.length > 0)

  if (adaylar.length === 0) {
    return { satirSayisi: 0, sutunSayisi: 0, kelimeler: [], kesisimsizler: [] }
  }

  let konumlar = new Map<number, Konum>()
  let adalar: number[] = []

  const hazir = adaylar.every((a) => {
    const s = sorular[a.indeks]
    return s.satir !== undefined && s.sutun !== undefined && s.yon !== undefined
  })

  if (hazir) {
    for (const a of adaylar) {
      const s = sorular[a.indeks]
      konumlar.set(a.indeks, { satir: s.satir!, sutun: s.sutun!, yon: s.yon! })
    }
  } else {
    const rastgele = rastgeleUretici(tohum)
    const uzunaGore = [...adaylar].sort((a, b) => b.harfler.length - a.harfler.length)
    let enIyi: Deneme | null = null
    for (let d = 0; d < DENEME_SAYISI; d++) {
      const sira = [...uzunaGore]
      if (d > 0) {
        for (let i = sira.length - 1; i > 0; i--) {
          const j = Math.floor(rastgele() * (i + 1))
          ;[sira[i], sira[j]] = [sira[j], sira[i]]
        }
      }
      const deneme = dene(sira)
      if (!enIyi || deneme.puan > enIyi.puan) enIyi = deneme
    }
    konumlar = enIyi!.konumlar
    adalar = enIyi!.adalar
  }

  // Sol üst köşe (0,0) olacak şekilde kaydır
  let minS = Infinity
  let minC = Infinity
  let maxS = -Infinity
  let maxC = -Infinity
  for (const a of adaylar) {
    const k = konumlar.get(a.indeks)!
    const { ds, dc } = adim(k.yon)
    minS = Math.min(minS, k.satir)
    minC = Math.min(minC, k.sutun)
    maxS = Math.max(maxS, k.satir + ds * (a.harfler.length - 1))
    maxC = Math.max(maxC, k.sutun + dc * (a.harfler.length - 1))
  }

  const kelimeler: YerlesmisKelime[] = adaylar.map((a) => {
    const k = konumlar.get(a.indeks)!
    const s = sorular[a.indeks]
    return {
      id: s.id,
      no: a.indeks + 1,
      soru: s.soru,
      harfler: a.harfler,
      satir: k.satir - minS,
      sutun: k.sutun - minC,
      yon: k.yon,
    }
  })

  return {
    satirSayisi: maxS - minS + 1,
    sutunSayisi: maxC - minC + 1,
    kelimeler,
    kesisimsizler: adalar.map((i) => sorular[i].id),
  }
}
