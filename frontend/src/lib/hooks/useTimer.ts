import { useState, useEffect } from 'react';
import { Problem } from '../types';

interface UseTimerProps {
    problem: Problem | null;
    waitingForAnswer: boolean;
    onTimeOver: () => void;
}

export const useTimer = ({ problem, waitingForAnswer, onTimeOver }: UseTimerProps) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [timerActive, setTimerActive] = useState(false);

    // Reset timer when problem changes
    useEffect(() => {
        if (problem) {
            const limit = 15 + (problem.level - 1) * 5;
            setTimeLeft(limit);
            setTimerActive(true); // 답변 대기 여부와 상관없이 타이머 시작 (타임어택)
        }
    }, [problem, waitingForAnswer]);

    // Countdown logic
    useEffect(() => {
        if (!timerActive) return;

        if (timeLeft === 0) {
            onTimeOver();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, timerActive, onTimeOver]);

    return {
        timeLeft,
        timerActive,
        setTimerActive,
        setTimeLeft
    };
};
