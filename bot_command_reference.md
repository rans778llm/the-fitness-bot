# Bot Command & Action Reference

* `/help`
  * *Explanation:* Displays all available bot commands and supported actions along with a one-line usage example for each.

* `/plan`
  * *Explanation:* Prompts you to select how many training days per week you want (1 to 7 days, ~1h/session) and generates a muscle-recovery-optimized weekly split with direct YouTube tutorial links.

* `/today`
  * *Explanation:* Loads today's scheduled workout session from your active plan, displays previous weight telemetry, and generates interactive logging buttons.

* `log|<file>|<index>|<exercise>`
  * *Explanation:* Inline callback triggered when tapping an exercise button to select a specific weight for your current workout set.

* `repeat|<file>|<index>|<exercise>`
  * *Explanation:* Inline callback that instantly logs the exact same weight used in your previous session for that exercise.

* `cancel`
  * *Explanation:* Cancels the current pending weight logging state and aborts the active prompt.

* `/history`
  * *Explanation:* Scans and retrieves chronological workout logs across the past 30 days to review past training performance.

* Send photo of gym equipment (triggers `generateExercises`)
  * *Explanation:* Automatically analyzes uploaded equipment photos via Gemini vision, registers the machine name, and generates corresponding exercise notes in your vault.

* Send text message (triggers AI vault query via `gemini-3.5-flash-lite`)
  * *Explanation:* Queries all notes across your Obsidian fitness vault to answer natural language fitness and history questions.
