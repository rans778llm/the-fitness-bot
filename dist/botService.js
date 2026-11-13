import { Telegraf, Markup } from 'telegraf';
import { BotController } from './botController.js';
import dotenv from 'dotenv';
dotenv.config();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
// 1. Today's Workout Command (/today)
bot.command('today', async (ctx) => {
    try {
        const session = BotController.handleTodaysPlan();
        // Map exercises into inline buttons for tap-first logging
        const buttons = session.exercises.map((ex, idx) => Markup.button.callback(`[${idx + 1}] ${ex.exercise} (Last: ${ex.lastWeight ?? 'N/A'}kg)`, `log_${session.logFileName}_${idx + 1}_${ex.exercise}`));
        await ctx.reply(`📋 **Day ${session.dayIndex} Workout**\nSelect an exercise to log your weight:`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons, { columns: 1 })
        });
    }
    catch (error) {
        await ctx.reply(`❌ Error: ${error.message}`);
    }
});
// 2. Handle Tap Interactions on Exercise Buttons
bot.action(/log_(.+)_(.+)_(.+)/, async (ctx) => {
    const [, logFileName, indexStr, exerciseName] = ctx.match;
    const exerciseNumber = parseInt(indexStr, 10);
    // For speed at the gym, default to repeating the last weight or show quick adjustment buttons
    // Here we can prompt or record an instant placeholder check-in
    await ctx.reply(`Selected **${exerciseName}**. Reply with the weight in kg (e.g., \`17.5\`), or click a quick modifier:`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Repeat Last', `save_${logFileName}_${exerciseNumber}_${exerciseName}_repeat`)],
            [Markup.button.callback('Cancel', 'cancel')]
        ])
    });
    await ctx.answerCbQuery();
});
// 3. History Command (/history)
bot.command('history', async (ctx) => {
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = BotController.handleGetLogHistory(lastMonth, today);
    await ctx.reply(result.report || result.message || 'No workout logs found.', { parse_mode: 'Markdown' });
});
export function startTelegramBot() {
    bot.launch();
    console.log('🤖 Fitness Bot Telegram layer active.');
}
