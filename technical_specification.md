# Technical Specification: The Fitness Bot

## 1. Architecture Overview
- **Runtime:** Node.js with TypeScript (`tsx` / `tsc`).
- **Framework:** Telegraf (Telegram Bot API wrapper).
- **AI Core:** `@google/genai` SDK using `gemini-3.5-flash-lite` for text/plan generation and vision tasks.
- **Process Manager:** PM2 (running as a persistent background service).

## 2. Core Modules & Files
- `src/index.ts`: Main bot initialization, command router (`/help`, `/plan`, `/reset`), photo upload handler, and text message fallbacks.
- `src/botPlan.ts`: Handles the `/plan` command, interactive 1–7 day inline keyboard callbacks, Gemini AI plan generation, direct YouTube high-view URL formatting, and automated message chunking (`sendLongMessage`).
- `src/botReset.ts`: Manages state reset workflow with confirmation prompts.
- `src/botService.ts`: Manages equipment processing and URL validation/fallback utilities.
- `src/utils/youtubeValidator.ts`: Validates and verifies YouTube video availability.

## 3. Key Workflows
1. **Equipment Upload:** User sends photos of gym equipment -> Bot analyzes via Gemini Vision.
2. **Plan Generation (`/plan`):** User selects 1–7 days via inline buttons -> Bot queries `gemini-3.5-flash-lite` -> Generates structured Markdown routine with direct high-view YouTube watch links -> Chunks response if >3,800 characters and delivers to user.
