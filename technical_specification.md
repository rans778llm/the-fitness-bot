# Technical Specification: Fitness Assistant Bot (v2.1)

## 1. System Architecture & Tech Stack

### 1.1 Core Technologies & Runtimes
* **Runtime:** Node.js (v18+) with **TypeScript v5.7** compiled to ES2022 modules (`nodenext` module resolution).
* **Bot Framework:** **Telegraf v4.16.3** (Telegram Bot API wrapper) operating in local polling mode.
* **AI & Vision Engine:** `@google/genai` SDK using `gemini-3.5-flash-lite` for multimodal photo analysis, muscle-recovery workout plan generation, and vault contextual queries.
* **Data Persistence Layer:** Local file-system operations interacting directly with an Obsidian vault synchronized via Google Drive, utilizing **`gray-matter`** for YAML frontmatter parsing and serialization.
* **Process Management:** PM2 process manager running locally on Windows.

### 1.2 Module Dependency Graph
```text
index.ts (Entry Point)
 ├──> VaultManager (File System & Gray-Matter Parser)
 └──> BotService (Telegraf Bot Listeners, Handlers, Security Middleware)
       └──> BotController (Business Logic, AI Orchestration, State Transition)
             └──> GoogleGenAI (@google/genai SDK)
```

---

## 2. Component Design & Implementation Details

### 2.1 Entry Point (`src/index.ts`)
* Initializes the application lifecycle.
* Invokes `VaultManager.ensureDirectories()` to guarantee that required vault subfolders (`Attachments`, `Equipment`, `Exercises`, `Logs`, `Plans`) exist.
* Calls `startTelegramBot()` to spin up long-polling event listeners.

### 2.2 Telegram Service Layer (`src/botService.ts`)
Acts as the presentation and event-handling layer interfacing with Telegram.
* **Security Middleware:** Intercepts every incoming update and drops messages if `ctx.from?.id` does not match `ALLOWED_USER_ID`.
* **Native Command Menu (`setMyCommands`):** Registers `/today`, `/plan`, `/history`, and `/help` in Telegram's slash-command menu on startup.
* **Stateful Input Mapping (`pendingLogs` Map):** Tracks active pending weight entries per user ID when numeric weight inputs are expected via text chat.
* **Command Handlers:**
  * `/help`: Outputs a formatted command and action reference guide with one-line usage examples for every supported workflow.
  * `/plan`: Renders an inline keyboard allowing the user to select `1` through `7` training days per week (with session length fixed at ~1 hour).
  * `/today`: Invokes `BotController.handleTodaysPlan()` and renders interactive inline keyboards (`Markup.inlineKeyboard`) listing daily exercises with last recorded weights.
  * `/history`: Fetches past training logs within a 30-day window.
* **Action Handlers (`bot.action`):**
  * `/^create_plan\|([1-7])$/`: Triggers `BotController.handleCreateWeeklyPlan(daysPerWeek, 1)` and outputs the generated day-by-day split with clickable YouTube tutorial links (splitting messages automatically if output exceeds Telegram's 4,096-character limit).
  * `/^log\|([^|]+)\|(\d+)\|(.+)$/`: Captures callback queries when users tap specific exercise buttons to log weight.
  * Handles "Repeat Last" (`repeat|...`) weight actions and "Cancel" (`cancel`) workflows.
* **Multimodal Photo Pipeline (`bot.on('photo')`):**
  1. Retrieves the highest-resolution photo file ID from Telegram's array.
  2. Downloads the binary image buffer via Telegram File API (`ctx.telegram.getFileLink`) using `axios`.
  3. Saves a temporary JPEG copy locally and packages it into an `inlineData` base64 payload.
  4. Prompts `gemini-3.5-flash-lite` with structured extraction instructions requiring JSON output (`machineName`, `category`, and `exercises` with `muscles`, `instructions`, and `youtubeUrl`).
  5. Sanitizes raw AI text outputs (stripping markdown code blocks and locating JSON boundaries).
  6. Renames and moves the verified attachment image to the vault's `Attachments/` directory and calls `BotController.handleGenerateExercises()`.

### 2.3 Business Logic & Controller Layer (`src/botController.ts`)
Encapsulates application workflows and model orchestration.
* **`handleGenerateExercises()`:** Copies attachments, delegates equipment note creation, and iterates through detected exercises to save individual exercise notes containing execution instructions and direct YouTube watch URLs.
* **`getAllExercisesMetadata()`:** Reads all markdown files in `Exercises/` and parses YAML frontmatter (`primary_muscles`, `equipment`, `youtube_link`, `last_weight`).
* **`handleCreateWeeklyPlan(daysPerWeek, hoursPerDay = 1)`:** Collects all vault exercises and prompts `gemini-3.5-flash-lite` to construct a `daysPerWeek` split (~5–6 exercises per 1-hour session) that:
  1. Distributes muscle groups across the week to maximize recovery time between sessions targeting the same muscles.
  2. Avoids repeating exercises across days unless the vault contains fewer unique exercises than needed to fill the schedule.
  3. Writes the resulting multi-day schedule with YouTube video links to `Plans/Active-Weekly-Plan.md` and returns structured day data to the Telegram UI. Includes a deterministic round-robin fallback if AI JSON parsing fails.
* **`handleTodaysPlan()`:** Reads the active weekly plan, parses exercise wikilinks using regex (`/\[\[(.*?)\]\]/g`), reads last recorded weights from individual exercise files, initializes today's daily log file via `VaultManager`, and cycles the `current_day_index` forward.
* **`handleReport()`:** Updates the specific row in today's workout log and appends a new entry to the exercise's progression table.
* **`handleAskVault()`:** Recursively collects and concatenates all markdown notes in the vault directory (`collectVaultMarkdown`), injecting them as context into `gemini-3.5-flash-lite` to answer free-text fitness queries.

### 2.4 Vault Data Persistence Layer (`src/vaultManager.ts`)
Handles file system persistence using `fs` and frontmatter manipulation via `gray-matter`.
* **Path Resolution:** Resolves absolute paths dynamically via `path.join(BASE_PATH, relativePath)` where `BASE_PATH` points to the Google Drive Obsidian directory.
* **Note Structuring:**
  * **Equipment Notes:** YAML frontmatter (`type: equipment`, `category`, `image`, `exercises`) paired with Markdown content links.
  * **Exercise Notes:** YAML frontmatter (`type: exercise`, `equipment`, `primary_muscles`, `last_weight`, `youtube_link`) paired with Markdown sections for Instructions, Video Guides, and Weight Progression Log tables.
  * **Weekly Plan Note (`Plans/Active-Weekly-Plan.md`):** YAML frontmatter (`type: plan`, `days_per_week`, `hours_per_day`, `current_day_index`, `total_sessions_completed`) paired with daily exercise sections and video links.
  * **Workout Logs (`Logs/YYYY-MM-DD-Day-X.md`):** YAML frontmatter (`type: workout_log`, `date`, `plan_day_index`) paired with markdown tables mapping exercises to logged weights.

---

## 3. Configuration & Environment (`tsconfig.json`, `package.json`, `.env`)

* **TypeScript Compilation:** Uses `nodenext` module resolution with ES2022 target compatibility to support native Node.js ESM imports (`.js` extensions required in import paths).
* **Dependencies:**
  * `@google/genai` (^3.3.0)
  * `telegraf` (^4.16.3)
  * `gray-matter` (^4.0.3)
  * `axios` (^1.7.9)
  * `dotenv` (^16.4.7)
* **Environment Variables (`.env`):**
  * `OBSIDIAN_VAULT_PATH`: Root path to vault directory.
  * `FITNESS_BOT_SUBDIR`: Subdirectory containing bot files.
  * `TELEGRAM_BOT_TOKEN`: Telegram bot API token.
  * `GEMINI_API_KEY`: Gemini API authorization key.
  * `ALLOWED_USER_ID`: Authorized Telegram user whitelist ID.