# 44 Days

A personal GRE quant practice app that runs as a web app on an iPhone home screen. One question at a time,
with step-by-step hints that never give the answer away, a timer you start yourself, and a streak.

This is not affiliated with or endorsed by ETS. The questions in this repository are original samples
written for the app.

## Status: stage 2

- Home screen: questions left today, streak strip, calendar, weekly chart
- Settings: daily target, name and Claude API key
- Five sample questions with hints, a manual timer and a worked explanation
- Ask the tutor: a chat with Claude about the question on screen, including a "But why?" link under
  each hint and simple bar pictures. The tutor is told never to give the answer before you solve it.
- Show your work: a photo or a description of what you tried, checked by the tutor
- Screen stays on while a question is open (where the phone allows it)
- Progress is saved in the phone's browser storage only

Still to come: the private question bank, and realtime backup of the progress log to a private repository.

## Claude API key

The tutor needs your own key from the Anthropic console, pasted once into Settings. It is kept in the
phone's browser storage and sent only to Anthropic. Setting a monthly spend limit in the console is a
sensible safeguard. The page's security policy only allows connections to this site and to
`api.anthropic.com`.

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
