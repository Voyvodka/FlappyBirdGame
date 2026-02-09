# Ultra Flappy Horizon

Modern web-based Flappy Bird game built with Phaser 3.

## Features

- Advanced parallax scene and procedural asset pipeline
- Dynamic difficulty (pipe variants, speed, and gap scaling)
- Local progression (skin unlock, achievement, local best)
- Global leaderboard with Vercel API + Redis integration

## Local Setup

```bash
yarn install
cp .env.example .env
yarn dev
```

## Environment Variables

Add the following variable to your `.env` file:

```bash
SCORE_SIGNING_SECRET=replace-with-a-long-random-secret
```

## Vercel Deploy

1. Connect the project to Vercel.
2. Add Redis (Upstash) integration from the Vercel Marketplace.
3. Configure the `SCORE_SIGNING_SECRET` environment variable.
4. Deploy.

Note: When Redis integration is connected, `KV_REST_API_URL` and `KV_REST_API_TOKEN` are created automatically on Vercel.

## Commands

```bash
yarn dev
yarn build
yarn preview
```
