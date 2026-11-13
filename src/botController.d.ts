export declare class BotController {
    static handleGenerateExercises(imagePath: string, machineName: string, category: string, exercisesList: {
        name: string;
        muscles: string[];
    }[]): Promise<{
        success: boolean;
        message: string;
    }>;
    static handleCreateWeeklyPlan(daysPerWeek: number, hoursPerDay: number): {
        success: boolean;
        message: string;
    };
    static handleTodaysPlan(): {
        dayIndex: any;
        logFileName: string;
        exercises: {
            equipment: string;
            exercise: string | undefined;
            lastWeight: any;
        }[];
        interactiveButtons: string[];
    };
    static handleReport(logFileName: string, exerciseNumber: number, weight: number, exerciseName: string): {
        success: boolean;
        message: string;
    };
    static handleGetLogHistory(startDate: string, endDate: string): {
        message: string;
        success?: never;
        report?: never;
    } | {
        message?: never;
        success: boolean;
        report: string;
    };
}
//# sourceMappingURL=botController.d.ts.map