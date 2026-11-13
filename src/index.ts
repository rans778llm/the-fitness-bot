import { startTelegramBot } from './botService.js';
import { VaultManager } from './vaultManager.js';

async function main() {
  console.log('🚀 Initializing Fitness Bot Vault Connections...');
  VaultManager.ensureDirectories();

  // Launch the Telegram bot listener layer
  startTelegramBot();
}

main().catch(console.error);