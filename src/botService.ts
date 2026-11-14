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

// 1. Today's Workout Command (/today)
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

    await ctx.reply(
      `📋 **Day ${session.dayIndex} Workout**\nSelect an exercise to log your weight:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons, { columns: 1 })
      }
    );
  } catch (error: any) {
    console.error(`[ERROR Service] /today error:`, error);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

// 2. Tap an Exercise Button
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
  console.log(`[DEBUG Service] Received /history command`);
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = BotController.handleGetLogHistory(lastMonth, today);
  await ctx.reply(result.report || result.message || 'No workout logs found.', { parse_mode: 'Markdown' });
});

// 6. Photo Handler: Analyzes gym equipment photos via Gemini Vision (gemini-3.5-flash-lite)
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

// 7. Text Handler
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
  console.log('🤖 Fitness Bot Telegram layer active (Local Polling Mode with Debug Logging).');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}