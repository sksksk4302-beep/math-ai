import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface LevelUpPopupProps {
    isOpen: boolean;
    level: number;
    userName: string;
    onClose: () => void;
}

export default function LevelUpPopup({ isOpen, level, userName, onClose }: LevelUpPopupProps) {
    useEffect(() => {
        if (isOpen) {
            // 폭죽 발사
            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#FFD700', '#FFA500', '#FF69B4']
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#FFD700', '#FFA500', '#FF69B4']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();

            // 3초 후 자동 닫기
            const timer = setTimeout(() => {
                onClose();
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 100 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.5, opacity: 0, y: -100 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="bg-gradient-to-br from-orange-400 to-pink-500 rounded-3xl p-8 md:p-12 shadow-2xl max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center gap-6 text-white">
                            {/* 레벨 배지 */}
                            <motion.div
                                initial={{ rotate: -180, scale: 0 }}
                                animate={{ rotate: 0, scale: 1 }}
                                transition={{ delay: 0.2, type: "spring" }}
                                className="relative"
                            >
                                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl">
                                    <span className="text-6xl font-black text-orange-500">
                                        Lv.{level}
                                    </span>
                                </div>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute -top-2 -right-2 text-5xl"
                                >
                                    ✨
                                </motion.div>
                            </motion.div>

                            {/* 메시지 */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-center"
                            >
                                <h2 className="text-3xl md:text-4xl font-black mb-2">
                                    🎉 레벨업! 🎉
                                </h2>
                                <p className="text-xl md:text-2xl font-bold">
                                    {userName}아, 레벨업 축하해!
                                </p>
                                <p className="text-lg mt-2 opacity-90">
                                    이제 더 어려운 문제에 도전해보자!
                                </p>
                            </motion.div>

                            {/* 별 애니메이션 */}
                            <div className="flex gap-2">
                                {[...Array(5)].map((_, i) => (
                                    <motion.span
                                        key={i}
                                        initial={{ opacity: 0, scale: 0, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ delay: 0.5 + i * 0.1 }}
                                        className="text-4xl"
                                    >
                                        ⭐
                                    </motion.span>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
