# Local Obsidian Fitness Telegram Bot — Complete Implementation Guide

This guide covers everything required to set up, code, configure, and run your personal local fitness Telegram bot on a Windows workstation. The bot communicates via **Telegraf Long Polling** (requiring no public web server or PaaS), interacts directly with your local Obsidian vault (`H:/My Drive/Rans-Vault`), and uses `gemini-3.5-flash-lite` for AI-powered natural language queries.

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
    "@google/genai": "^0.1.1",
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
import dotenv from 'dotenv';

dotenv.config();

const VAULT_ROOT = process.env.OBSIDIAN_VAULT_PATH || '';
const SUBDIR = process.env.FITNESS_BOT_SUBDIR || 'Self Projects/The Fitness Bot';
const BASE_PATH = path.join(VAULT_ROOT, SUBDIR);

export class VaultManager {
  static getFullPath(relativePath: string): string {
    return path.join(BASE_PATH, relativePath);
  }

  static ensureDirectories(): void {
    ['Attachments', 'Equipment', 'Exercises', 'Plans', 'Logs'].forEach(dir => {
      const dirPath = path.join(BASE_PATH, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  static saveEquipmentNote(name: string, category: string, imageFileName: string, exercises: string[]): void {
    this.ensureDirectories();
    const filePath = path.join(BASE_PATH, 'Equipment', `${name}.md`);

    const data = {
      type: 'equipment',
      name: name,
      category: category,
      image: `[[${imageFileName}]]`,
      date_added: new Date().toISOString().split('T')[0],
      exercises: exercises.map(ex => `[[${ex}]]`)
    };

    const exerciseListMarkdown = exercises.map(ex => `* [[${ex}]] — Target Muscles`).join('\n');
    const content = `# ${name}\n\n![[${imageFileName}]]\n\n## Supported Exercises\n${exerciseListMarkdown}\n`;

    const fileContent = matter.stringify(content, data);
    fs.writeFileSync(filePath, fileContent, 'utf8');
  }

  static saveExerciseNote(exerciseName: string, equipmentName: string, primaryMuscles: string[]): void {
    this.ensureDirectories();
    const filePath = path.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
    if (fs.existsSync(filePath)) return;

    const data = {
      type: 'exercise',
      name: exerciseName,
      equipment: `[[${equipmentName}]]`,
      primary_muscles: primaryMuscles,
      last_weight: null,
      weight_unit: 'kg',
      last_performed: null
    };

    const content = `# ${exerciseName}\n\n**Equipment:** [[${equipmentName}]]  \n**Target Muscles:** ${primaryMuscles.join(', ')}\n\n## Weight Progression Log\n| Date | Weight (kg) | Session Log |\n| :--- | :---: | :--- |\n`;

    const fileContent = matter.stringify(content, data);
    fs.writeFileSync(filePath, fileContent, 'utf8');
  }

  static updateExerciseWeight(exerciseName: string, weight: number, dateStr: string, logFileName: string): void {
    const filePath = path.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
    if (!fs.existsSync(filePath)) return;

    const fileRaw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(fileRaw);

    parsed.data.last_weight = weight;
    parsed.data.last_performed = dateStr;

    const newRow = `| ${dateStr} | ${weight} | [[${logFileName}]] |`;
    const updatedContent = parsed.content.trim() + `\n${newRow}\n`;

    fs.writeFileSync(filePath, matter.stringify(updatedContent, parsed.data), 'utf8');
  }

  static saveWeeklyPlan(daysPerWeek: number, hoursPerDay: number, planMarkdown: string): void {
    this.ensureDirectories();
    const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
    const data = {
      type: 'weekly_plan',
      status: 'active',
      created_at: new Date().toISOString().split('T')[0],
      days_per_week: daysPerWeek,
      hours_per_day: hoursPerDay,
      current_day_index: 1,
      total_sessions_completed: 0
    };

    const fileContent = matter.stringify(`\n# Active Weekly Workout Plan\n\n${planMarkdown}`, data);
    fs.writeFileSync(filePath, fileContent, 'utf8');
  }

  static getActivePlan(): { data: any; content: string } {
    const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
    if (!fs.existsSync(filePath)) throw new Error('No active weekly plan found.');
    const fileRaw = fs.readFileSync(filePath, 'utf8');
    return matter(fileRaw);
  }

  static updatePlanIndex(newIndex: number, sessionsCompleted: number): void {
    const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
    const { data, content } = this.getActivePlan();
    data.current_day_index = newIndex;
    data.total_sessions_completed = sessionsCompleted;
    fs.writeFileSync(filePath, matter.stringify(content, data), 'utf8');
  }

  static createWorkoutLog(dateStr: string, dayIndex: number, exercises: { equipment: string; exercise: string; lastWeight: any }[]): string {
    this.ensureDirectories();
    const logFileName = `${dateStr}-Workout-Log`;
    const filePath = path.join(BASE_PATH, 'Logs', `${logFileName}.md`);

    const data = {
      type: 'workout_log',
      date: dateStr,
      plan_ref: '[[Active-Weekly-Plan]]',
      plan_day_index: dayIndex,
      status: 'in_progress'
    };

    let tableRows = exercises.map((ex, idx) => 
      `| ${idx + 1} | [[${ex.equipment}]] | [[${ex.exercise}]] | ${ex.lastWeight !== null ? ex.lastWeight + ' kg' : 'N/A'} | — | ⏳ Pending |`
    ).join('\n');

    const content = `# Workout Log — ${dateStr} (Day ${dayIndex})\n\n| # | Equipment | Exercise | Target Weight | Logged Weight | Status |\n| :-: | :--- | :--- | :---: | :---: | :---: |\n${tableRows}\n`;

    fs.writeFileSync(filePath, matter.stringify(content, data), 'utf8');
    return logFileName;
  }

  static updateLogEntry(logFileName: string, exerciseNumber: number, loggedWeight: number): void {
    const filePath = path.join(BASE_PATH, 'Logs', `${logFileName}.md`);
    if (!fs.existsSync(filePath)) throw new Error(`Log file ${logFileName} not found.`);

    const fileRaw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(fileRaw);

    const lines = parsed.content.split('\n');
    const updatedLines = lines.map(line => {
      if (line.startsWith(`| ${exerciseNumber} |`)) {
        const parts = line.split('|').map(p => p.trim());
        parts[5] = `${loggedWeight} kg`;
        parts[6] = '✅ Completed';
        return `| ${parts.slice(1, -1).join(' | ')} |`;
      }
      return line;
    });

    fs.writeFileSync(filePath, matter.stringify(updatedLines.join('\n'), parsed.data), 'utf8');
  }

  static getLogsInRange(startDate: string, endDate: string): { fileName: string; content: string; data: any }[] {
    const logsDir = path.join(BASE_PATH, 'Logs');
    if (!fs.existsSync(logsDir)) return [];

    const files = fs.readdirSync(logsDir);
    const results = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(logsDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = matter(raw);
      const logDate = parsed.data.date;

      if (logDate && logDate >= startDate && logDate <= endDate) {
        results.push({ fileName: file.replace('.md', ''), content: parsed.content, data: parsed.data });
      }
    }

    return results.sort((a, b) => a.data.date.localeCompare(b.data.date));
  }
}
```

### 2. `src/botController.ts`
Manages workout business logic and interfaces with `gemini-3.5-flash-lite` for vault queries:
```typescript
import { VaultManager } from './vaultManager.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export class BotController {
  
  static async handleGenerateExercises(imagePath: string, machineName: string, category: string, exercisesList: { name: string; muscles: string[] }[]) {
    const fileName = path.basename(imagePath);
    const targetAttachmentPath = VaultManager.getFullPath(path.join('Attachments', fileName));
    
    fs.copyFileSync(imagePath, targetAttachmentPath);

    const exerciseNames = exercisesList.map(e => e.name);
    VaultManager.saveEquipmentNote(machineName, category, fileName, exerciseNames);

    for (const ex of exercisesList) {
      VaultManager.saveExerciseNote(ex.name, machineName, ex.muscles);
    }

    return {
      success: true,
      message: `Successfully registered machine **${machineName}** and generated ${exercisesList.length} exercises.`
    };
  }

  static handleCreateWeeklyPlan(daysPerWeek: number, hoursPerDay: number) {
    const exercisesDir = VaultManager.getFullPath('Exercises');
    if (!fs.existsSync(exercisesDir)) throw new Error('No exercises found in vault. Add equipment first.');
    
    const exerciseFiles = fs.readdirSync(exercisesDir).filter(f => f.endsWith('.md'));
    
    let planMarkdown = '';
    const exercisesPerDay = Math.ceil(exerciseFiles.length / daysPerWeek);

    for (let d = 1; d <= daysPerWeek; d++) {
      const dayExercises = exerciseFiles.slice((d - 1) * exercisesPerDay, d * exercisesPerDay);
      planMarkdown += `## Day ${d}: Session ${d}\n`;
      dayExercises.forEach((file, idx) => {
        const exName = file.replace('.md', '');
        planMarkdown += `${idx + 1}. [[${exName}]] — *Last Weight: Check Exercise Note*\n`;
      });
      planMarkdown += `\n`;
    }

    VaultManager.saveWeeklyPlan(daysPerWeek, hoursPerDay, planMarkdown);
    return { success: true, message: `Created a ${daysPerWeek}-day weekly plan (${hoursPerDay}h/day).` };
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

    return {
      dayIndex,
      logFileName,
      exercises: exercisesForLog
    };
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
Configures Telegraf Long Polling, security middleware, interactive button handlers, and AI query routing:
```typescript
import { Telegraf, Markup } from 'telegraf';
import { BotController } from './botController.js';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
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

// 1. Today's Workout Command (/today)
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

// 2. Tap an Exercise Button
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

// 3. Repeat Last Weight Action
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

// 4. Cancel Action
bot.action('cancel', async (ctx) => {
  if (ctx.from?.id) pendingLogs.delete(ctx.from.id);
  await ctx.reply('Cancelled weight entry.');
  await ctx.answerCbQuery();
});

// 5. History Command (/history)
bot.command('history', async (ctx) => {
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = BotController.handleGetLogHistory(lastMonth, today);
  await ctx.reply(result.report || result.message || 'No workout logs found.', { parse_mode: 'Markdown' });
});

// 6. Text Handler: Logs pending weight OR queries Obsidian Vault via Gemini 3.5 Flash-Lite
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
      { name: 'Triceps Rope Pushdown', muscles: ['Triceps'] },
      { name: 'Face Pull', muscles: ['Rear Deltoids', 'Upper Back'] }
    ]
  );

  console.log('📅 Creating active weekly workout plan...');
  const result = BotController.handleCreateWeeklyPlan(3, 1);
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