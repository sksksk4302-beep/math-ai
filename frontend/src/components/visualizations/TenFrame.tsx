'use client';

import { motion } from 'framer-motion';

interface TenFrameProps {
    items: string[];
}

const itemMap: Record<string, string> = {
    'apple': '🍎',
    'star': '⭐',
    'dinosaur': '🦕',
    'car': '🚗',
    'candy': '🍬',
    'bus_seat': '👤', // 버스 좌석에는 사람
    'chocolate': '🍫',
    'default': '🔵'
};

export default function TenFrame({ items }: TenFrameProps) {
    // 10칸을 미리 만들어두고 채우는 방식
    const frames = Array(10).fill(null);

    return (
        <div className="bg-orange-100 p-4 rounded-3xl border-4 border-orange-300 shadow-inner max-w-md mx-auto">
            <div className="grid grid-cols-5 gap-2 md:gap-4">
                {frames.map((_, index) => {
                    const item = items[index];
                    return (
                        <div
                            key={index}
                            className="aspect-square bg-white rounded-xl border-2 border-orange-200 flex items-center justify-center shadow-sm"
                        >
                            {item && (
                                <motion.div
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{
                                        type: "spring",
                                        bounce: 0.5,
                                        delay: index * 0.15
                                    }}
                                    className="text-3xl md:text-4xl"
                                >
                                    {itemMap[item] || itemMap['default']}
                                </motion.div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
