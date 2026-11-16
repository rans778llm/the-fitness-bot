import { isYouTubeVideoValid } from './utils/youtubeValidator.js';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Service to handle equipment extraction, exercise generation, and link verification.
 */
export class FitnessBotService {
  
  /**
   * Processes equipment image/text, generates exercise instructions, 
   * and verifies/falls back YouTube URLs before saving to Obsidian.
   */
  public async processAndVerifyExercise(exerciseName: string, rawYouTubeUrl: string): Promise<string> {
    let isValid = await isYouTubeVideoValid(rawYouTubeUrl);
    let verifiedUrl = rawYouTubeUrl;

    if (!isValid) {
      console.warn(`[FitnessBotService] Dead link detected for "${exerciseName}". Requesting fallback from Gemini...`);
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash-lite',
          contents: `Provide a valid and active YouTube video ID for a tutorial on how to perform the exercise: "${exerciseName}". Return ONLY the 11-character YouTube video ID string and nothing else.`,
        });
        const newVideoId = response.text?.trim();
        if (newVideoId && newVideoId.length === 11) {
          verifiedUrl = `https://www.youtube.com/watch?v=${newVideoId}`;
        } else {
          verifiedUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseName + ' exercise tutorial')}`;
        }
      } catch (err) {
        verifiedUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseName + ' exercise tutorial')}`;
      }
    }

    console.log(`[FitnessBotService] Exercise "${exerciseName}" linked with verified URL: ${verifiedUrl}`);
    return verifiedUrl;
  }
}
