import { VaultManager } from './vaultManager.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ExerciseMetadata {
  name: string;
  muscles: string[];
  equipment: string;
  youtubeUrl: string;
  lastWeight: number | null;
}

export interface GeneratedPlanDay {
  day: number;
  title: string;
  exercises: ExerciseMetadata[];
}

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

  static getAllExercisesMetadata(): ExerciseMetadata[] {
    const exercisesDir = VaultManager.getFullPath('Exercises');
    if (!fs.existsSync(exercisesDir)) return [];

    const files = fs.readdirSync(exercisesDir).filter(f => f.endsWith('.md'));
    return files.map(file => {
      const exName = file.replace('.md', '');
      const raw = fs.readFileSync(path.join(exercisesDir, file), 'utf8');
      const parsed = matter(raw);

      const muscles = Array.isArray(parsed.data.primary_muscles)
        ? parsed.data.primary_muscles
        : parsed.data.primary_muscles
        ? [String(parsed.data.primary_muscles)]
        : ['General'];

      const equipment = parsed.data.equipment
        ? String(parsed.data.equipment).replace(/\[\[|\]\]/g, '')
        : 'Gym Equipment';

      const youtubeUrl = parsed.data.youtube_link && String(parsed.data.youtube_link).startsWith('http')
        ? String(parsed.data.youtube_link)
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(exName + ' exercise form')}`;

      const lastWeight = typeof parsed.data.last_weight === 'number' ? parsed.data.last_weight : null;

      return {
        name: exName,
        muscles,
        equipment,
        youtubeUrl,
        lastWeight
      };
    });
  }

  static async handleCreateWeeklyPlan(daysPerWeek: number, hoursPerDay: number = 1): Promise<{
    success: boolean;
    message: string;
    days: GeneratedPlanDay[];
  }> {
    const allExercises = this.getAllExercisesMetadata();
    if (allExercises.length === 0) {
      throw new Error('No exercises found in vault. Add equipment photos first.');
    }

    // ~6 exercises fits an approximate 1-hour session (including warm-up & rest between sets)
    const targetExercisesPerDay = Math.max(4, Math.min(6, Math.round(hoursPerDay * 6)));

    const prompt = `You are an expert strength & conditioning coach. Build a ${daysPerWeek}-day weekly workout split where each workout session takes approximately ${hoursPerDay} hour(s) (roughly ${targetExercisesPerDay} exercises per day).

Available Exercises in the user's gym vault:
${JSON.stringify(allExercises.map(e => ({ name: e.name, muscles: e.muscles, equipment: e.equipment })), null, 2)}

Strict Scheduling Rules:
1. Maximize muscle recovery: Distribute muscle groups across the ${daysPerWeek} days so each muscle gets the maximum possible rest days between sessions (e.g. Upper/Lower, Push/Pull/Legs, or dedicated body-part splits depending on ${daysPerWeek} days). Never schedule the same primary muscle group on consecutive days unless total exercise variety makes it unavoidable.
2. Avoid repeating exercises across the week: Use unique exercises across all ${daysPerWeek} days whenever possible. ONLY repeat an exercise if there are not enough distinct exercises in the vault to fill all ${daysPerWeek} sessions (~${targetExercisesPerDay} exercises per session).
3. Use ONLY exact exercise names from the provided list.

Return ONLY a valid JSON object (no markdown fences, no extra text) with this exact structure:
{
  "days": [
    {
      "day": 1,
      "title": "Focus Area (e.g., Chest & Triceps / Upper Body)",
      "exercises": ["Exact Exercise Name 1", "Exact Exercise Name 2"]
    }
  ]
}`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [prompt]
    });

    const rawText = aiResponse.text?.trim() || '{}';
    const sanitized = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = sanitized.indexOf('{');
    const lastBrace = sanitized.lastIndexOf('}');
    const jsonClean = firstBrace !== -1 && lastBrace !== -1 ? sanitized.substring(firstBrace, lastBrace + 1) : '{}';

    const parsedPlan = JSON.parse(jsonClean);
    const exerciseMap = new Map(allExercises.map(ex => [ex.name.toLowerCase(), ex]));

    const structuredDays: GeneratedPlanDay[] = [];
    let planMarkdown = '';

    if (Array.isArray(parsedPlan.days) && parsedPlan.days.length > 0) {
      for (const dayItem of parsedPlan.days) {
        const dayNum = Number(dayItem.day) || structuredDays.length + 1;
        const dayTitle = String(dayItem.title || `Session ${dayNum}`).trim();
        const dayExercises: ExerciseMetadata[] = [];

        for (const rawName of dayItem.exercises || []) {
          const found = exerciseMap.get(String(rawName).trim().toLowerCase());
          if (found) {
            dayExercises.push(found);
          }
        }

        if (dayExercises.length > 0) {
          structuredDays.push({ day: dayNum, title: dayTitle, exercises: dayExercises });
        }
      }
    }

    // Fallback if AI response failed or returned empty
    if (structuredDays.length === 0) {
      const totalNeeded = daysPerWeek * targetExercisesPerDay;
      const pool: ExerciseMetadata[] = [];
      while (pool.length < totalNeeded) {
        pool.push(...allExercises);
      }
      for (let d = 1; d <= daysPerWeek; d++) {
        const slice = pool.slice((d - 1) * targetExercisesPerDay, d * targetExercisesPerDay);
        structuredDays.push({
          day: d,
          title: `Session ${d}`,
          exercises: slice
        });
      }
    }

    for (const d of structuredDays) {
      planMarkdown += `## Day ${d.day}: ${d.title}
`;
      d.exercises.forEach((ex, idx) => {
        planMarkdown += `${idx + 1}. [[${ex.name}]] (${ex.muscles.join(', ')}) — [Video Guide](${ex.youtubeUrl})
`;
      });
      planMarkdown += `
`;
    }

    VaultManager.saveWeeklyPlan(daysPerWeek, hoursPerDay, planMarkdown);

    return {
      success: true,
      message: `Created a ${daysPerWeek}-day weekly plan (~${hoursPerDay}h/session) optimized for muscle recovery.`,
      days: structuredDays
    };
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
