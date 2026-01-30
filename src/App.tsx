// ============================================
// 수학 게임 메인 앱 (STT 제거 → 객관식)
// ============================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { GameLayout, Button } from '@hanuland/ui';

interface MathQuestion {
    id: string;
    num1: number;
    num2: number;
    operator: '+' | '-';
    correctAnswer: number;
    options: number[];
}

// 문제 생성 함수
function generateQuestion(level: number): MathQuestion {
    const maxNum = Math.min(10 + level * 5, 50);
    const num1 = Math.floor(Math.random() * maxNum) + 1;
    const num2 = Math.floor(Math.random() * Math.min(num1, maxNum / 2)) + 1;
    const operator = Math.random() > 0.5 ? '+' : '-';
    const correctAnswer = operator === '+' ? num1 + num2 : num1 - num2;

    // 4개의 선택지 생성 (정답 포함)
    const options = new Set<number>([correctAnswer]);
    while (options.size < 4) {
        const offset = Math.floor(Math.random() * 10) - 5;
        const wrongAnswer = correctAnswer + offset;
        if (wrongAnswer >= 0 && wrongAnswer !== correctAnswer) {
            options.add(wrongAnswer);
        }
    }

    return {
        id: `q-${Date.now()}`,
        num1,
        num2,
        operator,
        correctAnswer,
        options: Array.from(options).sort(() => Math.random() - 0.5),
    };
}

function App() {
    const [level, setLevel] = useState(1);
    const [score, setScore] = useState(0);
    const [question, setQuestion] = useState<MathQuestion>(() => generateQuestion(1));
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [streak, setStreak] = useState(0);

    // 정답 확인
    const checkAnswer = useCallback((answer: number) => {
        setSelectedAnswer(answer);
        const correct = answer === question.correctAnswer;
        setIsCorrect(correct);

        if (correct) {
            // 정답 효과
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
            });
            setScore((s) => s + 10 * level);
            setStreak((s) => s + 1);

            // 5연속 정답 시 레벨업
            if ((streak + 1) % 5 === 0) {
                setLevel((l) => Math.min(l + 1, 10));
            }
        } else {
            setStreak(0);
        }

        // 다음 문제로 이동
        setTimeout(() => {
            setQuestion(generateQuestion(level));
            setSelectedAnswer(null);
            setIsCorrect(null);
        }, 1500);
    }, [question, level, streak]);

    return (
        <GameLayout
            header={
                <div className="flex items-center justify-between w-full">
                    <h1 className="text-xl font-bold text-blue-500">🧮 수학 게임</h1>
                    <div className="flex gap-4 text-lg">
                        <span className="text-gray-600">레벨 {level}</span>
                        <span className="text-pink-500 font-bold">⭐ {score}점</span>
                    </div>
                </div>
            }
            footer={
                <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ scale: 0.8, opacity: 0.3 }}
                            animate={{
                                scale: i < streak % 5 ? 1.2 : 0.8,
                                opacity: i < streak % 5 ? 1 : 0.3,
                            }}
                            className="w-6 h-6 bg-yellow-400 rounded-full"
                        />
                    ))}
                    <span className="ml-4 text-gray-600">{streak}연속 정답!</span>
                </div>
            }
        >
            <div className="flex flex-col items-center gap-8">
                {/* 문제 표시 */}
                <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-12 rounded-3xl shadow-2xl border-4 border-blue-100"
                >
                    <span className="text-6xl font-bold text-gray-800">
                        {question.num1} {question.operator} {question.num2} = ?
                    </span>
                </motion.div>

                {/* 객관식 선택지 (4개 버튼) */}
                <div className="grid grid-cols-2 gap-6">
                    {question.options.map((option) => (
                        <Button
                            key={option}
                            variant={
                                selectedAnswer === option
                                    ? isCorrect
                                        ? 'success'
                                        : 'primary'
                                    : 'secondary'
                            }
                            size="lg"
                            onClick={() => selectedAnswer === null && checkAnswer(option)}
                            disabled={selectedAnswer !== null}
                            className={`
                !min-w-[120px] text-4xl font-bold
                ${selectedAnswer === option && !isCorrect ? 'shake bg-red-400' : ''}
                ${option === question.correctAnswer && selectedAnswer !== null ? 'ring-4 ring-green-400' : ''}
              `}
                        >
                            {option}
                        </Button>
                    ))}
                </div>

                {/* 피드백 메시지 */}
                <AnimatePresence>
                    {isCorrect !== null && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className={`text-4xl font-bold ${isCorrect ? 'text-green-500' : 'text-red-500'}`}
                        >
                            {isCorrect ? '🎉 정답!' : `😢 틀렸어요! 정답은 ${question.correctAnswer}`}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </GameLayout>
    );
}

export default App;
