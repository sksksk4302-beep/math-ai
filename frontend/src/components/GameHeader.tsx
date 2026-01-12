import { motion, AnimatePresence } from 'framer-motion';
import { Stats } from '../lib/types';

interface GameHeaderProps {
    stats: Stats;
    stickerIncrement: number;
    isListening: boolean;
}

export default function GameHeader({ stats, stickerIncrement, isListening }: GameHeaderProps) {
    return (
        <header className="sticky top-0 z-50 flex justify-between items-center mb-6 md:mb-12 py-2 bg-[#FFF9F0]/90 backdrop-blur-sm transition-all duration-300">
            <div className="flex items-center gap-2 md:gap-4">
                <div className="w-10 h-10 md:w-16 md:h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center text-2xl md:text-4xl border-2 border-orange-100">
                    🎓
                </div>
                <div>
                    <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight">
                        AI 수학 선생님
                    </h1>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">
                        재미있는 수학 놀이
                    </p>
                </div>
            </div>

            {/* Stats Card with Mic Status */}
            <div className="flex items-center gap-2 md:gap-6 bg-white backdrop-blur-sm px-3 py-2 md:px-6 md:py-3 rounded-2xl shadow-sm border border-orange-100">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Level</span>
                    <span className="text-lg md:text-2xl font-black text-orange-500">
                        {stats.level || 1}
                    </span>
                </div>
                <div className="w-px h-6 md:h-8 bg-slate-200" />
                <div className="flex flex-col items-center relative">
                    <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Total</span>
                    <div className="flex items-center gap-1">
                        <span className="text-lg md:text-2xl">⭐</span>
                        <span className="text-lg md:text-2xl font-black text-slate-700">
                            {stats.totalStickers || 0}
                        </span>

                        {/* 마이크 상태 표시 */}
                        {isListening && (
                            <span className="text-lg md:text-xl animate-pulse ml-1">
                                🎤
                            </span>
                        )}

                        {/* 별 증가 애니메이션 */}
                        <AnimatePresence>
                            {stickerIncrement > 0 && (
                                <motion.span
                                    key="sticker-inc"
                                    initial={{ opacity: 1, y: 0, scale: 1 }}
                                    animate={{ opacity: 0, y: -30, scale: 1.5 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1 }}
                                    className="absolute top-0 text-2xl font-black text-yellow-500"
                                >
                                    +1
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
}
