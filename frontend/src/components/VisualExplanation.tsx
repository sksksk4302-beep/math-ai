'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('react-lottie-player'), { ssr: false });

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
                <Lottie
                    loop
                    play
                    path="https://lottie.host/4db68bbd-31f6-4cd8-b52c-a7d1e7c1e8c4/zxfPFJo3f9.json"
                    style={{ width: '100%', height: '100%' }}
                />
            </motion.div>

            {/* Main Animation Area */}
            <div className="flex flex-col items-center justify-center h-full pt-12">
                {/* Equation Display */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl md:text-5xl font-black text-slate-700 mb-12"
                >
                    {count1} {operator} {count2} = ?
                </motion.div>

                {/* Objects Animation */}
                <div className="flex gap-16 items-center justify-center mb-8">
                    {/* Left Group */}
                    <AnimatePresence>
                        {(step === 'showLeft' || step === 'showRight' || step === 'merge' || step === 'finish') && (
                            <motion.div
                                layout
                                className="flex flex-wrap gap-3 justify-center max-w-xs"
                            >
                                {renderItems(count1, 'left')}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Operator */}
                    <AnimatePresence>
                        {(step === 'showRight' || step === 'merge' || step === 'finish') && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{
                                    scale: step === 'merge' || step === 'finish' ? 0 : 1,
                                    opacity: step === 'merge' || step === 'finish' ? 0 : 1
                                }}
                                className="text-6xl font-black text-orange-500"
                            >
                                {operator}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Right Group */}
                    <AnimatePresence>
                        {(step === 'showRight' || step === 'merge' || step === 'finish') && operator === '+' && (
                            <motion.div
                                layout
                                className="flex flex-wrap gap-3 justify-center max-w-xs"
                            >
                                {renderItems(count2, 'right')}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Result Display */}
                <AnimatePresence>
                    {step === 'finish' && (
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200 }}
                            className="mt-8"
                        >
                            <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white px-12 py-6 rounded-full shadow-2xl border-4 border-white">
                                <span className="text-6xl font-black">= {total}</span>
                            </div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-center mt-4 text-2xl font-bold text-green-600"
                            >
                                정답은 {total}개야! 🎉
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
