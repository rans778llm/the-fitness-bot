import { BotController } from './botController.js';
import { VaultManager } from './vaultManager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// Import your telegram bot instance (adjust the import path if your bot file is named differently, e.g., botService or similar)
// import { bot } from './botService.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startBot() {
  console.log('🚀 Initializing Fitness Bot Vault Connections...');
  VaultManager.ensureDirectories();

  // Ensure sample image exists if needed
  const sampleImgPath = path.join(__dirname, '../sample-cable-machine.jpg');
  if (!fs.existsSync(sampleImgPath)) {
    fs.writeFileSync(sampleImgPath, 'dummy image binary content');
  }

  // Optional: Seed equipment/exercises on startup if needed
  await BotController.handleGenerateExercises(
    sampleImgPath,
    'Cable Crossover Machine',
    'Strength / Cable',
    [
      { name: 'Cable Chest Fly', muscles: ['Chest', 'Front Deltoids'] },
      { name: 'Tricep Rope Pushdown', muscles: ['Triceps'] }
    ]
  );
  console.log('✅ Seeded equipment & exercises.');

  // TODO: Start your Telegraf / GrammY bot polling here, for example:
  // await bot.launch();
  // console.log('🤖 Telegram bot is live and polling!');
}

startBot().catch(console.error);