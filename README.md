# 44 Days

A personal GRE quant practice app that runs as a web app on an iPhone home screen. One question at a time,
with step-by-step hints that never give the answer away, a timer you start yourself, and a streak.

This is not affiliated with or endorsed by ETS. The questions in this repository are original samples
written for the app.

## Status: stage 1

- Home screen: questions left today, streak strip, calendar, weekly chart
- Settings: daily target and name
- Five sample questions with hints, a manual timer and a worked explanation
- Screen stays on while a question is open (where the phone allows it)
- Progress is saved in the phone's browser storage only

Still to come: the live tutor chat and photo check, the private question bank, and realtime backup of the
progress log to a private repository.

## Install on an iPhone

1. Open the site in Safari.
2. Tap Share, then Add to Home Screen.
3. Open 44 Days from the home screen icon. Safari and the icon keep separate progress.

## What is not in this repository

No real question bank, no API keys and no personal progress data. Those stay on the phone or in a private
repository.

## Self-check

```bash
node test.js
```

Checks the sample answers by computing them, and the streak maths.
