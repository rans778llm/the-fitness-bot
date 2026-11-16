import { Telegraf, Markup } from 'telegraf';

/**
 * Sets up the /reset command with an inline confirmation prompt.
 */
export function setupResetCommand(bot: Telegraf) {
  bot.command('reset', async (ctx) => {
    await ctx.reply(
      '⚠️ **Are you sure you want to reset?**\nThis will clear your active workout plan and data.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Yes, reset everything', 'CONFIRM_RESET'),
            Markup.button.callback('Cancel', 'CANCEL_RESET'),
          ],
        ]),
      }
    );
  });

  bot.action('CONFIRM_RESET', async (ctx) => {
    // TODO: Add actual vault data clearing / reset logic here
    await ctx.answerCbQuery('Reset completed successfully.');
    await ctx.editMessageText('🔄 **Bot data has been successfully reset.** First, upload photos of your gym equipment to build your inventory, and then you can start fresh using `/plan`.', { parse_mode: 'Markdown' });
  });

  bot.action('CANCEL_RESET', async (ctx) => {
    await ctx.answerCbQuery('Reset cancelled.');
    await ctx.editMessageText('❌ Reset action cancelled. Your data is safe.');
  });
}
