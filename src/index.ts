import { startTelegramBot } from './botService.js';
import { VaultManager } from './vaultManager.js';

async function main() {
  console.log('🚀 Initializing Fitness Bot Vault Connections...');
  VaultManager.ensureDirectories();

  // Start the persistent Telegram bot polling listener
  startTelegramBot();
}

main().catch(console.error);