export declare class VaultManager {
    static getFullPath(relativePath: string): string;
    static ensureDirectories(): void;
    static saveEquipmentNote(name: string, category: string, imageFileName: string, exercises: string[]): void;
    static saveExerciseNote(exerciseName: string, equipmentName: string, primaryMuscles: string[]): void;
    static updateExerciseWeight(exerciseName: string, weight: number, dateStr: string, logFileName: string): void;
    static saveWeeklyPlan(daysPerWeek: number, hoursPerDay: number, planMarkdown: string): void;
    static getActivePlan(): {
        data: any;
        content: string;
    };
    static updatePlanIndex(newIndex: number, sessionsCompleted: number): void;
    static createWorkoutLog(dateStr: string, dayIndex: number, exercises: {
        equipment: string;
        exercise: string;
        lastWeight: any;
    }[]): string;
    static updateLogEntry(logFileName: string, exerciseNumber: number, loggedWeight: number): void;
    static getLogsInRange(startDate: string, endDate: string): {
        fileName: string;
        content: string;
        data: any;
    }[];
}
//# sourceMappingURL=vaultManager.d.ts.map