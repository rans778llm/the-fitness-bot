import { BotController } from './botController.js';
import { VaultManager } from './vaultManager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runDemo() {
  console.log('🚀 Initializing Fitness Bot Vault Connections...');
  VaultManager.ensureDirectories();

  // 0. Create a dummy sample image file for testing attachment copying
  const sampleImgPath = path.join(__dirname, '../sample-cable-machine.jpg');
  if (!fs.existsSync(sampleImgPath)) {
    fs.writeFileSync(sampleImgPath, 'dummy image binary content');
  }

  // 1. Seed equipment and exercises so the weekly plan has items to schedule
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

  // 2. Simulate Creating Weekly Plan
  BotController.handleCreateWeeklyPlan(3, 1.0);
  console.log('✅ createWeeklyPlan executed.');

  // 3. Simulate Retrieving Today's Plan & Generating Workout Log
  const todaysSession = BotController.handleTodaysPlan();
  console.log('📋 todaysPlan executed:', JSON.stringify(todaysSession, null, 2));

  // 4. Simulate Reporting a Weight Log for the first exercise
  if (todaysSession.exercises.length > 0) {
    const firstEx = todaysSession.exercises[0];
    if (firstEx) {
      BotController.handleReport(todaysSession.logFileName, 1, 15.0, firstEx.exercise);
      console.log('✅ report executed.');
    }
  }

  // 5. Simulate Fetching Historical Logs
  const history = BotController.handleGetLogHistory('2026-01-01', '2026-12-31');
  console.log('📅 log history retrieved:', history);
}

runDemo().catch(console.error);