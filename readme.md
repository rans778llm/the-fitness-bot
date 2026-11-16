# 🤖 Local Obsidian Fitness Telegram Bot

A personal, local-first fitness assistant bot built with Node.js, TypeScript, and Telegraf, running via long-polling on Windows. It integrates directly with your local Obsidian vault (synchronized via Google Drive) and leverages Google's **Gemini AI SDK (`gemini-3.5-flash-lite`)** for multimodal equipment analysis and intelligent vault queries.

---

## ✨ Key Features

* **🏋️‍♂️ Multimodal Equipment & Exercise Extraction:** Send a photo of any gym machine or select an existing image. Gemini Vision analyzes the equipment, registers it in your vault, and auto-generates structured exercise notes complete with instructions and direct YouTube tutorial links.
* **📅 Interactive Weekly Plan Builder (`/plan`):** Choose how many days per week you want to train (1 to 7 days, ~1h/session) via an interactive inline keyboard. The bot generates an optimized split that maximizes muscle recovery time between sessions and avoids redundant exercise repetition.
* **📋 Daily Workout Execution & Weight Logging (`/today`):** Loads today's scheduled exercises from your active weekly plan, displays past weight telemetry, and provides interactive buttons to log weights or repeat previous values.
* **📊 Workout History (`/history`):** Reviews past chronological training logs over a 30-day window.
* **🤖 Natural Language Vault Queries:** Send any text message to query your workout history, weights, and routines directly from your Obsidian markdown notes using Gemini AI.
* **🔒 Secure & Private:** Includes Telegram user ID whitelist middleware so only authorized users can interact with the bot.

---

## 🛠️ Tech Stack

* **Runtime:** Node.js (v18+) with TypeScript (`nodenext` / ES2022)
* **Bot Framework:** Telegraf (Long Polling Mode)
* **AI & Vision Engine:** `@google/genai` (`gemini-3.5-flash-lite`)
* **Data Persistence:** Local Obsidian Vault Markdown files parsed and serialized via `gray-matter`
* **Process Manager:** PM2 (for background service persistence on Windows)

---

## 🚀 Quick Commands Reference

| Command / Action | Description |
| :--- | :--- |
| `/help` | Displays the complete interactive command reference guide. |
| `/plan` | Triggers the 1–7 day interactive weekly workout plan generator. |
| `/today` | Loads today's scheduled workout session and interactive weight-logging buttons. |
| `/history` | Displays workout logs from the past 30 days. |
| **[Send Photo]** | Automatically identifies gym equipment and registers exercises with YouTube links. |
| **[Text Chat]** | Queries your Obsidian fitness vault notes using Gemini AI. |

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file in your root directory:

```env
OBSIDIAN_VAULT_PATH="H:/My Drive/Rans-Vault"
FITNESS_BOT_SUBDIR="Self Projects/The Fitness Bot"
TELEGRAM_BOT_TOKEN="your_telegram_bot_token_here"
GEMINI_API_KEY="your_google_ai_studio_api_key_here"
ALLOWED_USER_ID="your_numeric_telegram_id_here"
```

---

## 📦 Building and Running Locally

1. **Install Dependencies:**
   ```powershell
   npm install
   ```

2. **Compile TypeScript:**
   ```powershell
   npm run build
   ```

3. **Start the Bot:**
   ```powershell
   npm start
   ```

*(Optional)* Run via **PM2** for persistent background execution:
```powershell
pm2 start dist/index.js --name the-fitness-bot
pm2 save
```