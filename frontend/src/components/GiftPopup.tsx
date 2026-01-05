import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface GiftPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function GiftPopup({ isOpen, onClose }: GiftPopupProps) {
    useEffect(() => {
        if (isOpen) {
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

            const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

            const interval: any = setInterval(function () {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);

            return () => clearInterval(interval);
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.5, y: 100 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.5, y: 100 }}
                        className="bg-white rounded-3xl p-8 md:p-12 max-w-lg w-full text-center relative overflow-hidden shadow-2xl border-4 border-yellow-300"
                    >
                        {/* Background Decoration */}
                        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_340deg,#FFD700_360deg)] animate-spin opacity-20" />
                        </div>

                        <div className="relative z-10 flex flex-col items-center gap-6">
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="text-8xl md:text-9xl filter drop-shadow-xl"
                            >
                                🎁
                            </motion.div>

                            <div className="space-y-2">
                                <h2 className="text-3xl md:text-5xl font-black text-slate-800 break-keep leading-tight">
                                    축하해요! <br />
                                    <span className="text-orange-500">별 10개</span> 달성!
                                </h2>
                                <p className="text-xl md:text-2xl font-bold text-slate-500">
                                    한울이 선물 고르세요!! 🎉
                                </p>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full py-4 md:py-5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xl md:text-2xl font-black rounded-2xl shadow-lg shadow-orange-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span>다음 문제 계속하기</span>
                                <span>🚀</span>
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
