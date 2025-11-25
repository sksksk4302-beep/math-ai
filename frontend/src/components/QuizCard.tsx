'use client';

import { motion } from 'framer-motion';

interface QuizCardProps {
    question: string;
    onAnswer: (answer: string) => void;
}

export default function QuizCard({ question, onAnswer }: QuizCardProps) {
    return (
        <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full border-4 border-purple-200"
        >
            <h2 className="text-4xl font-bold text-center mb-8 text-purple-600">
                {question}
            </h2>

            <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((num) => (
                    <motion.button
                        key={num}
                        whileHover={{ scale: 1.05, backgroundColor: '#F3E8FF' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onAnswer(num.toString())}
                        className="p-6 text-2xl font-bold rounded-xl border-2 border-purple-100 text-purple-800 hover:border-purple-300 transition-colors"
                    >
                        {num}
                    </motion.button>
                ))}
            </div>
        </motion.div>
    );
}
