# Bulmaca

Almanca kelime öğretmek için çapraz bulmaca oyunu (React + TypeScript + Vite).

Canlı sürüm: https://tayfuns.github.io/bulmaca/

- Sorular `src/data/bulmaca.json` dosyasından gelir (ileride .NET API).
- Izgara, kelimelerin ortak harflerinden otomatik oluşturulur (`src/lib/yerlesim.ts`).

## Çalıştırma

```bash
npm install
npm run dev
```

## Yayın

`main` dalına yapılan her push, GitHub Actions ile GitHub Pages'e yayınlanır.
