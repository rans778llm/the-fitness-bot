"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const VAULT_ROOT = process.env.OBSIDIAN_VAULT_PATH || '';
const SUBDIR = process.env.FITNESS_BOT_SUBDIR || 'Self Projects/The Fitness Bot';
const BASE_PATH = path_1.default.join(VAULT_ROOT, SUBDIR);
class VaultManager {
    static getFullPath(relativePath) {
        return path_1.default.join(BASE_PATH, relativePath);
    }
    static ensureDirectories() {
        ['Attachments', 'Equipment', 'Exercises', 'Plans', 'Logs'].forEach(dir => {
            const dirPath = path_1.default.join(BASE_PATH, dir);
            if (!fs_1.default.existsSync(dirPath)) {
                fs_1.default.mkdirSync(dirPath, { recursive: true });
            }
        });
    }
    static saveEquipmentNote(name, category, imageFileName, exercises) {
        this.ensureDirectories();
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        const filePath = path_1.default.join(BASE_PATH, 'Equipment', `${name}.md`);
        const data = {
            type: 'equipment',
            name: name,
            category: category,
            image: `[[${imageFileName}]]`,
            date_added: new Date().toISOString().split('T')[0],
            exercises: exercises.map(ex => `[[${ex}]]`)
        };
        const exerciseListMarkdown = exercises.map(ex => `* [[${ex}]] — Target Muscles`).join('\n');
        const content = `# ${name}\n\n![[${imageFileName}]]\n\n## Supported Exercises\n${exerciseListMarkdown}\n`;
        const fileContent = gray_matter_1.default.stringify(content, data);
        fs_1.default.writeFileSync(filePath, fileContent, 'utf8');
    }
    static saveExerciseNote(exerciseName, equipmentName, primaryMuscles) {
        this.ensureDirectories();
        const filePath = path_1.default.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
        if (fs_1.default.existsSync(filePath))
            return; // Don't overwrite existing history
        const data = {
            type: 'exercise',
            name: exerciseName,
            equipment: `[[${equipmentName}]]`,
            primary_muscles: primaryMuscles,
            last_weight: null,
            weight_unit: 'kg',
            last_performed: null
        };
        const content = `# ${exerciseName}\n\n**Equipment:** [[${equipmentName}]]  \n**Target Muscles:** ${primaryMuscles.join(', ')}\n\n## Weight Progression Log\n| Date | Weight (kg) | Session Log |\n| :--- | :---: | :--- |\n`;
        const fileContent = gray_matter_1.default.stringify(content, data);
        fs_1.default.writeFileSync(filePath, fileContent, 'utf8');
    }
    static updateExerciseWeight(exerciseName, weight, dateStr, logFileName) {
        const filePath = path_1.default.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
        if (!fs_1.default.existsSync(filePath))
            return;
        const fileRaw = fs_1.default.readFileSync(filePath, 'utf8');
        const parsed = (0, gray_matter_1.default)(fileRaw);
        parsed.data.last_weight = weight;
        parsed.data.last_performed = dateStr;
        const newRow = `| ${dateStr} | ${weight} | [[${logFileName}]] |`;
        const updatedContent = parsed.content.trim() + `\n${newRow}\n`;
        fs_1.default.writeFileSync(filePath, gray_matter_1.default.stringify(updatedContent, parsed.data), 'utf8');
    }
    static saveWeeklyPlan(daysPerWeek, hoursPerDay, planMarkdown) {
        this.ensureDirectories();
        const filePath = path_1.default.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
        const data = {
            type: 'weekly_plan',
            status: 'active',
            created_at: new Date().toISOString().split('T')[0],
            days_per_week: daysPerWeek,
            hours_per_day: hoursPerDay,
            current_day_index: 1,
            total_sessions_completed: 0
        };
        const fileContent = gray_matter_1.default.stringify(`\n# Active Weekly Workout Plan\n\n${planMarkdown}`, data);
        fs_1.default.writeFileSync(filePath, fileContent, 'utf8');
    }
    static getActivePlan() {
        const filePath = path_1.default.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
        if (!fs_1.default.existsSync(filePath))
            throw new Error('No active weekly plan found.');
        const fileRaw = fs_1.default.readFileSync(filePath, 'utf8');
        return (0, gray_matter_1.default)(fileRaw);
    }
    static updatePlanIndex(newIndex, sessionsCompleted) {
        const filePath = path_1.default.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
        const { data, content } = this.getActivePlan();
        data.current_day_index = newIndex;
        data.total_sessions_completed = sessionsCompleted;
        fs_1.default.writeFileSync(filePath, gray_matter_1.default.stringify(content, data), 'utf8');
    }
    static createWorkoutLog(dateStr, dayIndex, exercises) {
        this.ensureDirectories();
        const logFileName = `${dateStr}-Workout-Log`;
        const filePath = path_1.default.join(BASE_PATH, 'Logs', `${logFileName}.md`);
        const data = {
            type: 'workout_log',
            date: dateStr,
            plan_ref: '[[Active-Weekly-Plan]]',
            plan_day_index: dayIndex,
            status: 'in_progress'
        };
        let tableRows = exercises.map((ex, idx) => `| ${idx + 1} | [[${ex.equipment}]] | [[${ex.exercise}]] | ${ex.lastWeight !== null ? ex.lastWeight + ' kg' : 'N/A'} | — | ⏳ Pending |`).join('\n');
        const content = `# Workout Log — ${dateStr} (Day ${dayIndex})\n\n| # | Equipment | Exercise | Target Weight | Logged Weight | Status |\n| :-: | :--- | :--- | :---: | :---: | :---: |\n${tableRows}\n`;
        fs_1.default.writeFileSync(filePath, gray_matter_1.default.stringify(content, data), 'utf8');
        return logFileName;
    }
    static updateLogEntry(logFileName, exerciseNumber, loggedWeight) {
        const filePath = path_1.default.join(BASE_PATH, 'Logs', `${logFileName}.md`);
        if (!fs_1.default.existsSync(filePath))
            throw new Error(`Log file ${logFileName} not found.`);
        const fileRaw = fs_1.default.readFileSync(filePath, 'utf8');
        const parsed = (0, gray_matter_1.default)(fileRaw);
        const lines = parsed.content.split('\n');
        const updatedLines = lines.map(line => {
            if (line.startsWith(`| ${exerciseNumber} |`)) {
                const parts = line.split('|').map(p => p.trim());
                // parts[1] = index, parts[2] = equipment, parts[3] = exercise, parts[4] = target, parts[5] = logged, parts[6] = status
                parts[5] = `${loggedWeight} kg`;
                parts[6] = '✅ Completed';
                return `| ${parts.slice(1, -1).join(' | ')} |`;
            }
            return line;
        });
        fs_1.default.writeFileSync(filePath, gray_matter_1.default.stringify(updatedLines.join('\n'), parsed.data), 'utf8');
    }
    static getLogsInRange(startDate, endDate) {
        const logsDir = path_1.default.join(BASE_PATH, 'Logs');
        if (!fs_1.default.existsSync(logsDir))
            return [];
        const files = fs_1.default.readdirSync(logsDir);
        const results = [];
        for (const file of files) {
            if (!file.endsWith('.md'))
                continue;
            const filePath = path_1.default.join(logsDir, file);
            const raw = fs_1.default.readFileSync(filePath, 'utf8');
            const parsed = (0, gray_matter_1.default)(raw);
            const logDate = parsed.data.date;
            if (logDate && logDate >= startDate && logDate <= endDate) {
                results.push({ fileName: file.replace('.md', ''), content: parsed.content, data: parsed.data });
            }
        }
        return results.sort((a, b) => a.data.date.localeCompare(b.data.date));
    }
}
exports.VaultManager = VaultManager;
//# sourceMappingURL=vaultManager.js.map