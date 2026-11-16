# Functional Specification: Fitness Assistant Bot (v2.1)

## 1. Functional User Flows & Core Workflows

### 1.1 Equipment Registration & Video Extraction (Photo Upload)
* **Action:** The user sends a photo of a gym machine or equipment to the Telegram bot [cite: 6].
* **System Behavior:** 
  1. Downloads the highest-resolution image via Telegram API.
  2. Sends the image to Gemini Vision (`gemini-3.5-flash-lite`) to identify the machine name, category, and associated exercises with primary/secondary muscles, execution instructions, and direct YouTube tutorial video URLs [cite: 2, 11].
  3. Registers the equipment note and creates individual exercise markdown notes inside the local Obsidian vault (`Attachments/`, `Equipment/`, and `Exercises/`) [cite: 1, 11].

### 1.2 Interactive Weekly Workout Plan Creation (`/plan`)
* **Action:** The user sends `/plan` to the Telegram bot.
* **System Behavior:**
  1. The bot prompts the user with an interactive inline keyboard to choose how many days per week they wish to train (**1 to 7 days**, hardcoded to approximately **1 hour** per session).
  2. Upon selection (e.g., `create_plan|4`), `BotController` analyzes all vault exercises and leverages `gemini-3.5-flash-lite` to generate a customized weekly split that:
     * Maximizes muscle recovery time between sessions targeting the same muscle groups.
     * Avoids repeating exercises across the week unless the vault has an insufficient number of distinct exercises.
  3. Saves the structured schedule to `Plans/Active-Weekly-Plan.md` in YAML/Markdown format.
  4. Replies to the user with a day-by-day workout schedule complete with target muscles and direct, clickable YouTube tutorial links.

### 1.3 Daily Workout Execution & Weight Logging (`/today`)
* **Action:** The user sends `/today` [cite: 6].
* **System Behavior:**
  1. Reads `Plans/Active-Weekly-Plan.md` for the current day index (`current_day_index`) [cite: 1].
  2. Fetches the latest recorded weight telemetry from individual exercise notes [cite: 1].
  3. Creates a daily session log in `Logs/` and presents an interactive inline keyboard listing today's exercises with their last recorded weights [cite: 1, 2].
  4. Tapping an exercise prompts the user to input their performed weight in kg via text or click **Repeat Last** / **Cancel** [cite: 2].
  5. Updates both the daily log and the specific exercise's progression history table [cite: 1].

### 1.4 Workout Performance History (`/history`)
* **Action:** The user sends `/history` [cite: 6].
* **System Behavior:** Scans and retrieves chronological workout logs across a 30-day window to review past training performance [cite: 2].

### 1.5 Natural Language Vault Query & Help (`/help` & Text Chat)
* **Action:** The user sends `/help` or any free-text fitness question [cite: 2, 6].
* **System Behavior:**
  * `/help`: Displays a complete reference guide of all bot commands and actions with one-line examples [cite: 2, 6].
  * Text Messages: Injects the entire vault context into `gemini-3.5-flash-lite` to answer natural language queries regarding past weights, routines, and exercises [cite: 1, 6].
