# Technical Design Specification: Next Phase — Native Android Application (`next_phase_technical_specification`)

## 1. Executive Summary & Architecture Migration
This document outlines the migration path of the personal fitness assistant from a local Node.js / Telegram bot architecture to a native, offline-first Android application. 

### 1.1 Architectural Shift
* **Current State:** Node.js backend using Telegraf long-polling, file-system Obsidian Markdown storage (`vaultManager`), and Telegram UI.
* **Target State:** Modern native Android application written in **Kotlin** using **Jetpack Compose** for UI, **Room Database (SQLite)** for offline-first local persistence, **CameraX** for hardware-accelerated equipment photo capture, and the official **Google GenAI SDK for Android** (`gemini-3.5-flash-lite`) for multimodal analysis and local AI queries.

---

## 2. Free-Tier Deployment Strategy & Cost Analysis
To keep deployment and maintenance completely **free** (with a one-time Google Play Console developer registration fee of $25 being the only exception):

* **AI & Vision Inference (`gemini-3.5-flash-lite`):** Utilizes Google AI Studio’s generous free tier limits for developers, calling the Gemini API directly from the client or via a free-tier serverless proxy if required.
* **Backend / Database Hosting:** **Zero backend servers required.** The app operates entirely locally on the user's device using an offline-first architecture. 
* **Source Control & CI/CD:** **GitHub Actions** (Free for public/private repositories) to automatically build, lint, and sign release APKs/App Bundles.
* **App Distribution:** **Google Play Console** (One-time $25 lifetime developer account fee). Alternative sideloading via GitHub Releases is completely free.

---

## 3. Core Module Design & Component Stack (Android)

### 3.1 Local Persistence Layer (`Room DB`)
Replaces the local Obsidian file system with structured relational tables to ensure instant querying and reactive UI updates via Kotlin Coroutines and Flows.
* **Entities:**
  * `EquipmentEntity`: ID, machine name, category, image local URI, date added.
  * `ExerciseEntity`: ID, equipment foreign key, name, primary/secondary muscles, instructions, youtubeUrl, lastWeight, weightUnit, lastPerformed.
  * `PlanEntity`: ID, daysPerWeek, hoursPerDay, currentDayIndex, totalSessionsCompleted, planMarkdown.
  * `WorkoutLogEntity`: ID, date, planDayIndex, exercisesJson / status.

### 3.2 Multimodal Camera & Gallery Pipeline (`CameraX` & `PhotoPicker`)
* **CameraX Integration:** Uses `PreviewView`, `ImageCapture`, and `ProcessCameraProvider` to capture high-resolution equipment photos directly inside the app.
* **Gallery Picker Contract:** Implements `ActivityResultContracts.GetContent()` (`image/*`) to allow users to instantly select pre-existing equipment or workout photos from their device gallery.
* **Gemini Vision Processing:** Encodes selected/captured images into base64 or multipart parts and passes them directly to `gemini-3.5-flash-lite` to extract machine names, muscle groups, and YouTube tutorial links.

### 3.3 Dynamic Weekly Plan Generator (`/plan` equivalent)
* **UI Workflow:** A dedicated plan configuration screen or dialog allowing the user to select training frequency (**1 to 7 days per week**, hardcoded to ~1h per session).
* **Scheduling Algorithm & AI Prompting:** Combines local Room exercise queries with `gemini-3.5-flash-lite` to distribute muscle groups for maximum recovery time between sessions and eliminate redundant exercise repetition.
* **Display & Navigation:** Renders a clean day-by-day card layout with clickable YouTube tutorial links.

---

## 4. Security & Privacy Architecture
* **API Key Management:** Gemini API keys are secured locally using **Jetpack Security (EncryptedSharedPreferences)** or compiled via BuildConfig variables.
* **Data Privacy:** All workout logs, weights, and personal schedules remain strictly local on the device inside the Room database, preventing third-party cloud data harvesting.
