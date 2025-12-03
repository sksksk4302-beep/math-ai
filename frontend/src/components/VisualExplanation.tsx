'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';


// Dynamically import Lottie to avoid SSR issues


interface VisualExplanationProps {
    count1: number;
    count2: number;
    operator: '+' | '-';
    visualItems?: string[]; // Optional: items from backend
}

type AnimationStep = 'init' | 'showLeft' | 'showRight' | 'merge' | 'finish';

// Item mapping (same as Counting.tsx)
const itemMap: Record<string, string> = {
    'apple': '🍎',
    'star': '⭐',
    'dinosaur': '🦕',
    'car': '🚗',
    'candy': '🍬',
    'bus': '🚌',
    'flower': '🌸',
    'pencil': '✏️',
    'coin': '🪙',
    'default': '🍎'
};

export default function VisualExplanation({ count1, count2, operator, visualItems }: VisualExplanationProps) {
    const [step, setStep] = useState<AnimationStep>('init');
    const total = operator === '+' ? count1 + count2 : count1 - count2;

    // Determine which item to use
    const itemEmoji = visualItems && visualItems.length > 0
        ? (itemMap[visualItems[0]] || itemMap['default'])
        : itemMap['default'];

    useEffect(() => {
        const timeline = [
            { delay: 500, nextStep: 'showLeft' as AnimationStep },
            { delay: 1500, nextStep: 'showRight' as AnimationStep },
            { delay: 2500, nextStep: 'merge' as AnimationStep },
            { delay: 4000, nextStep: 'finish' as AnimationStep },
        ];

        const timers: NodeJS.Timeout[] = [];

        timeline.forEach(({ delay, nextStep }) => {
            const timer = setTimeout(() => {
                setStep(nextStep);
            }, delay);
            timers.push(timer);
        });

        return () => timers.forEach(clearTimeout);
    }, []);

    const renderItems = (count: number, groupId: 'left' | 'right') => {
        return Array.from({ length: count }).map((_, i) => (
            <motion.div
                key={`${groupId}-${i}`}
                initial={{ scale: 0, rotate: -180 }}
                animate={{
                    scale: 1,
                    rotate: 0,
                    x: step === 'merge' || step === 'finish' ?
                        (groupId === 'left' ? 100 : -100) : 0,
                    y: step === 'merge' || step === 'finish' ? 20 : 0
                }}
                transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: i * 0.1
                }}
                className="text-6xl md:text-7xl filter drop-shadow-lg"
            >
                {itemEmoji}
            </motion.div>
        ));
    };

    return (
        <div className="relative w-full min-h-[350px] bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 rounded-3xl p-6 overflow-hidden border-4 border-orange-200">
            {/* Background Decorations */}
            <div className="absolute top-4 right-4 text-4xl opacity-20 animate-bounce">✨</div>
            <div className="absolute bottom-4 left-4 text-4xl opacity-20 animate-pulse">🌟</div>

            {/* Lottie Teacher Character */}
            <motion.div
                initial={{ x: -200, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", duration: 1 }}
                className="absolute left-8 top-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40"
            >
                <img
                    src="/teacher_robot.png"
                    alt="AI Teacher"
                    className="w-full h-full object-contain"
                />
            </motion.div>

            {/* Main Content Area */}
            <div className="flex flex-col items-center justify-center h-full pt-12 w-full z-10 relative">
                <AnimatePresence mode="wait">
                    {step === 'finish' ? (
                        <motion.div
                            key="finish"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="flex flex-col items-center gap-4"
                        >
                            <div className="text-2xl font-bold text-orange-600 mb-2">
                                {total}개는 10개씩 묶어볼까요?
                            </div>
                            <div className="flex flex-wrap justify-center gap-4">
                                {/* Ten Frames Logic */}
                                {Array.from({ length: Math.ceil(total / 10) }).map((_, frameIdx) => {
                                    const isLastFrame = frameIdx === Math.ceil(total / 10) - 1;
                                    const countInFrame = isLastFrame && total % 10 !== 0 ? total % 10 : 10;

                                    return (
                                        <div key={frameIdx} className="bg-white/60 p-3 rounded-2xl border-4 border-orange-300 shadow-sm">
                                            <div className="grid grid-cols-5 gap-2">
                                                {Array.from({ length: 10 }).map((_, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-2xl md:text-3xl ${idx < countInFrame ? 'opacity-100 scale-100' : 'opacity-20 scale-75 grayscale'}`}
                                                    >
                                                        {idx < countInFrame ? itemEmoji : '⚪'}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-4xl font-black text-orange-600 mt-2 bg-white px-6 py-2 rounded-full shadow-lg"
                            >
                                정답은 {total}! 🎉
                            </motion.div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="animating"
                            className="flex items-center justify-center gap-4 md:gap-16 w-full"
                        >
                            {/* Left Group */}
                            <div className="flex flex-wrap justify-center gap-2 w-1/3 min-w-[100px]">
                                {(step === 'init' || step === 'showLeft' || step === 'showRight' || step === 'merge') &&
                                    renderItems(count1, 'left')}
                            </div>

                            {/* Operator */}
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                className="text-4xl md:text-6xl font-black text-slate-400"
                            >
                                {operator}
                            </motion.div>

                            {/* Right Group */}
                            <div className="flex flex-wrap justify-center gap-2 w-1/3 min-w-[100px]">
                                {(step === 'showRight' || step === 'merge') &&
                                    renderItems(count2, 'right')}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
