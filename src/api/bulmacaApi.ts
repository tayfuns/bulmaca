import type { BulmacaVerisi } from '../lib/yerlesim'
import ornekVeri from '../data/bulmaca.json'

/**
 * Bulmaca listesini getirir. Şimdilik dummy JSON dosyasından okur.
 * .NET tarafı hazır olduğunda yalnızca bu fonksiyon değişecek, ör.:
 *   const yanit = await fetch('/api/bulmacalar?kitapId=12'); return yanit.json()
 */
export async function bulmacalariGetir(): Promise<BulmacaVerisi[]> {
  return ornekVeri.bulmacalar as BulmacaVerisi[]
}
