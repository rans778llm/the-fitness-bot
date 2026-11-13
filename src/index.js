"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const botController_1 = require("./botController");
const vaultManager_1 = require("./vaultManager");
const path_1 = __importDefault(require("path"));
async function runDemo() {
    console.log('🚀 Initializing Fitness Bot Vault Connections...');
    vaultManager_1.VaultManager.ensureDirectories();
    // 1. Simulate Equipment Photo Upload & Exercise Generation
    const sampleImage = path_1.default.join(__dirname, '../sample-cable-machine.jpg');
    // (Assuming dummy image exists or test path)
    /*
    await BotController.handleGenerateExercises(
      sampleImage,
      'Cable Crossover Machine',
      'Strength / Cable',
      [
        { name: 'Cable Chest Fly', muscles: ['Chest', 'Front Deltoids'] },
        { name: 'Tricep Rope Pushdown', muscles: ['Triceps'] }
      ]
    );
    console.log('✅ generateExercises executed.');
    */
    // 2. Simulate Creating Weekly Plan
    botController_1.BotController.handleCreateWeeklyPlan(3, 1.0);
    console.log('✅ createWeeklyPlan executed.');
    // 3. Simulate Retrieving Today's Plan
    const todaysSession = botController_1.BotController.handleTodaysPlan();
    console.log('📋 todaysPlan executed:', todaysSession);
    // 4. Simulate Reporting a Weight Log
    if (todaysSession.exercises.length > 0) {
        const firstEx = todaysSession.exercises[0];
        botController_1.BotController.handleReport(todaysSession.logFileName, 1, 15.0, firstEx.exercise);
        console.log('✅ report executed.');
    }
    // 5. Simulate Fetching Historical Logs
    const history = botController_1.BotController.handleGetLogHistory('2026-01-01', '2026-12-31');
    console.log('📅 log history retrieved:', history);
}
runDemo().catch(console.error);
//# sourceMappingURL=index.js.map