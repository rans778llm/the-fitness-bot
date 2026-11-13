import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import dotenv from 'dotenv';
dotenv.config();
const VAULT_ROOT = process.env.OBSIDIAN_VAULT_PATH || '';
const SUBDIR = process.env.FITNESS_BOT_SUBDIR || 'Self Projects/The Fitness Bot';
const BASE_PATH = path.join(VAULT_ROOT, SUBDIR);
export class VaultManager {
    static getFullPath(relativePath) {
        return path.join(BASE_PATH, relativePath);
    }
    static ensureDirectories() {
        ['Attachments', 'Equipment', 'Exercises', 'Plans', 'Logs'].forEach(dir => {
            const dirPath = path.join(BASE_PATH, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        });
    }
    static saveEquipmentNote(name, category, imageFileName, exercises) {
        this.ensureDirectories();
        const filePath = path.join(BASE_PATH, 'Equipment', `${name}.md`);
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
        const fileContent = matter.stringify(content, data);
        fs.writeFileSync(filePath, fileContent, 'utf8');
    }
    static saveExerciseNote(exerciseName, equipmentName, primaryMuscles) {
        this.ensureDirectories();
        const filePath = path.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
        if (fs.existsSync(filePath))
            return;
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
        const fileContent = matter.stringify(content, data);
        fs.writeFileSync(filePath, fileContent, 'utf8');
    }
    static updateExerciseWeight(exerciseName, weight, dateStr, logFileName) {
        const filePath = path.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
        if (!fs.existsSync(filePath))
            return;
        const fileRaw = fs.readFileSync(filePath, 'utf8');
        const parsed = matter(fileRaw);
        parsed.data.last_weight = weight;
        parsed.data.last_performed = dateStr;
        const newRow = `| ${dateStr} | ${weight} | [[${logFileName}]] |`;
        const updatedContent = parsed.content.trim() + `\n${newRow}\n`;
        fs.writeFileSync(filePath, matter.stringify(updatedContent, parsed.data), 'utf8');
    }
    static saveWeeklyPlan(daysPerWeek, hoursPerDay, planMarkdown) {
        this.ensureDirectories();
        const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
        const data = {
            type: 'weekly_plan',
            status: 'active',
            created_at: new Date().toISOString().split('T')[0],
            days_per_week: daysPerWeek,
            hours_per_day: hoursPerDay,
            current_day_index: 1,
            total_sessions_completed: 0
        };
        const fileContent = matter.stringify(`\n# Active Weekly Workout Plan\n\n${planMarkdown}`, data);
        fs.writeFileSync(filePath, fileContent, 'utf8');
    }
    static getActivePlan() {
        const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
        if (!fs.existsSync(filePath))
            throw new Error('No active weekly plan found.');
        const fileRaw = fs.readFileSync(filePath, 'utf8');
        return matter(fileRaw);
    }
    static updatePlanIndex(newIndex, sessionsCompleted) {
        const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
        const { data, content } = this.getActivePlan();
        data.current_day_index = newIndex;
        data.total_sessions_completed = sessionsCompleted;
        fs.writeFileSync(filePath, matter.stringify(content, data), 'utf8');
    }
    static createWorkoutLog(dateStr, dayIndex, exercises) {
        this.ensureDirectories();
        const logFileName = `${dateStr}-Workout-Log`;
        const filePath = path.join(BASE_PATH, 'Logs', `${logFileName}.md`);
        const data = {
            type: 'workout_log',
            date: dateStr,
            plan_ref: '[[Active-Weekly-Plan]]',
            plan_day_index: dayIndex,
            status: 'in_progress'
        };
        let tableRows = exercises.map((ex, idx) => `| ${idx + 1} | [[${ex.equipment}]] | [[${ex.exercise}]] | ${ex.lastWeight !== null ? ex.lastWeight + ' kg' : 'N/A'} | — | ⏳ Pending |`).join('\n');
        const content = `# Workout Log — ${dateStr} (Day ${dayIndex})\n\n| # | Equipment | Exercise | Target Weight | Logged Weight | Status |\n| :-: | :--- | :--- | :---: | :---: | :---: |\n${tableRows}\n`;
        fs.writeFileSync(filePath, matter.stringify(content, data), 'utf8');
        return logFileName;
    }
    static updateLogEntry(logFileName, exerciseNumber, loggedWeight) {
        const filePath = path.join(BASE_PATH, 'Logs', `${logFileName}.md`);
        if (!fs.existsSync(filePath))
            throw new Error(`Log file ${logFileName} not found.`);
        const fileRaw = fs.readFileSync(filePath, 'utf8');
        const parsed = matter(fileRaw);
        const lines = parsed.content.split('\n');
        const updatedLines = lines.map(line => {
            if (line.startsWith(`| ${exerciseNumber} |`)) {
                const parts = line.split('|').map(p => p.trim());
                parts[5] = `${loggedWeight} kg`;
                parts[6] = '✅ Completed';
                return `| ${parts.slice(1, -1).join(' | ')} |`;
            }
            return line;
        });
        fs.writeFileSync(filePath, matter.stringify(updatedLines.join('\n'), parsed.data), 'utf8');
    }
    static getLogsInRange(startDate, endDate) {
        const logsDir = path.join(BASE_PATH, 'Logs');
        if (!fs.existsSync(logsDir))
            return [];
        const files = fs.readdirSync(logsDir);
        const results = [];
        for (const file of files) {
            if (!file.endsWith('.md'))
                continue;
            const filePath = path.join(logsDir, file);
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = matter(raw);
            const logDate = parsed.data.date;
            if (logDate && logDate >= startDate && logDate <= endDate) {
                results.push({ fileName: file.replace('.md', ''), content: parsed.content, data: parsed.data });
            }
        }
        return results.sort((a, b) => a.data.date.localeCompare(b.data.date));
    }
}
