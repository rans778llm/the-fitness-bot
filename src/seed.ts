import { BotController } from './botController.js';
import { VaultManager } from './vaultManager.js';

async function seedVault() {
  console.log('🌱 Initializing vault directories...');
  VaultManager.ensureDirectories();

  // 1. Register sample equipment and generate exercises
  console.log('🏋️‍♂️ Registering sample equipment...');
  await BotController.handleGenerateExercises(
    'sample-cable-machine.jpg', // Ensure this file exists or update path if needed
    'Cable Crossover Machine',
    'Strength / Cable',
    [
      { name: 'Cable Chest Fly', muscles: ['Chest', 'Anterior Deltoids'] },
      { name: 'Triceps Pushdown', muscles: ['Triceps'] },
      { name: 'Face Pull', muscles: ['Rear Deltoids', 'Upper Back'] }
    ]
  );

  // 2. Create a 3-day weekly plan
  console.log('📅 Creating active weekly workout plan...');
  const result = await BotController.handleCreateWeeklyPlan(3, 1);
  console.log(result.message);
  console.log('✅ Vault seeding completed successfully!');
}

seedVault().catch(console.error);
