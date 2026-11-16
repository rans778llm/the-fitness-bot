# The Fitness Bot 🏋️‍♂️

A production-ready Telegram fitness assistant built with Node.js, Telegraf, PM2 process management, and the Google Gemini SDK.

## Features
- **Equipment-First Workflow:** Upload equipment photos or gallery images for automated AI analysis and verification.
- **Interactive Weekly Workout Planner (`/plan`):** Choose training frequency (1–7 days) via Telegram inline keyboards to receive customized workout plans.
- **Direct High-View YouTube Links:** Automatically fetches direct watch URLs (`https://www.youtube.com/watch?v=...`) pointing to the most popular tutorial clips for each exercise.
- **Robust Error Handling & Chunking:** Automatically chunks long workout plans to stay within Telegram's 4,096 character message limit.
- **State Reset (`/reset`):** Safely clear bot state/data with inline confirmation prompts.
- **Background Service Persistence:** Runs continuously via PM2 on Windows / Linux without needing an open terminal.
