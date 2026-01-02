import React from 'react';
import { motion } from 'framer-motion';

interface IntroScreenProps {
    onStartNew: () => void;
    onContinue: () => void;
    hasHistory: boolean;
    userName: string;
}

export default function IntroScreen({ onStartNew, onContinue, hasHistory, userName }: IntroScreenProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF9F0] p-4 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-yellow-300/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bg-orange-300/30 rounded-full blur-3xl animate-pulse delay-700" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="z-10 flex flex-col items-center gap-8 md:gap-12 max-w-md w-full"
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-3xl shadow-xl flex items-center justify-center text-6xl md:text-8xl border-4 border-orange-100 animate-bounce">
                        🎓
                    </div>
                    <div className="text-center">
                        <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight mb-2">
                            AI 수학 선생님
                        </h1>
                        <p className="text-lg md:text-xl text-slate-500 font-bold">
                            안녕, {userName}! 👋
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full">
                    <button
                        onClick={onContinue}
                        disabled={!hasHistory}
                        className={`
                            w-full py-4 md:py-6 rounded-2xl text-xl md:text-2xl font-black shadow-lg transition-all flex items-center justify-center gap-3
                            ${hasHistory
                                ? 'bg-white text-orange-500 border-2 border-orange-200 hover:bg-orange-50 active:scale-95'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
                        `}
                    >
                        <span>이어하기</span>
                        <span>🚀</span>
                    </button>

                    <button
                        onClick={onStartNew}
                        className="w-full py-4 md:py-6 bg-gradient-to-b from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-2xl text-xl md:text-2xl font-black shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <span>새로 시작하기</span>
                        <span>✨</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
