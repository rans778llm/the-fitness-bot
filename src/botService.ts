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
    console.log(`[DEBUG Security] Blocked unauthorized user ID: ${ctx.from?.id}`);
    return;
  }
  return next();
});

// 0. Help Command (/help)
bot.command('help', async (ctx) => {
  console.log(`[DEBUG Service] Received /help command from user ${ctx.from?.id}`);
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
  console.log(`[DEBUG Service] Received /plan command from user ${ctx.from?.id}`);
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
  console.log(`[DEBUG Service] Generating ${daysPerWeek}-day weekly plan for user ${ctx.from?.id}`);

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

    // Telegram message limit is 4096 chars; split cleanly if needed
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
    console.error(`[ERROR Service] create_plan error:`, error);
    await ctx.reply(`❌ Error creating plan: ${error.message}`);
  }
});

// 2. Today's Workout Command (/today)
bot.command('today', async (ctx) => {
  console.log(`[DEBUG Service] Received /today command from user ${ctx.from?.id}`);
  try {
    const session = BotController.handleTodaysPlan();

    const buttons = session.exercises.map((ex, idx) =>
      Markup.button.callback(
        `[${idx + 1}] ${ex.exercise} (Last: ${ex.lastWeight ?? 'N/A'}kg)`,
        `log|${session.logFileName}|${idx + 1}|${ex.exercise}`
      )
    );

    // Send a message to the user with an inline keyboard containing exercise buttons for logging weight
    await ctx.reply(
      `📋 **Day ${session.dayIndex} Workout**\nSelect an exercise to log your weight:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons, { columns: 1 })
      }
    );
  } catch (error: any) {
    // Log the error and notify the user if something goes wrong
    console.error(`[ERROR Service] /today error:`, error);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

// 3. Tap an Exercise Button
bot.action(/^log\|([^|]+)\|(\d+)\|(.+)$/, async (ctx) => {
  const [, logFileName, indexStr, exerciseName] = ctx.match;
  const exerciseNumber = parseInt(indexStr, 10);
  console.log(`[DEBUG Service] Exercise button clicked: ${exerciseName} (#${exerciseNumber})`);

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
  console.log(`[DEBUG Service] Received /history command`);
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = BotController.handleGetLogHistory(lastMonth, today);
  await ctx.reply(result.report || result.message || 'No workout logs found.', { parse_mode: 'Markdown' });
});

// 7. Photo Handler: Analyzes gym equipment photos via Gemini Vision (gemini-3.5-flash-lite)
bot.on('photo', async (ctx) => {
  console.log(`[DEBUG Service] 📸 PHOTO EVENT RECEIVED from user ID: ${ctx.from?.id}`);
  await ctx.sendChatAction('typing');
  try {
    const photos = ctx.message.photo;
    console.log(`[DEBUG Service] Number of photo sizes received: ${photos.length}`);
    const largestPhoto = photos[photos.length - 1];
    const fileId = largestPhoto.file_id;
    console.log(`[DEBUG Service] Selected largest photo fileId: ${fileId}`);

    const fileLink = await ctx.telegram.getFileLink(fileId);
    console.log(`[DEBUG Service] Telegram file download URL: ${fileLink.href}`);

    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    console.log(`[DEBUG Service] Image downloaded successfully. Buffer length: ${buffer.length} bytes`);

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
      console.log(`[DEBUG Service] Created temp directory at ${tempDir}`);
    }
    const tempImagePath = path.join(tempDir, `equip_${Date.now()}.jpg`);
    fs.writeFileSync(tempImagePath, buffer);
    console.log(`[DEBUG Service] Temp image saved locally to ${tempImagePath}`);

    const imagePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: 'image/jpeg'
      }
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

    console.log(`[DEBUG Service] Sending image to Gemini Vision (gemini-3.5-flash-lite)...`);
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [imagePart, prompt]
    });

    const rawText = aiResponse.text?.trim() || '{}';
    console.log(`[DEBUG Service] Raw Gemini Vision response:`, rawText);

    const sanitized = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = sanitized.indexOf('{');
    const lastBrace = sanitized.lastIndexOf('}');
    const jsonClean = sanitized.substring(firstBrace, lastBrace + 1);

    const equipmentData = JSON.parse(jsonClean);
    console.log(`[DEBUG Service] Parsed equipment JSON:`, equipmentData);

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
    console.log(`[DEBUG Service] Photo processing successfully finished.`);

    await ctx.reply(res.message, { parse_mode: 'Markdown' });
  } catch (error: any) {
    console.error(`[ERROR Service] Failed to process equipment photo:`, error);
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
  console.log('🤖 Fitness Bot Telegram layer active (Local Polling Mode with Debug Logging).');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
