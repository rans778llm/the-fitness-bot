import { Telegraf, Markup } from 'telegraf';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper to split long messages into Telegram-safe chunks (max 4000 chars per message).
 */
async function sendLongMessage(ctx: any, text: string) {
  const MAX_LENGTH = 3800;
  if (text.length <= MAX_LENGTH) {
    await ctx.reply(text);
    return;
  }

  const chunks = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    let endIndex = startIndex + MAX_LENGTH;
    if (endIndex < text.length) {
      // Try to break at a newline to avoid splitting words/links awkwardly
      const lastNewline = text.lastIndexOf('\n', endIndex);
      if (lastNewline > startIndex) {
        endIndex = lastNewline + 1;
      }
    }
    chunks.push(text.slice(startIndex, endIndex));
    startIndex = endIndex;
  }

  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

/**
 * Sets up the /plan command and interactive day selection workflow.
 */
export function setupPlanCommand(bot: Telegraf) {
  // Triggered when user types /plan
  bot.command('plan', async (ctx) => {
    await ctx.reply(
      '🏋️‍♂️ **Weekly Workout Plan Generator**\nHow many days per week would you like to train?',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('1 Day', 'PLAN_DAYS_1'),
            Markup.button.callback('2 Days', 'PLAN_DAYS_2'),
            Markup.button.callback('3 Days', 'PLAN_DAYS_3'),
          ],
          [
            Markup.button.callback('4 Days', 'PLAN_DAYS_4'),
            Markup.button.callback('5 Days', 'PLAN_DAYS_5'),
            Markup.button.callback('6 Days', 'PLAN_DAYS_6'),
          ],
          [
            Markup.button.callback('7 Days', 'PLAN_DAYS_7'),
          ],
        ]),
      }
    );
  });

  // Handle day selection callbacks (PLAN_DAYS_1 through PLAN_DAYS_7)
  bot.action(/^PLAN_DAYS_([1-7])$/, async (ctx) => {
    const days = ctx.match[1];
    await ctx.answerCbQuery(`Generating ${days}-day custom workout plan...`);
    await ctx.editMessageText(`⏳ Generating your optimized **${days}-day weekly workout plan** using Gemini AI and your equipment inventory...`, { parse_mode: 'Markdown' });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: `Create a structured ${days}-day weekly fitness workout plan (~1 hour per session) balancing muscle recovery and exercise variety. Format cleanly with exercise names and for each exercise, provide a direct watch link to the most popular, highest-view YouTube tutorial clip in the exact format https://www.youtube.com/watch?v=VIDEO_ID.`,
      });

      const planText = response.text || 'Failed to generate plan content.';
      
      await ctx.reply(`📅 Your Custom ${days}-Day Workout Plan:`);
      await sendLongMessage(ctx, planText);
    } catch (error: any) {
      console.error('[Plan Generation Error Details]:', error);
      const errorMsg = error?.message || 'Unknown error';
      await ctx.reply(`❌ Sorry, I encountered an error generating your workout plan: \`${errorMsg}\``, { parse_mode: 'Markdown' });
    }
  });
}
