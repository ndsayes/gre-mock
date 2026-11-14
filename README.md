# 44 Days

A personal GRE quant practice app that runs as a web app on an iPhone home screen. One question at a time,
with step-by-step hints that never give the answer away, a timer you start yourself, and a streak.

This is not affiliated with or endorsed by ETS. The questions in this repository are original samples
written for the app.

## Status: stage 3

- Home screen: questions left today, a five-day streak strip, calendar, weekly chart
- Settings: daily target, name, Claude API key, tutor speed and the question bank connection
- Question types: quantitative comparison, multiple choice, select all that apply and numeric entry,
  with figures and charts
- Question bank: downloaded from a private repository and kept on the phone. New blueprints come
  first; a question you struggled with returns two days later as a different version of the same idea.
  Until a bank is connected, five built-in sample questions are used.
- Hints, a manual timer, a worked explanation, a key idea and, where one exists, a faster test-day route
- Ask the tutor: a chat with Claude about the question on screen, taught from first principles, with
  step-by-step walkthroughs that pair a picture with a colour-coded formula line. The tutor is told never
  to give the answer before you solve it.
- Show your work: a photo or a description of what you tried, checked by the tutor
- Screen stays on while a question is open (where the phone allows it)
- Progress backup: every finished question is saved on the phone and, within seconds, to `log.csv` in the
  private repository (one row per question; GitHub shows it as a table). Saves wait on the phone when there
  is no signal. A fresh install gets its history back the first time it syncs.

## Question bank

In Settings, enter the private repository (`owner/name`) and a GitHub fine-grained access token limited to
that repository with Contents set to Read and write. The app downloads `bank.json` from it and writes only
`log.csv`. The token is kept in the phone's browser storage and sent only to `api.github.com`.

## Claude API key

The tutor needs your own key from the Anthropic console, pasted once into Settings. It is kept in the
phone's browser storage and sent only to Anthropic. Setting a monthly spend limit in the console is a
sensible safeguard. The page's security policy only allows connections to this site, to
`api.anthropic.com` and to `api.github.com`.

`vendor/anthropic-sdk.js` is Anthropic's official JavaScript library (version 0.128.0, MIT licence,
see `vendor/LICENSE-anthropic-sdk.txt`).

## Install on an iPhone

1. Open the site in Safari.
2. Tap Share, then Add to Home Screen.
3. Open 44 Days from the home screen icon. Safari and the icon keep separate progress.

## What is not in this repository

No real question bank, no API keys and no personal progress data. Those stay on the phone or in a private
repository.

## Run it locally

Any static file server works, for example:

```bash
python -m http.server 4173
```

## Self-check

```bash
node test.js
```

Checks the sample answers by computing them, and the streak maths.
