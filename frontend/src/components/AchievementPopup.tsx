'use client';

import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface AchievementPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AchievementPopup({ isOpen, onClose }: AchievementPopupProps) {
    useEffect(() => {
        if (isOpen) {
            // 폭죽 효과 여러 번 발사
            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 50,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.6 },
                    colors: ['#FFD700', '#FF69B4', '#00BFFF', '#FF6347', '#32CD32']
                });
                confetti({
                    particleCount: 50,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.6 },
                    colors: ['#FFD700', '#FF69B4', '#00BFFF', '#FF6347', '#32CD32']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.5, opacity: 0, y: 50 }}
                        transition={{ type: 'spring', duration: 0.5, bounce: 0.4 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        {/* 헤더 - 별과 반짝임 효과 */}
                        <div className="relative bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-500 p-8 md:p-12">
                            <motion.div
                                initial={{ rotate: -180, scale: 0 }}
                                animate={{ rotate: 0, scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring', duration: 0.8 }}
                                className="text-8xl md:text-9xl text-center mb-4"
                            >
                                🎁
                            </motion.div>

                            {/* 떠다니는 별들 */}
                            {[...Array(6)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{
                                        opacity: [0, 1, 0],
                                        scale: [0, 1.5, 0],
                                        y: [0, -30, -60],
                                        x: [0, (i % 2 === 0 ? 20 : -20), (i % 2 === 0 ? 40 : -40)]
                                    }}
                                    transition={{
                                        delay: 0.3 + i * 0.1,
                                        duration: 2,
                                        repeat: Infinity,
                                        repeatDelay: 1
                                    }}
                                    className="absolute text-3xl md:text-4xl"
                                    style={{
                                        left: `${15 + i * 15}%`,
                                        bottom: '20%'
                                    }}
                                >
                                    ⭐
                                </motion.div>
                            ))}
                        </div>

                        {/* 내용 */}
                        <div className="p-6 md:p-8 text-center">
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-3xl md:text-4xl font-black text-slate-800 mb-3"
                            >
                                목표 달성! 🎉
                            </motion.h2>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="text-lg md:text-xl text-slate-600 font-bold mb-2"
                            >
                                25문제를 모두 맞혔어요!
                            </motion.p>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="text-base md:text-lg text-orange-500 font-bold mb-6"
                            >
                                선물을 받을 자격이 있어요! 🎁
                            </motion.p>

                            {/* 별 스티커 모음 애니메이션 */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.7 }}
                                className="flex flex-wrap justify-center gap-2 mb-6"
                            >
                                {[...Array(25)].map((_, i) => (
                                    <motion.span
                                        key={i}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{
                                            delay: 0.8 + i * 0.02,
                                            type: 'spring',
                                            stiffness: 200
                                        }}
                                        className="text-2xl"
                                    >
                                        ⭐
                                    </motion.span>
                                ))}
                            </motion.div>

                            {/* 확인 버튼 */}
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.2 }}
                                onClick={onClose}
                                className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xl font-black rounded-2xl shadow-lg hover:from-orange-600 hover:to-pink-600 active:scale-95 transition-all"
                            >
                                확인 ✨
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
