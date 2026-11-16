# Local Obsidian Fitness Telegram Bot — Complete Implementation Guide

This guide covers everything required to set up, code, configure, and run your personal local fitness Telegram bot on a Windows workstation. The bot communicates via **Telegraf Long Polling** (requiring no public web server or PaaS), interacts directly with your local Obsidian vault (`H:/My Drive/Rans-Vault`), and uses `gemini-3.5-flash-lite` for vision analysis, smart workout split generation, and AI-powered natural language queries.

* **Reference Documentation:** [View Functional Specification PDF](./Functional%20Spec.pdf)
---

## Prerequisites
* **Node.js** (v18 or higher) installed on your Windows machine.
* An **Obsidian Vault** stored locally (e.g., at `H:/My Drive/Rans-Vault`).
* A **Google AI Studio API Key** (free tier).

---

## Part 1: Manual Setup Steps

### Step 1: Create the Telegram Bot via `@BotFather`
1. Open Telegram, search for the verified **`@BotFather`**, and send `/newbot`.
2. Enter your display name: `The Fitness Bot`.
3. Enter a unique username ending in `bot` (e.g., `ran_the_fitness_bot`).
4. Copy the generated **HTTP API Token**.

### Step 2: Retrieve Your Numeric Telegram User ID
1. Send a message (e.g., `hi`) to your newly created bot in Telegram.
2. Open your browser and navigate to:
   ```text
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Locate the `"from"` object in the JSON response and copy your numeric `"id"` (e.g., `482279142`).

### Step 3: Initialize the Local Node.js / TypeScript Project
Open your terminal (PowerShell) in your desired project directory (e.g., `C:\TheFitnessBot`) and run:
```powershell
Set-ExecutionPolicy Bypass -Scope Process
npm init -y
npm pkg set type="module"
npm install @google/genai telegraf dotenv gray-matter axios
npm install --save-dev typescript @types/node ts-node
```

---

## Part 2: Project Configuration Files

### 1. `tsconfig.json`
Create a `tsconfig.json` file in your root folder:
```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": false
  },
  "include": ["src/**/*"]
}
```

### 2. `package.json`
Update your `package.json` scripts and dependencies:
```json
{
  "name": "thefitnessbot",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "seed": "node dist/seed.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "@google/genai": "^3.3.0",
    "axios": "^1.7.9",
    "dotenv": "^16.4.7",
    "gray-matter": "^4.0.3",
    "telegraf": "^4.16.3"
  },
  "devDependencies": {
    "@types/node": "^22.10.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.2"
  }
}
```

### 3. `.env`
Create a `.env` file in your root folder with your secrets and paths:
```env
OBSIDIAN_VAULT_PATH="H:/My Drive/Rans-Vault"
FITNESS_BOT_SUBDIR="Self Projects/The Fitness Bot"
TELEGRAM_BOT_TOKEN="your_telegram_bot_token_here"
GEMINI_API_KEY="your_google_ai_studio_api_key_here"
ALLOWED_USER_ID="your_numeric_telegram_id_here"
```

---

## Part 3: Source Code (`src/`)

### 1. `src/vaultManager.ts`
Handles local markdown file creation, frontmatter parsing, and folder syncing with Obsidian:
```typescript
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BASE_PATH = 'H:/My Drive/Rans-Vault/Self Projects/The Fitness Bot';

export class VaultManager {
  static getFullPath(relativePath: string): string {
    return path.join(BASE_PATH, relativePath);
  }

  static ensureDirectories(): void {
    const dirs = ['Attachments', 'Equipment', 'Exercises', 'Logs', 'Plans'];
    for (const dir of dirs) {
      const fullPath = path.join(BASE_PATH, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  static saveEquipmentNote(equipmentName: string, category: string, imageName: string, exercises: string[]): void {
    this.ensureDirectories();
    const filePath = path.join(BASE_PATH, 'Equipment', `${equipmentName}.md`);

    const data = {
      type: 'equipment',
      name: equipmentName,
      category: category,
      image: `[[Attachments/${imageName}]]`,
      exercises: exercises.map(ex => `[[${ex}]]`)
    };

    const exerciseLinks = exercises.map(ex => `- [[${ex}]]`).join('\n');
    const content = `# ${equipmentName}\n\n**Category:** ${category}\n\n![[Attachments/${imageName}]]\n\n## Associated Exercises\n${exerciseLinks}\n`;

    const fileContent = matter.stringify(content, data);
    fs.writeFileSync(filePath, fileContent, 'utf8');
  }

  static saveExerciseNote(exerciseName: string, equipmentName: string, primaryMuscles: string[], instructions: string = '', youtubeUrl: string = ''): void {
    this.ensureDirectories();
    const filePath = path.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
    if (fs.existsSync(filePath)) return;

    const finalYouTubeUrl = youtubeUrl && youtubeUrl.startsWith('http') 
      ? youtubeUrl 
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseName + ' exercise form')}`;

    const data = {
      type: 'exercise',
      name: exerciseName,
      equipment: `[[${equipmentName}]]`,
      primary_muscles: primaryMuscles,
      last_weight: null,
      weight_unit: 'kg',
      last_performed: null,
      youtube_link: finalYouTubeUrl
    };

    const content = `# ${exerciseName}\n\n**Equipment:** [[${equipmentName}]]  \n**Target Muscles:** ${primaryMuscles.join(', ')}\n\n## Instructions\n${instructions || 'Perform with controlled movement and proper form.'}\n\n## Video Guide\n* [Watch Most Viewed Tutorial on YouTube](${finalYouTubeUrl})\n\n## Weight Progression Log\n| Date | Weight (kg) | Session Log |\n| :--- | :---: | :--- |\n`;

    const fileContent = matter.stringify(content, data);
    fs.writeFileSync(filePath, fileContent, 'utf8');
  }

  static saveWeeklyPlan(daysPerWeek: number, hoursPerDay: number, planMarkdown: string): void {
    this.ensureDirectories();
    const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');

    const data = {
      type: 'plan',
      days_per_week: daysPerWeek,
      hours_per_day: hoursPerDay,
      current_day_index: 1,
      total_sessions_completed: 0
    };

    const fileContent = matter.stringify(planMarkdown, data);
    fs.writeFileSync(filePath, fileContent, 'utf8');
  }

  static getActivePlan() {
    const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
    if (!fs.existsSync(filePath)) throw new Error('No active weekly plan found. Create one first.');
    const raw = fs.readFileSync(filePath, 'utf8');
    return matter(raw);
  }

  static updatePlanIndex(nextDayIndex: number, sessionsCompleted: number): void {
    const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    parsed.data.current_day_index = nextDayIndex;
    parsed.data.total_sessions_completed = sessionsCompleted;
    const updatedContent = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, updatedContent, 'utf8');
  }

  static createWorkoutLog(dateStr: string, dayIndex: number, exercises: { exercise: string; lastWeight: number | null }[]): string {
    this.ensureDirectories();
    const fileName = `${dateStr}-Day-${dayIndex}.md`;
    const filePath = path.join(BASE_PATH, 'Logs', fileName);

    const data = {
      type: 'workout_log',
      date: dateStr,
      plan_day_index: dayIndex
    };

    let tableContent = `## Workout Log - Day ${dayIndex}\n\n| Exercise | Weight (kg) |\n| :--- | :---: |\n`;
    exercises.forEach(ex => {
      tableContent += `| [[${ex.exercise}]] | ${ex.lastWeight ?? ''} |\n`;
    });

    const fileContent = matter.stringify(tableContent, data);
    fs.writeFileSync(filePath, fileContent, 'utf8');
    return fileName;
  }

  static updateLogEntry(logFileName: string, exerciseNumber: number, weight: number): void {
    const filePath = path.join(BASE_PATH, 'Logs', logFileName);
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);

    const lines = parsed.content.split('\n');
    let currentRow = 0;
    const updatedLines = lines.map(line => {
      if (line.startsWith('| [[')) {
        currentRow++;
        if (currentRow === exerciseNumber) {
          const parts = line.split('|');
          if (parts.length >= 3) {
            parts[2] = ` ${weight} `;
            return parts.join('|');
          }
        }
      }
      return line;
    });

    parsed.content = updatedLines.join('\n');
    const updatedFile = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, updatedFile, 'utf8');
  }

  static updateExerciseWeight(exerciseName: string, weight: number, dateStr: string, logFileName: string): void {
    const filePath = path.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);

    parsed.data.last_weight = weight;
    parsed.data.last_performed = dateStr;

    const newRow = `| ${dateStr} | ${weight} | [[Logs/${logFileName}|Session Log]] |\n`;
    if (!parsed.content.includes(newRow)) {
      parsed.content += newRow;
    }

    const updatedFile = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, updatedFile, 'utf8');
  }

  static getLogsInRange(startDate: string, endDate: string) {
    const logsDir = path.join(BASE_PATH, 'Logs');
    if (!fs.existsSync(logsDir)) return [];
    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.md'));
    const matchedLogs = [];

    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = matter(raw);
      const logDate = parsed.data.date;
      if (logDate && logDate >= startDate && logDate <= endDate) {
        matchedLogs.push(parsed);
      }
    }
    return matchedLogs;
  }
}
```

### 2. `src/botController.ts`
Manages workout business logic, AI-driven muscle-recovery plan generation, and vault queries via `gemini-3.5-flash-lite`:
```typescript
import { VaultManager } from './vaultManager.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ExerciseMetadata {
  name: string;
  muscles: string[];
  equipment: string;
  youtubeUrl: string;
  lastWeight: number | null;
}

export interface GeneratedPlanDay {
  day: number;
  title: string;
  exercises: ExerciseMetadata[];
}

export class BotController {
  
  static async handleGenerateExercises(
    imagePath: string, 
    machineName: string, 
    category: string, 
    exercisesList: { name: string; muscles: string[]; instructions?: string; youtubeUrl?: string }[]
  ) {
    const fileName = path.basename(imagePath);
    const targetAttachmentPath = VaultManager.getFullPath(path.join('Attachments', fileName));
    
    if (!fs.existsSync(path.dirname(targetAttachmentPath))) {
      fs.mkdirSync(path.dirname(targetAttachmentPath), { recursive: true });
    }
    
    fs.copyFileSync(imagePath, targetAttachmentPath);

    const exerciseNames = exercisesList.map(e => e.name);
    VaultManager.saveEquipmentNote(machineName, category, fileName, exerciseNames);

    for (const ex of exercisesList) {
      VaultManager.saveExerciseNote(
        ex.name, 
        machineName, 
        ex.muscles, 
        ex.instructions || '', 
        ex.youtubeUrl || ''
      );
    }

    return {
      success: true,
      message: `Successfully registered machine **${machineName}** and generated ${exercisesList.length} exercises with instructions and direct video links.`
    };
  }

  static getAllExercisesMetadata(): ExerciseMetadata[] {
    const exercisesDir = VaultManager.getFullPath('Exercises');
    if (!fs.existsSync(exercisesDir)) return [];

    const files = fs.readdirSync(exercisesDir).filter(f => f.endsWith('.md'));
    return files.map(file => {
      const exName = file.replace('.md', '');
      const raw = fs.readFileSync(path.join(exercisesDir, file), 'utf8');
      const parsed = matter(raw);

      const muscles = Array.isArray(parsed.data.primary_muscles)
        ? parsed.data.primary_muscles
        : parsed.data.primary_muscles
        ? [String(parsed.data.primary_muscles)]
        : ['General'];

      const equipment = parsed.data.equipment
        ? String(parsed.data.equipment).replace(/\[\[|\]\]/g, '')
        : 'Gym Equipment';

      const youtubeUrl = parsed.data.youtube_link && String(parsed.data.youtube_link).startsWith('http')
        ? String(parsed.data.youtube_link)
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(exName + ' exercise form')}`;

      const lastWeight = typeof parsed.data.last_weight === 'number' ? parsed.data.last_weight : null;

      return { name: exName, muscles, equipment, youtubeUrl, lastWeight };
    });
  }

  static async handleCreateWeeklyPlan(daysPerWeek: number, hoursPerDay: number = 1): Promise<{
    success: boolean;
    message: string;
    days: GeneratedPlanDay[];
  }> {
    const allExercises = this.getAllExercisesMetadata();
    if (allExercises.length === 0) {
      throw new Error('No exercises found in vault. Add equipment photos first.');
    }

    const targetExercisesPerDay = Math.max(4, Math.min(6, Math.round(hoursPerDay * 6)));

    const prompt = `You are an expert strength & conditioning coach. Build a ${daysPerWeek}-day weekly workout split where each workout session takes approximately ${hoursPerDay} hour(s) (roughly ${targetExercisesPerDay} exercises per day).

Available Exercises in the user's gym vault:
${JSON.stringify(allExercises.map(e => ({ name: e.name, muscles: e.muscles, equipment: e.equipment })), null, 2)}

Strict Scheduling Rules:
1. Maximize muscle recovery: Distribute muscle groups across the ${daysPerWeek} days so each muscle gets the maximum possible rest days between sessions.
2. Avoid repeating exercises across the week: Use unique exercises across all ${daysPerWeek} days whenever possible. ONLY repeat an exercise if there are not enough distinct exercises in the vault to fill all ${daysPerWeek} sessions (~${targetExercisesPerDay} exercises per session).
3. Use ONLY exact exercise names from the provided list.

Return ONLY a valid JSON object with this exact structure:
{
  "days": [
    {
      "day": 1,
      "title": "Focus Area (e.g., Chest & Triceps / Upper Body)",
      "exercises": ["Exact Exercise Name 1", "Exact Exercise Name 2"]
    }
  ]
}`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [prompt]
    });

    const rawText = aiResponse.text?.trim() || '{}';
    const sanitized = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = sanitized.indexOf('{');
    const lastBrace = sanitized.lastIndexOf('}');
    const jsonClean = firstBrace !== -1 && lastBrace !== -1 ? sanitized.substring(firstBrace, lastBrace + 1) : '{}';

    const parsedPlan = JSON.parse(jsonClean);
    const exerciseMap = new Map(allExercises.map(ex => [ex.name.toLowerCase(), ex]));

    const structuredDays: GeneratedPlanDay[] = [];
    let planMarkdown = '';

    if (Array.isArray(parsedPlan.days) && parsedPlan.days.length > 0) {
      for (const dayItem of parsedPlan.days) {
        const dayNum = Number(dayItem.day) || structuredDays.length + 1;
        const dayTitle = String(dayItem.title || `Session ${dayNum}`).trim();
        const dayExercises: ExerciseMetadata[] = [];

        for (const rawName of dayItem.exercises || []) {
          const found = exerciseMap.get(String(rawName).trim().toLowerCase());
          if (found) dayExercises.push(found);
        }

        if (dayExercises.length > 0) {
          structuredDays.push({ day: dayNum, title: dayTitle, exercises: dayExercises });
        }
      }
    }

    if (structuredDays.length === 0) {
      const totalNeeded = daysPerWeek * targetExercisesPerDay;
      const pool: ExerciseMetadata[] = [];
      while (pool.length < totalNeeded) pool.push(...allExercises);
      for (let d = 1; d <= daysPerWeek; d++) {
        structuredDays.push({
          day: d,
          title: `Session ${d}`,
          exercises: pool.slice((d - 1) * targetExercisesPerDay, d * targetExercisesPerDay)
        });
      }
    }

    for (const d of structuredDays) {
      planMarkdown += `## Day ${d.day}: ${d.title}\n`;
      d.exercises.forEach((ex, idx) => {
        planMarkdown += `${idx + 1}. [[${ex.name}]] (${ex.muscles.join(', ')}) — [Video Guide](${ex.youtubeUrl})\n`;
      });
      planMarkdown += `\n`;
    }

    VaultManager.saveWeeklyPlan(daysPerWeek, hoursPerDay, planMarkdown);

    return {
      success: true,
      message: `Created a ${daysPerWeek}-day weekly plan (~${hoursPerDay}h/session) optimized for muscle recovery.`,
      days: structuredDays
    };
  }

  static handleTodaysPlan() {
    const { data } = VaultManager.getActivePlan();
    const dayIndex = data.current_day_index;
    const daysPerWeek = data.days_per_week;

    const planRaw = fs.readFileSync(VaultManager.getFullPath('Plans/Active-Weekly-Plan.md'), 'utf8');
    const dayRegex = new RegExp(`## Day ${dayIndex}:[\\s\\S]*?(?=## Day|$)`);
    const match = planRaw.match(dayRegex);
    if (!match) throw new Error(`Day ${dayIndex} not found in active plan.`);

    const exerciseMatches = [...match[0].matchAll(/\[\[(.*?)\]\]/g)].map(m => m[1]);
    
    const exercisesForLog = exerciseMatches.map(exName => {
      const exPath = VaultManager.getFullPath(path.join('Exercises', `${exName}.md`));
      let lastWeight = null;
      let equipment = 'Unknown Equipment';
      if (fs.existsSync(exPath)) {
        const raw = fs.readFileSync(exPath, 'utf8');
        const parsed = matter(raw);
        lastWeight = parsed.data.last_weight;
        equipment = parsed.data.equipment?.replace(/\[\[|\]\]/g, '') || 'Machine';
      }
      return { equipment, exercise: exName, lastWeight };
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const logFileName = VaultManager.createWorkoutLog(dateStr, dayIndex, exercisesForLog);
    if (!logFileName) throw new Error('Failed to create workout log file.');

    const nextIndex = (dayIndex % daysPerWeek) + 1;
    VaultManager.updatePlanIndex(nextIndex, data.total_sessions_completed + 1);

    return { dayIndex, logFileName, exercises: exercisesForLog };
  }

  static getLastExerciseWeight(exerciseName: string): number | null {
    const exPath = VaultManager.getFullPath(path.join('Exercises', `${exerciseName}.md`));
    if (!fs.existsSync(exPath)) return null;
    const parsed = matter(fs.readFileSync(exPath, 'utf8'));
    return typeof parsed.data.last_weight === 'number' ? parsed.data.last_weight : null;
  }

  static handleReport(logFileName: string, exerciseNumber: number, weight: number, exerciseName: string) {
    const dateStr = new Date().toISOString().split('T')[0];
    VaultManager.updateLogEntry(logFileName, exerciseNumber, weight);
    VaultManager.updateExerciseWeight(exerciseName, weight, dateStr, logFileName);

    return {
      success: true,
      message: `✅ Logged **${weight} kg** for **${exerciseName}**.`
    };
  }

  static handleGetLogHistory(startDate: string, endDate: string) {
    const logs = VaultManager.getLogsInRange(startDate, endDate);
    if (logs.length === 0) return { message: 'No workout logs found in this date range.' };

    let reportOutput = `📅 **Training Log: ${startDate} to ${endDate}**\n\n`;
    for (const log of logs) {
      reportOutput += `🗓️ **${log.data.date} (Day ${log.data.plan_day_index})**\n`;
      reportOutput += `${log.content}\n\n`;
    }

    return { success: true, report: reportOutput };
  }

  private static collectVaultMarkdown(dir: string): string {
    if (!fs.existsSync(dir)) return '';
    let combined = '';
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        combined += this.collectVaultMarkdown(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const text = fs.readFileSync(fullPath, 'utf8');
        combined += `\n--- File: ${entry.name} ---\n${text}\n`;
      }
    }
    return combined;
  }

  static async handleAskVault(question: string): Promise<string> {
    const vaultContext = this.collectVaultMarkdown(VaultManager.getFullPath(''));
    if (!vaultContext.trim()) {
      return 'Your Fitness Bot vault directory is currently empty.';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        `You are a concise personal fitness assistant. Answer the user's question based ONLY on their Obsidian Fitness Vault notes below.\n\n${vaultContext}\n\nUser Question: ${question}`
      ]
    });

    return response.text || 'No relevant information found in your fitness notes.';
  }
}
```

### 3. `src/botService.ts`
Configures Telegraf Long Polling, security middleware, `/help`, interactive `/plan` day selector (1–7 days), interactive workout logging buttons, photo vision pipeline, and AI query routing:
```typescript
import { Telegraf, Markup } from 'telegraf';
import { BotController } from './botController.js';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const ALLOWED_USER_ID = Number(process.env.ALLOWED_USER_ID || 0);

interface PendingWeightEntry {
  logFileName: string;
  exerciseNumber: number;
  exerciseName: string;
}

const pendingLogs = new Map<number, PendingWeightEntry>();

// Security middleware: block unauthorized Telegram users
bot.use(async (ctx, next) => {
  if (ALLOWED_USER_ID && ctx.from?.id !== ALLOWED_USER_ID) {
    return;
  }
  return next();
});

// 0. Help Command (/help)
bot.command('help', async (ctx) => {
  const helpMessage = `🤖 **Fitness Bot — Commands & Actions**

• **Load Today's Workout** — Loads today's scheduled exercises and opens interactive buttons to log weights.
  Example: \`/today\`

• **Create Weekly Plan** — Choose 1–7 training days/week (~1h/session) to generate a muscle-recovery split with YouTube tutorial links.
  Example: \`/plan\`

• **View Workout History** — Displays all logged workouts from the last 30 days.
  Example: \`/history\`

• **Add Gym Equipment (Photo)** — Send a photo of any gym machine to identify it and auto-generate exercise notes & video links.
  Example: *[Attach & send a photo of a gym machine]*

• **Log Exercise Weight** — Tap an exercise button from \`/today\`, then reply with your weight in kg (or tap *Repeat Last*).
  Example: \`22.5\`

• **Ask Your Fitness Vault (AI)** — Send any free-text question to query your workout history, weights, and routines.
  Example: \`What was my last weight on Cable Chest Fly?\`

• **Show Help** — Displays this command reference guide.
  Example: \`/help\``;

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// 1. Plan Creation Command (/plan) — Interactive day-count selection (1 to 7 days/week)
bot.command('plan', async (ctx) => {
  const dayButtons = [1, 2, 3, 4, 5, 6, 7].map(days =>
    Markup.button.callback(`${days} ${days === 1 ? 'Day' : 'Days'}`, `create_plan|${days}`)
  );

  await ctx.reply(
    `📅 **Create Weekly Workout Plan**\nHow many days per week do you want to train? (~1 hour per session):`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(dayButtons, { columns: 4 })
    }
  );
});

// 1b. Handle Plan Day-Count Selection
bot.action(/^create_plan\|([1-7])$/, async (ctx) => {
  const daysPerWeek = parseInt(ctx.match[1], 10);
  await ctx.answerCbQuery(`Building ${daysPerWeek}-day plan...`);
  await ctx.sendChatAction('typing');

  try {
    const result = await BotController.handleCreateWeeklyPlan(daysPerWeek, 1);

    let output = `📅 **${daysPerWeek}-Day Weekly Workout Plan (~1h / session)**\n_Muscles distributed for maximum recovery between sessions._\n\n`;
    for (const day of result.days) {
      output += `*Day ${day.day}: ${day.title}*\n`;
      day.exercises.forEach((ex, idx) => {
        output += `${idx + 1}. [${ex.name}](${ex.youtubeUrl}) _(${ex.muscles.join(', ')})_\n`;
      });
      output += `\n`;
    }

    if (output.length <= 4000) {
      await ctx.reply(output, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true }
      });
    } else {
      await ctx.reply(
        `📅 **${daysPerWeek}-Day Weekly Workout Plan (~1h / session)**\n_Muscles distributed for maximum recovery between sessions._`,
        { parse_mode: 'Markdown' }
      );
      for (const day of result.days) {
        let dayMsg = `*Day ${day.day}: ${day.title}*\n`;
        day.exercises.forEach((ex, idx) => {
          dayMsg += `${idx + 1}. [${ex.name}](${ex.youtubeUrl}) _(${ex.muscles.join(', ')})_\n`;
        });
        await ctx.reply(dayMsg, {
          parse_mode: 'Markdown',
          link_preview_options: { is_disabled: true }
        });
      }
    }
  } catch (error: any) {
    await ctx.reply(`❌ Error creating plan: ${error.message}`);
  }
});

// 2. Today's Workout Command (/today)
bot.command('today', async (ctx) => {
  try {
    const session = BotController.handleTodaysPlan();

    const buttons = session.exercises.map((ex, idx) =>
      Markup.button.callback(
        `[${idx + 1}] ${ex.exercise} (Last: ${ex.lastWeight ?? 'N/A'}kg)`,
        `log|${session.logFileName}|${idx + 1}|${ex.exercise}`
      )
    );

    await ctx.reply(
      `📋 **Day ${session.dayIndex} Workout**\nSelect an exercise to log your weight:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons, { columns: 1 })
      }
    );
  } catch (error: any) {
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

// 3. Tap an Exercise Button
bot.action(/^log\|([^|]+)\|(\d+)\|(.+)$/, async (ctx) => {
  const [, logFileName, indexStr, exerciseName] = ctx.match;
  const exerciseNumber = parseInt(indexStr, 10);

  if (ctx.from?.id) {
    pendingLogs.set(ctx.from.id, { logFileName, exerciseNumber, exerciseName });
  }

  await ctx.reply(
    `Selected **${exerciseName}**. Reply with the weight in kg (e.g., \`17.5\`), or click below:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Repeat Last', `repeat|${logFileName}|${exerciseNumber}|${exerciseName}`)],
        [Markup.button.callback('Cancel', 'cancel')]
      ])
    }
  );
  await ctx.answerCbQuery();
});

// 4. Repeat Last Weight Action
bot.action(/^repeat\|([^|]+)\|(\d+)\|(.+)$/, async (ctx) => {
  const [, logFileName, indexStr, exerciseName] = ctx.match;
  const exerciseNumber = parseInt(indexStr, 10);
  const lastWeight = BotController.getLastExerciseWeight(exerciseName);

  if (lastWeight === null) {
    await ctx.reply(`⚠️ No previous weight recorded for **${exerciseName}**. Please type the weight in kg.`, {
      parse_mode: 'Markdown'
    });
    await ctx.answerCbQuery();
    return;
  }

  const result = BotController.handleReport(logFileName, exerciseNumber, lastWeight, exerciseName);
  if (ctx.from?.id) pendingLogs.delete(ctx.from.id);

  await ctx.reply(result.message, { parse_mode: 'Markdown' });
  await ctx.answerCbQuery();
});

// 5. Cancel Action
bot.action('cancel', async (ctx) => {
  if (ctx.from?.id) pendingLogs.delete(ctx.from.id);
  await ctx.reply('Cancelled weight entry.');
  await ctx.answerCbQuery();
});

// 6. History Command (/history)
bot.command('history', async (ctx) => {
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = BotController.handleGetLogHistory(lastMonth, today);
  await ctx.reply(result.report || result.message || 'No workout logs found.', { parse_mode: 'Markdown' });
});

// 7. Photo Handler: Analyzes gym equipment photos via Gemini Vision (gemini-3.5-flash-lite)
bot.on('photo', async (ctx) => {
  await ctx.sendChatAction('typing');
  try {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);

    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const tempImagePath = path.join(tempDir, `equip_${Date.now()}.jpg`);
    fs.writeFileSync(tempImagePath, buffer);

    const imagePart = {
      inlineData: { data: buffer.toString('base64'), mimeType: 'image/jpeg' }
    };

    const prompt = `Analyze this gym equipment photo. For each exercise, identify the most viewed tutorial video from top search results on YouTube and provide its direct watch URL (e.g. https://www.youtube.com/watch?v=...). Return ONLY a valid JSON object (no markdown formatting blocks, no extra text) with the following structure:
{
  "machineName": "Exact Name of Machine",
  "category": "Strength / Cardio / Cable / etc.",
  "exercises": [
    {
      "name": "Exercise Name",
      "muscles": ["Primary Muscle", "Secondary Muscle"],
      "instructions": "Brief 1-2 sentence execution instructions on how to perform the exercise correctly.",
      "youtubeUrl": "https://www.youtube.com/watch?v=..."
    }
  ]
}`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [imagePart, prompt]
    });

    const rawText = aiResponse.text?.trim() || '{}';
    const sanitized = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = sanitized.indexOf('{');
    const lastBrace = sanitized.lastIndexOf('}');
    const jsonClean = sanitized.substring(firstBrace, lastBrace + 1);

    const equipmentData = JSON.parse(jsonClean);
    if (!equipmentData.machineName || !equipmentData.exercises) {
      throw new Error('Could not parse equipment details from image JSON.');
    }

    const finalImageName = `${equipmentData.machineName.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
    const finalImagePath = path.join(tempDir, finalImageName);
    fs.renameSync(tempImagePath, finalImagePath);

    const res = await BotController.handleGenerateExercises(
      finalImagePath,
      equipmentData.machineName,
      equipmentData.category || 'Strength',
      equipmentData.exercises
    );

    if (fs.existsSync(finalImagePath)) fs.unlinkSync(finalImagePath);
    await ctx.reply(res.message, { parse_mode: 'Markdown' });
  } catch (error: any) {
    await ctx.reply(`❌ Failed to process equipment photo: ${error.message}`);
  }
});

// 8. Text Handler
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();

  if (pendingLogs.has(userId)) {
    const weight = parseFloat(text);
    if (isNaN(weight) || weight <= 0) {
      await ctx.reply('Please enter a valid positive number in kg (e.g., `20` or `17.5`), or click Cancel.', {
        parse_mode: 'Markdown'
      });
      return;
    }

    const entry = pendingLogs.get(userId)!;
    const result = BotController.handleReport(entry.logFileName, entry.exerciseNumber, weight, entry.exerciseName);
    pendingLogs.delete(userId);

    await ctx.reply(result.message, { parse_mode: 'Markdown' });
    return;
  }

  await ctx.sendChatAction('typing');
  try {
    const answer = await BotController.handleAskVault(text);
    await ctx.reply(answer);
  } catch (error: any) {
    await ctx.reply(`❌ AI Query Error: ${error.message}`);
  }
});

export function startTelegramBot() {
  bot.telegram.setMyCommands([
    { command: 'today', description: "Load today's workout and log weights" },
    { command: 'plan', description: 'Create a custom weekly workout plan (1–7 days)' },
    { command: 'history', description: 'View workout logs from the last 30 days' },
    { command: 'help', description: 'Show available bot commands and examples' }
  ]).catch(err => console.error('[ERROR Service] Failed to set bot commands menu:', err));

  bot.launch();
  console.log('🤖 Fitness Bot Telegram layer active (Local Polling Mode).');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
```

### 4. `src/seed.ts`
Initializes sample vault data and plans if your folder is empty:
```typescript
import { BotController } from './botController.js';
import { VaultManager } from './vaultManager.js';

async function seedVault() {
  console.log('🌱 Initializing vault directories...');
  VaultManager.ensureDirectories();

  console.log('🏋️‍♂️ Registering sample equipment...');
  await BotController.handleGenerateExercises(
    'sample-cable-machine.jpg',
    'Cable Crossover Machine',
    'Strength / Cable',
    [
      { name: 'Cable Chest Fly', muscles: ['Chest', 'Anterior Deltoids'] },
      { name: 'Triceps Pushdown', muscles: ['Triceps'] },
      { name: 'Face Pull', muscles: ['Rear Deltoids', 'Upper Back'] }
    ]
  );

  console.log('📅 Creating active weekly workout plan...');
  const result = await BotController.handleCreateWeeklyPlan(3, 1);
  console.log(result.message);
  console.log('✅ Vault seeding completed successfully!');
}

seedVault().catch(console.error);
```

### 5. `src/index.ts`
Main entry point:
```typescript
import { startTelegramBot } from './botService.js';
import { VaultManager } from './vaultManager.js';

async function main() {
  console.log('🚀 Initializing Fitness Bot Vault Connections...');
  VaultManager.ensureDirectories();
  startTelegramBot();
}

main().catch(console.error);
```

---

## Part 4: Building and Running Locally

1. **Compile TypeScript:**
   ```powershell
   npm run build
   ```
2. **Seed Initial Vault Data (Optional if notes already exist):**
   ```powershell
   npm run seed
   ```
3. **Start the Bot:**
   ```powershell
   npm start
   ```

## Part 5: Keeping It Running via PM2 (Background Service)
To run your bot persistently in the background on Windows:
```powershell
npm install -g pm2
pm2 start dist/index.js --name the-fitness-bot
pm2 save
```
*(Optional)* Add `pm2 resurrect` to a `.bat` script in your Windows Startup folder (`shell:startup`) to launch it automatically on boot.