'use client';

import { motion } from 'framer-motion';

interface CountingProps {
    items: string[];
}

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
    'default': '🟣'
};

export default function Counting({ items }: CountingProps) {
    return (
        <div className="flex flex-wrap justify-center gap-4 p-4">
            {items.map((item, index) => (
                <motion.div
                    key={index}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        delay: index * 0.1
                    }}
                    className="text-5xl md:text-6xl filter drop-shadow-lg cursor-pointer hover:scale-110 transition-transform"
                >
                    {itemMap[item] || itemMap['default']}
                </motion.div>
            ))}
        </div>
    );
}
