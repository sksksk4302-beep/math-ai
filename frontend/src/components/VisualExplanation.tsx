import React from 'react';
import { motion } from 'framer-motion';

interface VisualExplanationProps {
    count1: number;
    count2: number;
    operator: '+' | '-';
    visualItems: string[];
}

const ITEM_EMOJIS: Record<string, string> = {
    apple: '🍎', star: '⭐', dinosaur: '🦖', car: '🚗',
    candy: '🍬', bus: '🚌', flower: '🌸', pencil: '✏️', coin: '🪙'
};

export default function VisualExplanation({ count1, count2, operator, visualItems, isDetective }: VisualExplanationProps & { isDetective?: boolean }) {
    const total = operator === '+' ? count1 + count2 : count1 - count2;
    const itemEmoji = ITEM_EMOJIS[visualItems[0]] || '🍎';

    // 10개씩 묶어 세기 (Ten Frame)
    if (total > 10) {
        return (
            <div className="flex flex-col items-center gap-8 w-full">
                <div className="text-2xl font-bold text-orange-600 mb-2 text-center">
                    {isDetective
                        ? `전체 ${total}개에서 ${count1}개를 빼면 몇 개가 남을까요?`
                        : (total >= 10 ? `${total}개는 10개씩 묶어볼까요?` : `모두 합치면 몇 개일까요?`)}
                </div>

                <div className="flex flex-wrap justify-center gap-8">
                    {/* First Ten Frame (Full) */}
                    <div className="grid grid-cols-5 gap-2 bg-slate-200 p-4 rounded-xl border-4 border-slate-300">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <motion.div
                                key={`ten-${i}`}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="w-12 h-12 flex items-center justify-center text-3xl bg-white rounded-lg shadow-sm"
                            >
                                {itemEmoji}
                            </motion.div>
                        ))}
                    </div>

                    {/* Remaining Items */}
                    {total > 10 && (
                        <div className="grid grid-cols-5 gap-2 bg-slate-200 p-4 rounded-xl border-4 border-slate-300">
                            {Array.from({ length: total - 10 }).map((_, i) => (
                                <motion.div
                                    key={`rem-${i}`}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 1 + (i * 0.1) }}
                                    className="w-12 h-12 flex items-center justify-center text-3xl bg-white rounded-lg shadow-sm"
                                >
                                    {itemEmoji}
                                </motion.div>
                            ))}
                            {/* Empty slots to fill grid */}
                            {Array.from({ length: 10 - (total - 10) }).map((_, i) => (
                                <div key={`empty-${i}`} className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-300" />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 기본 나열 (Counting)
    return (
        <div className="flex flex-col items-center gap-8 w-full">
            <div className="text-2xl font-bold text-orange-600 mb-2 text-center">
                {isDetective
                    ? `전체 ${total}개 중에서 숨어있던 ${count2}개를 찾았어요!`
                    : (total < 10 ? "모두 합치면 몇 개일까요?" : "하나씩 세어볼까요?")}
            </div>

            <div className="flex flex-wrap justify-center gap-4 max-w-md">
                {Array.from({ length: total }).map((_, i) => {
                    // 탐정 모드일 때, 두 번째 숫자(count2)에 해당하는 아이템들 강조
                    // 예: 2 + 3 = 5 이면, 인덱스 2, 3, 4 (0, 1은 count1)
                    const isHiddenPart = isDetective && (i >= count1);

                    return (
                        <motion.div
                            key={i}
                            initial={{ scale: 0, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 260,
                                damping: 20,
                                delay: i * 0.15
                            }}
                            className={`w-16 h-16 flex items-center justify-center text-5xl rounded-2xl shadow-md border-b-4 
                                ${isHiddenPart
                                    ? 'bg-yellow-100 border-yellow-300 ring-4 ring-yellow-200 animate-pulse'
                                    : 'bg-white border-slate-100'}`}
                        >
                            {isHiddenPart && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1.5, opacity: [0, 1, 0] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="absolute text-2xl"
                                >
                                    ✨
                                </motion.span>
                            )}
                            {itemEmoji}
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.15 + 0.2 }}
                                className={`absolute -top-2 -right-2 w-6 h-6 text-xs rounded-full flex items-center justify-center font-bold
                                    ${isHiddenPart ? 'bg-yellow-500 text-white' : 'bg-orange-500 text-white'}`}
                            >
                                {i + 1}
                            </motion.span>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
