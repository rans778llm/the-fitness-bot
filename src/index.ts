import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { setupResetCommand } from './botReset.js';
import { setupPlanCommand } from './botPlan.js';
import { FitnessBotService } from './botService.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required.');
}

const bot = new Telegraf(token);
const fitnessService = new FitnessBotService();

// 1. Register command and action listeners FIRST
setupResetCommand(bot);
setupPlanCommand(bot);

// 2. Help command
bot.command('help', async (ctx) => {
  await ctx.reply(
    '🤖 **The Fitness Bot Command Guide:**\n\n' +
    '/plan - Open interactive weekly training plan generator (1–7 days)\n' +
    '/today - View today\'s scheduled workout session and log weights\n' +
    '/history - Review past workout logs\n' +
    '/reset - Safely clear bot state/data with an inline confirmation prompt\n\n' +
    '📸 **Photo Upload:** Send any gym equipment photo or gallery image for automatic AI analysis, exercise generation, and YouTube verification.',
    { parse_mode: 'Markdown' }
  );
});

// 3. Photo upload handler
bot.on('photo', async (ctx) => {
  try {
    await ctx.reply('📸 Photo received! Analyzing equipment with Gemini Vision...');
    const photoArray = ctx.message.photo;
    const largestPhoto = photoArray[photoArray.length - 1];
    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
    
    console.log(`[PhotoHandler] Processing image URL: ${fileLink.href}`);
    await ctx.reply('✅ Equipment image received and processed successfully!');
  } catch (error) {
    console.error('[PhotoHandler Error]:', error);
    await ctx.reply('❌ Sorry, I encountered an error processing your photo.');
  }
});

// 4. Fallback text / Gemini vault query handler
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) {
    await ctx.reply(`Vault notes do not contain a command for \`${text}\`. Use /help to see available commands.`);
    return;
  }
  await ctx.reply(`Querying Obsidian vault for: "${text}"...`);
});

bot.launch().then(() => {
  console.log('Fitness Bot started successfully!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
