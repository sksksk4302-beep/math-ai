'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import Counting from '../components/visualizations/Counting';
import TenFrame from '../components/visualizations/TenFrame';
import VisualExplanation from '../components/VisualExplanation';

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
    audio_base64?: string;
    problem?: string; // Add optional problem field
}

const INITIAL_PROBLEM: Problem = {
    id: 'init-1',
    problem: '2 + 3',
    answer: 5,
    level: 1
};

// Helper function to parse problem string
function parseProblem(problemStr: string): { num1: number; num2: number; operator: '+' | '-' } | null {
    const match = problemStr.match(/(\d+)\s*([+\-])\s*(\d+)/);
    if (!match) return null;
    return {
        num1: parseInt(match[1]),
        operator: match[2] as '+' | '-',
        num2: parseInt(match[3])
    };
}

export default function Home() {
    // State
    // Generate unique session ID on mount for reset behavior
    const [user] = useState(() => {
        if (typeof window !== 'undefined') {
            return "user_" + Math.random().toString(36).substr(2, 9);
        }
        return "test_user_1";
    });
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
    const [correctCount, setCorrectCount] = useState(0);
    const TOTAL_GOAL = 30;
    // Gift threshold removed as per request
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [showText, setShowText] = useState(false);
    const [showTimeoutTransition, setShowTimeoutTransition] = useState(false);

    // 1. Reset & Start Timer when problem changes
    useEffect(() => {
        if (problem) {
            // New Rule: Base 10s + 10s per level
            const limit = 10 + (problem.level - 1) * 10;
            setTimeLeft(limit);
            setTimerActive(true);
        }
    }, [problem]);

    // 2. Countdown Logic
    useEffect(() => {
        if (!timerActive) return;

        if (timeLeft === 0) {
            handleTimeOver();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, timerActive]);

    const handleTimeOver = async () => {
        setTimerActive(false);
        setShowTimeoutTransition(true);

        // Play Teacher Voice
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://math-ai-backend-div6osazmq-uc.a.run.app';
            const res = await fetch(`${apiUrl}/timeout-audio`, { cache: 'no-store' });
            const data = await res.json();
            if (data.audio_base64) {
                playAudio(data.audio_base64);
            }
        } catch (e) {
            console.error("Timeout audio failed:", e);
        }

        // Wait for audio (approx 3.5s) then transition
        setTimeout(() => {
            setShowTimeoutTransition(false);
            setFeedback("시간 초과! 땡! ⏰");
            checkAnswer(undefined, true);
        }, 3500);
    };

    // Audio Autoplay
    useEffect(() => {
        if (audioUrl) {
            const audio = new Audio(audioUrl);
            audio.play().catch(e => console.error("Audio play failed:", e));
        }
    }, [audioUrl]);

    const playAudio = (base64Audio: string) => {
        const url = `data:audio/mp3;base64,${base64Audio}`;
        setAudioUrl(url);
    };

    const startListening = () => {
        setIsListening(true);

        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.lang = 'ko-KR';
            recognition.continuous = false; // Changed to false for better one-shot interaction
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => {
                setIsListening(false);
                // Auto-restart for continuous listening experience
                // using a small delay to prevent rapid-fire loops if erroring
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch (e) {
                        // ignore if already started
                    }
                }, 300);
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                const number = transcript.replace(/[^0-9]/g, '');
                if (number) {
                    setUserAnswer(number);
                    checkAnswer(number);
                }
            };

            try {
                recognition.start();
            } catch (e) {
                console.error("Mic start error:", e);
                setIsListening(false);
            }
        } else {
            // Fallback: MediaRecorder -> Backend STT
            handleVoiceRecord();
        }
    };

    const handleVoiceRecord = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            const audioChunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');

                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://math-ai-backend-div6osazmq-uc.a.run.app';
                    const res = await fetch(`${apiUrl}/stt`, {
                        method: 'POST',
                        body: formData,
                        cache: 'no-store'
                    });
                    const data = await res.json();
                    if (data.number) {
                        setUserAnswer(data.number);
                        checkAnswer(data.number);
                    }
                } catch (e) {
                    console.error("STT Failed:", e);
                }
                setIsListening(false);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();

            // Record for 2.5 seconds
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 2500);

        } catch (e) {
            console.error("Mic access denied:", e);
            setIsListening(false);
        }
    };

    // Initial Load & Mic Start
    useEffect(() => {
        prefetchProblem();
        startListening();
    }, []);

    // Logic
    const prefetchProblem = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://math-ai-backend-div6osazmq-uc.a.run.app';
            const res = await fetch(`${apiUrl}/generate-problem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user }),
                cache: 'no-store'
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
        setShowText(false);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://math-ai-backend-div6osazmq-uc.a.run.app';
            const res = await fetch(`${apiUrl}/generate-problem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user }),
                cache: 'no-store'
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://math-ai-backend-div6osazmq-uc.a.run.app';
            await fetch(`${apiUrl}/update-level`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user, new_level: newLevel }),
                cache: 'no-store'
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
        setShowText(false);
        setProblem(nextProblem);

        setNextProblem(null);
        setLoading(false);
        prefetchProblem();
    };

    const checkAnswer = async (answerOverride?: string, isTimeout = false) => {
        if (!problem) return;
        if (!isTimeout && (!answerOverride && !userAnswer)) return;

        setTimerActive(false); // Stop timer

        let correct = false;
        let answerNum = 0;

        if (!isTimeout) {
            const answerToCheck = answerOverride || userAnswer;
            answerNum = parseInt(answerToCheck);
            correct = answerNum === problem.answer;
        }

        setIsCorrect(correct);

        if (correct) {
            setCorrectCount(prev => prev + 1);
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700', '#FF69B4', '#00BFFF'] });
            setFeedback("정답입니다! 🎉");

            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://math-ai-backend-div6osazmq-uc.a.run.app';
                const res = await fetch(`${apiUrl}/submit-result`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user, problem_id: problem.id, is_correct: true }),
                    cache: 'no-store'
                });
                const data = await res.json();
                setStats({ level: data.new_level, stickers: data.level_stickers, totalStickers: data.total_stickers });

                if (data.new_level > stats.level) {
                    setFeedback(`Lv.${data.new_level}로 넘어가겠습니다!! 🚀`);
                    playAudio(data.audio_base64); // Play level up audio if available
                } else if (data.levelup_event) {
                    setFeedback("레벨 업! 🚀");
                }

                if (data.audio_base64) {
                    playAudio(data.audio_base64);
                }

                setTimeout(() => handleNextProblem(data.levelup_event), 2000);
            } catch (error) {
                console.error("Submit failed:", error);
                setTimeout(() => handleNextProblem(false), 1500);
            }
        } else {
            setShake(true);
            setTimeout(() => setShake(false), 500);
            setLoading(true);
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://math-ai-backend-div6osazmq-uc.a.run.app';
                await fetch(`${apiUrl}/submit-result`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user, problem_id: problem.id, is_correct: false }),
                    cache: 'no-store'
                });

                const res = await fetch(`${apiUrl}/explain-error`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        problem: problem.problem,
                        wrong_answer: isTimeout ? "시간초과" : (answerOverride || userAnswer),
                        user_name: userName
                    }),
                    cache: 'no-store'
                });
                const data = await res.json();
                // Inject problem string into explanation data
                setExplanation({ ...data, problem: problem.problem });
                if (data.audio_base64) {
                    playAudio(data.audio_base64);
                }
                setFeedback(isTimeout ? "시간이 다 됐어요! 😅" : "");
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
        <main className="min-h-[100dvh] bg-[#FFF9F0] font-sans selection:bg-orange-200 selection:text-orange-900 relative">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-yellow-300/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bg-orange-300/30 rounded-full blur-3xl animate-pulse delay-700" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-4 md:px-8 md:py-8 min-h-screen flex flex-col">
                {/* Header */}
                <header className="flex justify-between items-center mb-6 md:mb-12">
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

                    {/* Stats Card */}
                    <div className="flex items-center gap-2 md:gap-6 bg-white/80 backdrop-blur-sm px-3 py-2 md:px-6 md:py-3 rounded-2xl shadow-sm border border-orange-100 mb-0 md:mb-0">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Level</span>
                            <span className="text-lg md:text-2xl font-black text-orange-500">
                                {stats.level}
                            </span>
                        </div>
                        <div className="w-px h-6 md:h-8 bg-slate-200" />
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Stickers</span>
                            <div className="flex items-center gap-1">
                                <span className="text-lg md:text-2xl">⭐</span>
                                <span className="text-lg md:text-2xl font-black text-slate-700">
                                    {stats.stickers}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto">
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center gap-4 md:gap-6"
                            >
                                <div className="w-16 h-16 md:w-24 md:h-24 border-4 md:border-8 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                                <p className="text-lg md:text-2xl font-bold text-slate-600 animate-pulse">
                                    문제를 만들고 있어요... 🎨
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="quiz"
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: -20 }}
                                className="w-full"
                            >
                                <div className="bg-white rounded-3xl shadow-xl border-4 border-white overflow-hidden relative">
                                    {/* Decorative Top Bar */}
                                    <div className="h-3 md:h-4 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400" />

                                    <div className="p-6 md:p-12 flex flex-col items-center gap-6 md:gap-10">
                                        {/* Problem Display */}
                                        <div className="flex flex-col items-center gap-2 md:gap-4">
                                            <span className="px-3 py-1 md:px-4 md:py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs md:text-sm font-bold tracking-wide">
                                                문제 {stats.totalStickers + 1}
                                            </span>
                                            <h2 className="text-5xl md:text-8xl font-black text-slate-800 tracking-tighter drop-shadow-sm">
                                                {problem?.problem}
                                            </h2>
                                        </div>

                                        {/* Input Area */}
                                        <div className="w-full max-w-xs md:max-w-sm relative group">
                                            <input
                                                type="number"
                                                value={userAnswer}
                                                onChange={(e) => setUserAnswer(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                                                placeholder="?"
                                                className="w-full h-16 md:h-24 text-center text-3xl md:text-5xl font-bold bg-slate-50 border-4 border-slate-200 rounded-2xl focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all outline-none placeholder-slate-300"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                <span className="text-2xl md:text-4xl">✏️</span>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 md:gap-4 w-full">
                                            <button
                                                onClick={() => checkAnswer()}
                                                className="flex-1 bg-gradient-to-b from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white text-lg md:text-2xl font-black py-4 md:py-6 rounded-2xl shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3"
                                            >
                                                <span>정답 확인</span>
                                                <span>🚀</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Feedback Toast */}
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
                    {feedback && (
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            className={`
                                px-6 py-4 md:px-8 md:py-6 rounded-2xl shadow-2xl flex items-center justify-center gap-3 md:gap-4 text-lg md:text-2xl font-bold border-4
                                ${feedback.includes('정답')
                                    ? 'bg-green-500 border-green-400 text-white'
                                    : 'bg-white border-red-100 text-red-500'}
                            `}
                        >
                            {feedback}
                        </motion.div>
                    )}
                </div>
            </div>

            {/* AI Explanation Modal */}
            <AnimatePresence>
                {explanation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
                        onClick={() => {
                            setExplanation(null);
                            fetchProblem();
                        }}
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] md:max-h-[800px] flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <span className="text-2xl md:text-3xl">🤖</span>
                                    <h3 className="text-lg md:text-2xl font-black text-slate-800">
                                        AI 선생님의 설명
                                    </h3>
                                </div>
                                <button
                                    onClick={() => {
                                        setExplanation(null);
                                        fetchProblem();
                                    }}
                                    className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-0">
                                <div className="flex flex-col md:flex-row h-full">
                                    {/* Visual Area */}
                                    <div className="w-full md:w-3/5 bg-slate-50 p-4 md:p-8 flex items-center justify-center min-h-[300px]">
                                        <VisualExplanation
                                            count1={parseInt((explanation.problem || "0+0").split(/[\+\-]/)[0])}
                                            count2={parseInt((explanation.problem || "0+0").split(/[\+\-]/)[1])}
                                            operator={(explanation.problem || "0+0").includes('+') ? '+' : '-'}
                                            visualItems={explanation.visual_items}
                                        />
                                    </div>

                                    {/* Text Area */}
                                    <div className="w-full md:w-2/5 p-4 md:p-8 flex flex-col gap-4 md:gap-6 bg-white">
                                        <div className="bg-orange-50 rounded-2xl p-4 md:p-6 border-2 border-orange-100">
                                            <p className="text-base md:text-lg leading-relaxed text-slate-700 font-medium break-keep">
                                                {explanation.message}
                                            </p>
                                        </div>

                                        {explanation.audio_base64 && (
                                            <button
                                                onClick={() => playAudio(explanation.audio_base64!)}
                                                className="w-full py-3 md:py-4 bg-white border-2 border-orange-200 text-orange-500 rounded-xl font-bold hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <span>🔊</span>
                                                <span>다시 듣기</span>
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                setExplanation(null);
                                                fetchProblem();
                                            }}
                                            className="w-full py-3 md:py-4 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95 transition-all mt-auto"
                                        >
                                            OK! 다음 문제 👍
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
