// Types
export interface Problem {
    id: string;
    problem: string;
    answer: number;
    level: number;
    source?: 'gemini' | 'fallback';
}

export interface Stats {
    level: number;
    stickers: number;
    totalStickers: number;
}

export interface Session {
    session_id: string;
    current_level: number;
    level_stickers: number;
    total_stickers: number;
}

export interface Explanation {
    message: string;
    animation_type: string;
    visual_items: string[];
    correct_answer: number;
    audio_base64?: string;
    problem?: string;
    is_detective?: boolean;
}

export const INITIAL_PROBLEM: Problem = {
    id: 'init-1',
    problem: '2 + 3',
    answer: 5,
    level: 1
};

export const API_URL = 'https://math-ai-backend-dlgntatyiq-uc.a.run.app';
export const GIFT_THRESHOLD = 25;
export const TOTAL_GOAL = 30;
