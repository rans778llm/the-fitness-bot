"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotController = void 0;
const vaultManager_1 = require("./vaultManager");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class BotController {
    // 1. generateExercises
    static async handleGenerateExercises(imagePath, machineName, category, exercisesList) {
        const fileName = path_1.default.basename(imagePath);
        const targetAttachmentPath = vaultManager_1.VaultManager.getFullPath(path_1.default.join('Attachments', fileName));
        // Copy image into Obsidian Attachments folder
        fs_1.default.copyFileSync(imagePath, targetAttachmentPath);
        const exerciseNames = exercisesList.map(e => e.name);
        vaultManager_1.VaultManager.saveEquipmentNote(machineName, category, fileName, exerciseNames);
        for (const ex of exercisesList) {
            vaultManager_1.VaultManager.saveExerciseNote(ex.name, machineName, ex.muscles);
        }
        return {
            success: true,
            message: `Successfully registered machine **${machineName}** and generated ${exercisesList.length} exercises.`
        };
    }
    // 2. createWeeklyPlan
    static handleCreateWeeklyPlan(daysPerWeek, hoursPerDay) {
        // Scan exercises folder for inventory
        const exercisesDir = vaultManager_1.VaultManager.getFullPath('Exercises');
        if (!fs_1.default.existsSync(exercisesDir))
            throw new Error('No exercises found in vault. Add equipment first.');
        const exerciseFiles = fs_1.default.readdirSync(exercisesDir).filter(f => f.endsWith('.md'));
        // Simple algorithmic distribution across days
        let planMarkdown = '';
        const exercisesPerDay = Math.ceil(exerciseFiles.length / daysPerWeek);
        for (let d = 1; d <= daysPerWeek; d++) {
            const dayExercises = exerciseFiles.slice((d - 1) * exercisesPerDay, d * exercisesPerDay);
            planMarkdown += `## Day ${d}: Session ${d}\n`;
            dayExercises.forEach((file, idx) => {
                const exName = file.replace('.md', '');
                planMarkdown += `${idx + 1}. [[${exName}]] — *Last Weight: Check Exercise Note*\n`;
            });
            planMarkdown += `\n`;
        }
        vaultManager_1.VaultManager.saveWeeklyPlan(daysPerWeek, hoursPerDay, planMarkdown);
        return { success: true, message: `Created a ${daysPerWeek}-day weekly plan (${hoursPerDay}h/day).` };
    }
    // 3. todaysPlan
    static handleTodaysPlan() {
        const { data } = vaultManager_1.VaultManager.getActivePlan();
        const dayIndex = data.current_day_index;
        const daysPerWeek = data.days_per_week;
        // Read day block from Active-Weekly-Plan
        const planRaw = fs_1.default.readFileSync(vaultManager_1.VaultManager.getFullPath('Plans/Active-Weekly-Plan.md'), 'utf8');
        const dayRegex = new RegExp(`## Day ${dayIndex}:[\\s\\S]*?(?=## Day|$)`);
        const match = planRaw.match(dayRegex);
        if (!match)
            throw new Error(`Day ${dayIndex} not found in active plan.`);
        // Extract exercise wikilinks
        const exerciseMatches = [...match[0].matchAll(/\[\[(.*?)\]\]/g)].map(m => m[1]);
        // Fetch last weights and prepare log payload
        const exercisesForLog = exerciseMatches.map(exName => {
            const exPath = vaultManager_1.VaultManager.getFullPath(path_1.default.join('Exercises', `${exName}.md`));
            let lastWeight = null;
            let equipment = 'Unknown Equipment';
            if (fs_1.default.existsSync(exPath)) {
                const raw = fs_1.default.readFileSync(exPath, 'utf8');
                const parsed = matter(raw);
                lastWeight = parsed.data.last_weight;
                equipment = parsed.data.equipment?.replace(/\[\[|\]\]/g, '') || 'Machine';
            }
            return { equipment, exercise: exName, lastWeight };
        });
        const dateStr = new Date().toISOString().split('T')[0];
        const logFileName = vaultManager_1.VaultManager.createWorkoutLog(dateStr, dayIndex, exercisesForLog);
        // Advance session index cyclically
        const nextIndex = (dayIndex % daysPerWeek) + 1;
        vaultManager_1.VaultManager.updatePlanIndex(nextIndex, data.total_sessions_completed + 1);
        return {
            dayIndex,
            logFileName,
            exercises: exercisesForLog,
            interactiveButtons: exercisesForLog.map((ex, idx) => `[${idx + 1}] Log ${ex.exercise} (Last: ${ex.lastWeight ?? 'N/A'} kg)`)
        };
    }
    // 4. report
    static handleReport(logFileName, exerciseNumber, weight, exerciseName) {
        const dateStr = new Date().toISOString().split('T')[0];
        vaultManager_1.VaultManager.updateLogEntry(logFileName, exerciseNumber, weight);
        vaultManager_1.VaultManager.updateExerciseWeight(exerciseName, weight, dateStr, logFileName);
        return {
            success: true,
            message: `Successfully logged ${weight} kg for **${exerciseName}**.`
        };
    }
    // 5. log (History Retrieval)
    static handleGetLogHistory(startDate, endDate) {
        const logs = vaultManager_1.VaultManager.getLogsInRange(startDate, endDate);
        if (logs.length === 0)
            return { message: 'No workout logs found in this date range.' };
        let reportOutput = `📅 **Training Log: ${startDate} to ${endDate}**\n\n`;
        for (const log of logs) {
            reportOutput += `🗓️ **${log.data.date} (Day ${log.data.plan_day_index})**\n`;
            reportOutput += `${log.content}\n\n`;
        }
        return { success: true, report: reportOutput };
    }
}
exports.BotController = BotController;
//# sourceMappingURL=botController.js.map