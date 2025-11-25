'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import Counting from '../components/visualizations/Counting';
import TenFrame from '../components/visualizations/TenFrame';

// Types
interface Problem {
    id: string;
    problem: string;
    answer: number;
    level: number;
}

interface Stats {
    level: number;
    stickers: number;
    totalStickers: number;
}

interface Explanation {
    message: string;
    animation_type: string;
    visual_items: string[];
    correct_answer: number;
}

const INITIAL_PROBLEM: Problem = {
    id: 'init-1',
    problem: '2 + 3',
    answer: 5,
    level: 1
};

export default function Home() {
    // State
    const [user] = useState("test_user_1");
    const [userName] = useState("한울이");
    const [problem, setProblem] = useState<Problem | null>(INITIAL_PROBLEM);
    const [nextProblem, setNextProblem] = useState<Problem | null>(null);
    const [stats, setStats] = useState<Stats>({ level: 1, stickers: 0, totalStickers: 0 });
    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState<string>('');
    const [explanation, setExplanation] = useState<Explanation | null>(null);
    const [loading, setLoading] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [shake, setShake] = useState(false);

    // Initial Load
    useEffect(() => {
        prefetchProblem();
    }, []);

    // Logic
    const prefetchProblem = async () => {
        try {
            const res = await fetch('http://localhost:8000/generate-problem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user })
            });
            const data = await res.json();
            console.log("✨ Prefetched:", data.problem);
            setNextProblem(data);
        } catch (error) {
            console.error("Prefetch failed:", error);
        }
    };

    const fetchProblem = async () => {
        setLoading(true);
        setFeedback('');
        setExplanation(null);
        setIsCorrect(null);
        setUserAnswer('');

        try {
            const res = await fetch('http://localhost:8000/generate-problem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user })
            });
            const data = await res.json();
            setProblem(data);

            // Sync stats from backend response
            if (data.level) {
                setStats({
                    level: data.level,
                    stickers: data.stickers || 0,
                    totalStickers: data.total_stickers || 0
                });
            }

            prefetchProblem();
        } catch (error) {
            console.error("Fetch failed:", error);
            setFeedback("잠시 문제가 생겼어요 🔧");
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = async (newLevel: number) => {
        try {
            await fetch('http://localhost:8000/update-level', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user, new_level: newLevel })
            });
            // Force fetch new problem for the new level
            fetchProblem();
        } catch (error) {
            console.error("Level update failed:", error);
        }
    };

    const handleNextProblem = (forceRefresh = false) => {
        if (forceRefresh || !nextProblem) {
            fetchProblem();
            return;
        }
        setLoading(true);
        setFeedback('');
        setExplanation(null);
        setIsCorrect(null);
        setUserAnswer('');
        setProblem(nextProblem);

        // Update stats from prefetched problem if available
        if (nextProblem.level) {
            setStats(prev => ({
                ...prev,
                level: nextProblem.level,
            }));
        }

        setNextProblem(null);
        setLoading(false);
        prefetchProblem();
    };

    const checkAnswer = async () => {
        if (!problem || !userAnswer) return;

        const answerNum = parseInt(userAnswer);
        const correct = answerNum === problem.answer;
        setIsCorrect(correct);

        if (correct) {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700', '#FF69B4', '#00BFFF'] });
            setFeedback("정답입니다! 🎉");

            try {
                const res = await fetch('http://localhost:8000/submit-result', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user, problem_id: problem.id, is_correct: true })
                });
                const data = await res.json();
                setStats({ level: data.new_level, stickers: data.level_stickers, totalStickers: data.total_stickers });

                if (data.levelup_event) {
                    setFeedback("레벨 업! 🚀");
                    confetti({ particleCount: 300, spread: 120 });
                }

                setTimeout(() => handleNextProblem(data.levelup_event), 1500);
            } catch (error) {
                console.error("Submit failed:", error);
            }
        } else {
            setShake(true);
            setTimeout(() => setShake(false), 500);
            setLoading(true);
            try {
                await fetch('http://localhost:8000/submit-result', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user, problem_id: problem.id, is_correct: false })
                });

                const res = await fetch('http://localhost:8000/explain-error', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ problem: problem.problem, wrong_answer: userAnswer, user_name: userName })
                });
                const data = await res.json();
                setExplanation(data);
                setFeedback("");
            } catch (error) {
                console.error("Explain failed:", error);
                setFeedback("선생님이 잠깐 쉬고 계세요 😴");
            } finally {
                setLoading(false);
            }
        }
    };

    const renderVisualization = () => {
        if (!explanation?.visual_items) return null;
        return explanation.animation_type === 'ten_frame'
            ? <TenFrame items={explanation.visual_items} />
            : <Counting items={explanation.visual_items} />;
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 font-sans flex flex-col overflow-hidden relative">
            {/* Background Decorations */}
            <div className="absolute top-10 left-10 text-6xl opacity-20 animate-bounce">☁️</div>
            <div className="absolute bottom-20 right-20 text-6xl opacity-20 animate-pulse">🌟</div>
            <div className="absolute top-1/3 right-10 text-4xl opacity-10 rotate-12">✏️</div>
            <div className="absolute bottom-1/3 left-10 text-4xl opacity-10 -rotate-12">📐</div>

            {/* Header */}
            <header className="p-6 flex justify-between items-center max-w-5xl mx-auto w-full z-10">
                <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border-2 border-white">
                    <span className="text-3xl">🎓</span>
                    <h1 className="text-xl font-bold text-slate-700">AI 수학나라</h1>
                </div>
                <div className="flex gap-4">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="relative flex items-center gap-2 bg-blue-500 text-white px-5 py-2 rounded-full shadow-md border-b-4 border-blue-700 cursor-pointer group"
                    >
                        <span className="font-bold">Lv.{stats.level}</span>
                        <select
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            value={stats.level}
                            onChange={(e) => handleLevelChange(parseInt(e.target.value))}
                        >
                            {[1, 2, 3, 4, 5].map(lv => (
                                <option key={lv} value={lv}>Level {lv}</option>
                            ))}
                        </select>
                        <span className="text-xs opacity-70 group-hover:opacity-100 transition-opacity">▼</span>
                    </motion.div>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center gap-2 bg-yellow-400 text-yellow-900 px-5 py-2 rounded-full shadow-md border-b-4 border-yellow-600"
                    >
                        <span>⭐️</span>
                        <span className="font-bold">{stats.stickers}</span>
                    </motion.div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-3xl mx-auto z-10">
                <AnimatePresence mode="wait">
                    {problem ? (
                        <motion.div
                            key={problem.id}
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                            className="w-full"
                        >
                            {/* Problem Card */}
                            <div className="bg-white/90 backdrop-blur-md rounded-[3rem] shadow-2xl p-8 md:p-12 border-4 border-white text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"></div>

                                <h2 className="text-7xl md:text-9xl font-black text-slate-700 mb-12 tracking-tight drop-shadow-sm font-mono">
                                    {problem.problem} <span className="text-gray-300">=</span> <span className="text-blue-500">?</span>
                                </h2>

                                {/* Interaction Area */}
                                <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-8">
                                    <motion.input
                                        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
                                        type="number"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                                        placeholder="?"
                                        className={`
                                            w-40 h-40 text-6xl font-bold text-center rounded-3xl border-4 outline-none shadow-inner transition-all
                                            ${isCorrect === true ? 'border-green-400 bg-green-50 text-green-600' :
                                                isCorrect === false ? 'border-red-300 bg-red-50 text-red-500' :
                                                    'border-blue-100 focus:border-blue-400 bg-blue-50/50 text-slate-700'}
                                        `}
                                        disabled={loading || isCorrect === true}
                                        autoFocus
                                    />
                                    <motion.button
                                        whileHover={{ scale: 1.05, translateY: -2 }}
                                        whileTap={{ scale: 0.95, translateY: 2 }}
                                        onClick={checkAnswer}
                                        disabled={loading || isCorrect === true}
                                        className={`
                                            h-40 px-10 rounded-3xl text-3xl font-black text-white shadow-[0_8px_0_rgb(0,0,0,0.2)] border-b-0 transition-all
                                            ${loading ? 'bg-gray-400 cursor-wait' :
                                                isCorrect === true ? 'bg-green-500 shadow-green-700' :
                                                    'bg-gradient-to-b from-orange-400 to-orange-500 shadow-orange-700 hover:shadow-orange-600'}
                                        `}
                                    >
                                        {loading ? '...' : '정답!'}
                                    </motion.button>
                                </div>

                                {/* Feedback Message */}
                                <div className="h-12">
                                    {feedback && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`text-2xl font-bold ${isCorrect ? 'text-green-500' : 'text-orange-500'}`}
                                        >
                                            {feedback}
                                        </motion.div>
                                    )}
                                </div>
                            </div>

                            {/* AI Explanation Bubble */}
                            <AnimatePresence>
                                {explanation && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 50, scale: 0.8 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="mt-8 bg-white rounded-3xl p-6 shadow-xl border-4 border-blue-100 relative max-w-2xl mx-auto"
                                    >
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border-t-4 border-l-4 border-blue-100 rotate-45"></div>
                                        <div className="flex gap-6 items-start">
                                            <div className="text-6xl bg-blue-50 p-2 rounded-2xl">🤖</div>
                                            <div className="flex-1 text-left">
                                                <h3 className="font-bold text-blue-500 mb-2">AI 선생님의 힌트</h3>
                                                <p className="text-xl text-slate-600 leading-relaxed whitespace-pre-wrap mb-4">
                                                    {explanation.message}
                                                </p>
                                                {explanation.visual_items && (
                                                    <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-100">
                                                        {renderVisualization()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                        </motion.div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 opacity-50">
                            <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-xl font-bold text-blue-400">문제를 만들고 있어요...</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
