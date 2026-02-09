# Ultra Flappy Horizon

Web tabanli, Phaser 3 ile gelistirilmis modern Flappy Bird oyunu.

## Ozellikler

- Gelismis parallax sahne ve procedural asset yapisi
- Dinamik zorluk (pipe varyantlari, hiz ve gap ayari)
- Local progression (skin unlock, achievement, local best)
- Vercel API + Redis entegrasyonu ile global leaderboard

## Lokal Kurulum

```bash
yarn install
cp .env.example .env
yarn dev
```

## Ortam Degiskenleri

`.env` dosyasina su degiskeni eklenmelidir:

```bash
SCORE_SIGNING_SECRET=replace-with-a-long-random-secret
```

## Vercel Deploy

1. Projeyi Vercel'e baglayin.
2. Marketplace uzerinden Redis (Upstash) entegrasyonu ekleyin.
3. `SCORE_SIGNING_SECRET` env degiskenini tanimlayin.
4. Deploy alin.

Not: Redis entegrasyonu eklendiginde `KV_REST_API_URL` ve `KV_REST_API_TOKEN` degiskenleri Vercel tarafinda otomatik olusur.

## Komutlar

```bash
yarn dev
yarn build
yarn preview
```
