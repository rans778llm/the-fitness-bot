import { VaultManager } from './vaultManager.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export class BotController {
  
  static async handleGenerateExercises(
    imagePath: string, 
    machineName: string, 
    category: string, 
    exercisesList: { name: string; muscles: string[]; instructions?: string; youtubeUrl?: string }[]
  ) {
    console.log(`[DEBUG Controller] handleGenerateExercises called for machine: "${machineName}", category: "${category}"`);
    
    const fileName = path.basename(imagePath);
    const targetAttachmentPath = VaultManager.getFullPath(path.join('Attachments', fileName));
    
    if (!fs.existsSync(path.dirname(targetAttachmentPath))) {
      fs.mkdirSync(path.dirname(targetAttachmentPath), { recursive: true });
    }
    
    fs.copyFileSync(imagePath, targetAttachmentPath);

    const exerciseNames = exercisesList.map(e => e.name);
    VaultManager.saveEquipmentNote(machineName, category, fileName, exerciseNames);

    for (const ex of exercisesList) {
      VaultManager.saveExerciseNote(
        ex.name, 
        machineName, 
        ex.muscles, 
        ex.instructions || '', 
        ex.youtubeUrl || ''
      );
      console.log(`[DEBUG Controller] Exercise note saved with instructions & direct YouTube link: ${ex.name}`);
    }

    return {
      success: true,
      message: `Successfully registered machine **${machineName}** and generated ${exercisesList.length} exercises with instructions and direct video links.`
    };
  }

  static handleCreateWeeklyPlan(daysPerWeek: number, hoursPerDay: number) {
    const exercisesDir = VaultManager.getFullPath('Exercises');
    if (!fs.existsSync(exercisesDir)) throw new Error('No exercises found in vault. Add equipment first.');
    
    const exerciseFiles = fs.readdirSync(exercisesDir).filter(f => f.endsWith('.md'));
    
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

    VaultManager.saveWeeklyPlan(daysPerWeek, hoursPerDay, planMarkdown);
    return { success: true, message: `Created a ${daysPerWeek}-day weekly plan (${hoursPerDay}h/day).` };
  }

  static handleTodaysPlan() {
    const { data } = VaultManager.getActivePlan();
    const dayIndex = data.current_day_index;
    const daysPerWeek = data.days_per_week;

    const planRaw = fs.readFileSync(VaultManager.getFullPath('Plans/Active-Weekly-Plan.md'), 'utf8');
    const dayRegex = new RegExp(`## Day ${dayIndex}:[\\s\\S]*?(?=## Day|$)`);
    const match = planRaw.match(dayRegex);
    if (!match) throw new Error(`Day ${dayIndex} not found in active plan.`);

    const exerciseMatches = [...match[0].matchAll(/\[\[(.*?)\]\]/g)].map(m => m[1]);
    
    const exercisesForLog = exerciseMatches.map(exName => {
      const exPath = VaultManager.getFullPath(path.join('Exercises', `${exName}.md`));
      let lastWeight = null;
      let equipment = 'Unknown Equipment';
      if (fs.existsSync(exPath)) {
        const raw = fs.readFileSync(exPath, 'utf8');
        const parsed = matter(raw);
        lastWeight = parsed.data.last_weight;
        equipment = parsed.data.equipment?.replace(/\[\[|\]\]/g, '') || 'Machine';
      }
      return { equipment, exercise: exName, lastWeight };
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const logFileName = VaultManager.createWorkoutLog(dateStr, dayIndex, exercisesForLog);
    if (!logFileName) throw new Error('Failed to create workout log file.');

    const nextIndex = (dayIndex % daysPerWeek) + 1;
    VaultManager.updatePlanIndex(nextIndex, data.total_sessions_completed + 1);

    return {
      dayIndex,
      logFileName,
      exercises: exercisesForLog
    };
  }

  static getLastExerciseWeight(exerciseName: string): number | null {
    const exPath = VaultManager.getFullPath(path.join('Exercises', `${exerciseName}.md`));
    if (!fs.existsSync(exPath)) return null;
    const parsed = matter(fs.readFileSync(exPath, 'utf8'));
    return typeof parsed.data.last_weight === 'number' ? parsed.data.last_weight : null;
  }

  static handleReport(logFileName: string, exerciseNumber: number, weight: number, exerciseName: string) {
    const dateStr = new Date().toISOString().split('T')[0];
    VaultManager.updateLogEntry(logFileName, exerciseNumber, weight);
    VaultManager.updateExerciseWeight(exerciseName, weight, dateStr, logFileName);

    return {
      success: true,
      message: `✅ Logged **${weight} kg** for **${exerciseName}**.`
    };
  }

  static handleGetLogHistory(startDate: string, endDate: string) {
    const logs = VaultManager.getLogsInRange(startDate, endDate);
    if (logs.length === 0) return { message: 'No workout logs found in this date range.' };

    let reportOutput = `📅 **Training Log: ${startDate} to ${endDate}**\n\n`;
    for (const log of logs) {
      reportOutput += `🗓️ **${log.data.date} (Day ${log.data.plan_day_index})**\n`;
      reportOutput += `${log.content}\n\n`;
    }

    return { success: true, report: reportOutput };
  }

  private static collectVaultMarkdown(dir: string): string {
    if (!fs.existsSync(dir)) return '';
    let combined = '';
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        combined += this.collectVaultMarkdown(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const text = fs.readFileSync(fullPath, 'utf8');
        combined += `\n--- File: ${entry.name} ---\n${text}\n`;
      }
    }
    return combined;
  }

  static async handleAskVault(question: string): Promise<string> {
    const vaultContext = this.collectVaultMarkdown(VaultManager.getFullPath(''));
    if (!vaultContext.trim()) {
      return 'Your Fitness Bot vault directory is currently empty.';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        `You are a concise personal fitness assistant. Answer the user's question based ONLY on their Obsidian Fitness Vault notes below.\n\n${vaultContext}\n\nUser Question: ${question}`
      ]
    });

    return response.text || 'No relevant information found in your fitness notes.';
  }
}