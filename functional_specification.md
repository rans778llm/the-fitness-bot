# Functional Specification: Local Obsidian Fitness Telegram Bot (v2.1)

## 1. Overview
The Fitness Bot is a personal Telegram bot designed to manage workouts, log progress, and maintain a structured exercise knowledge base inside a local Obsidian vault.

## 2. User Roles & Access Control
* **Single User (Private):** Restricted exclusively to the configured `ALLOWED_USER_ID`. Unauthorized users receive no response or an access-denied message.

## 3. Core Functional Modules
### 3.1 Equipment Registration & Multimodal AI Vision
* User sends a photo of a gym machine or uploads from the device gallery.
* Gemini Vision (`gemini-3.5-flash-lite`) analyzes the machine, identifies muscle groups, names the equipment, and assigns a tutorial video.
* **YouTube Link Verification & Fallback:** Automatically tests the validity of the generated YouTube URL. If the video is deleted or unavailable, it automatically requests an active replacement video ID from Gemini before saving.

### 3.2 Interactive Weekly Plan Builder (`/plan`)
* Triggered via `/plan`.
* Presents an inline keyboard to select training frequency (1 to 7 days per week).
* Generates an AI-optimized training split balancing muscle recovery and variety.

### 3.3 Daily Workout Execution (`/today`)
* Retrieves today's scheduled routine from the active plan stored in Obsidian.
* Displays exercise details, past recorded weights, and interactive buttons to log new weights or repeat past values.

### 3.4 Workout History (`/history`)
* Displays past training logs over a 30-day chronological window.

### 3.5 System Reset (`/reset`)
* Triggered via `/reset`.
* Prompts the user with an inline confirmation keyboard to prevent accidental data wipes.
