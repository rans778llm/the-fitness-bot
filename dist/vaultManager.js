import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
const BASE_PATH = 'H:/My Drive/Rans-Vault/Self Projects/The Fitness Bot';
export class VaultManager {
    static getFullPath(relativePath) {
        return path.join(BASE_PATH, relativePath);
    }
    static ensureDirectories() {
        const dirs = ['Attachments', 'Equipment', 'Exercises', 'Logs', 'Plans'];
        for (const dir of dirs) {
            const fullPath = path.join(BASE_PATH, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        }
    }
    static saveEquipmentNote(equipmentName, category, imageName, exercises) {
        this.ensureDirectories();
        const filePath = path.join(BASE_PATH, 'Equipment', `${equipmentName}.md`);
        const data = {
            type: 'equipment',
            name: equipmentName,
            category: category,
            image: `[[Attachments/${imageName}]]`,
            exercises: exercises.map(ex => `[[${ex}]]`)
        };
        const exerciseLinks = exercises.map(ex => `- [[${ex}]]`).join('\n');
        const content = `# ${equipmentName}\n\n**Category:** ${category}\n\n![[Attachments/${imageName}]]\n\n## Associated Exercises\n${exerciseLinks}\n`;
        const fileContent = matter.stringify(content, data);
        fs.writeFileSync(filePath, fileContent, 'utf8');
    }
    static saveExerciseNote(exerciseName, equipmentName, primaryMuscles, instructions = '', youtubeUrl = '') {
        this.ensureDirectories();
        const filePath = path.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
        if (fs.existsSync(filePath))
            return;
        const finalYouTubeUrl = youtubeUrl && youtubeUrl.startsWith('http')
            ? youtubeUrl
            : `https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseName + ' exercise form')}`;
        const data = {
            type: 'exercise',
            name: exerciseName,
            equipment: `[[${equipmentName}]]`,
            primary_muscles: primaryMuscles,
            last_weight: null,
            weight_unit: 'kg',
            last_performed: null,
            youtube_link: finalYouTubeUrl
        };
        const content = `# ${exerciseName}\n\n**Equipment:** [[${equipmentName}]]  \n**Target Muscles:** ${primaryMuscles.join(', ')}\n\n## Instructions\n${instructions || 'Perform with controlled movement and proper form.'}\n\n## Video Guide\n* [Watch Most Viewed Tutorial on YouTube](${finalYouTubeUrl})\n\n## Weight Progression Log\n| Date | Weight (kg) | Session Log |\n| :--- | :---: | :--- |\n`;
        const fileContent = matter.stringify(content, data);
        fs.writeFileSync(filePath, fileContent, 'utf8');
    }
    static saveWeeklyPlan(daysPerWeek, hoursPerDay, planMarkdown) {
        this.ensureDirectories();
        const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
        const data = {
            type: 'plan',
            days_per_week: daysPerWeek,
            hours_per_day: hoursPerDay,
            current_day_index: 1,
            total_sessions_completed: 0
        };
        const fileContent = matter.stringify(planMarkdown, data);
        fs.writeFileSync(filePath, fileContent, 'utf8');
    }
    static getActivePlan() {
        const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
        if (!fs.existsSync(filePath))
            throw new Error('No active weekly plan found. Create one first.');
        const raw = fs.readFileSync(filePath, 'utf8');
        return matter(raw);
    }
    static updatePlanIndex(nextDayIndex, sessionsCompleted) {
        const filePath = path.join(BASE_PATH, 'Plans', 'Active-Weekly-Plan.md');
        if (!fs.existsSync(filePath))
            return;
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = matter(raw);
        parsed.data.current_day_index = nextDayIndex;
        parsed.data.total_sessions_completed = sessionsCompleted;
        const updatedContent = matter.stringify(parsed.content, parsed.data);
        fs.writeFileSync(filePath, updatedContent, 'utf8');
    }
    static createWorkoutLog(dateStr, dayIndex, exercises) {
        this.ensureDirectories();
        const fileName = `${dateStr}-Day-${dayIndex}.md`;
        const filePath = path.join(BASE_PATH, 'Logs', fileName);
        const data = {
            type: 'workout_log',
            date: dateStr,
            plan_day_index: dayIndex
        };
        let tableContent = `## Workout Log - Day ${dayIndex}\n\n| Exercise | Weight (kg) |\n| :--- | :---: |\n`;
        exercises.forEach(ex => {
            tableContent += `| [[${ex.exercise}]] | ${ex.lastWeight ?? ''} |\n`;
        });
        const fileContent = matter.stringify(tableContent, data);
        fs.writeFileSync(filePath, fileContent, 'utf8');
        return fileName;
    }
    static updateLogEntry(logFileName, exerciseNumber, weight) {
        const filePath = path.join(BASE_PATH, 'Logs', logFileName);
        if (!fs.existsSync(filePath))
            return;
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = matter(raw);
        const lines = parsed.content.split('\n');
        let currentRow = 0;
        const updatedLines = lines.map(line => {
            if (line.startsWith('| [[')) {
                currentRow++;
                if (currentRow === exerciseNumber) {
                    const parts = line.split('|');
                    if (parts.length >= 3) {
                        parts[2] = ` ${weight} `;
                        return parts.join('|');
                    }
                }
            }
            return line;
        });
        parsed.content = updatedLines.join('\n');
        const updatedFile = matter.stringify(parsed.content, parsed.data);
        fs.writeFileSync(filePath, updatedFile, 'utf8');
    }
    static updateExerciseWeight(exerciseName, weight, dateStr, logFileName) {
        const filePath = path.join(BASE_PATH, 'Exercises', `${exerciseName}.md`);
        if (!fs.existsSync(filePath))
            return;
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = matter(raw);
        parsed.data.last_weight = weight;
        parsed.data.last_performed = dateStr;
        const newRow = `| ${dateStr} | ${weight} | [[Logs/${logFileName}|Session Log]] |\n`;
        if (!parsed.content.includes(newRow)) {
            parsed.content += newRow;
        }
        const updatedFile = matter.stringify(parsed.content, parsed.data);
        fs.writeFileSync(filePath, updatedFile, 'utf8');
    }
    static getLogsInRange(startDate, endDate) {
        const logsDir = path.join(BASE_PATH, 'Logs');
        if (!fs.existsSync(logsDir))
            return [];
        const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.md'));
        const matchedLogs = [];
        for (const file of files) {
            const filePath = path.join(logsDir, file);
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = matter(raw);
            const logDate = parsed.data.date;
            if (logDate && logDate >= startDate && logDate <= endDate) {
                matchedLogs.push(parsed);
            }
        }
        return matchedLogs;
    }
}
