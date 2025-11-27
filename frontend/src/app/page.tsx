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
    const [correctCount, setCorrectCount] = useState(0);
    const TOTAL_GOAL = 30;
    const GIFT_THRESHOLD = 25;
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [showText, setShowText] = useState(false);
    const [showTimeoutTransition, setShowTimeoutTransition] = useState(false);

    // 1. Reset & Start Timer when problem changes
    useEffect(() => {
        if (problem) {
            // New Rule: Base 10s + 5s per level
            const limit = 10 + (problem.level - 1) * 5;
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
            const res = await fetch('http://localhost:8000/timeout-audio');
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
            recognition.onend = () => setIsListening(false);

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
                    const res = await fetch('http://localhost:8000/stt', {
                        method: 'POST',
                        body: formData
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
        setShowText(false);

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
                const res = await fetch('http://localhost:8000/submit-result', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user, problem_id: problem.id, is_correct: true })
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
                await fetch('http://localhost:8000/submit-result', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user, problem_id: problem.id, is_correct: false })
                });

                const res = await fetch('http://localhost:8000/explain-error', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        problem: problem.problem,
                        wrong_answer: isTimeout ? "시간초과" : (answerOverride || userAnswer),
                        user_name: userName
                    })
                });
                const data = await res.json();
                setExplanation(data);
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
                        className="flex items-center gap-2 bg-red-100 text-red-600 px-5 py-2 rounded-full shadow-md border-b-4 border-red-300"
                    >
                        <span>⏰</span>
                        <span className="font-bold text-xl">{timeLeft}초</span>
                    </motion.div>
                    {/* Progress Tracker */}
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center gap-2 bg-gradient-to-r from-pink-400 to-purple-500 text-white px-5 py-2 rounded-full shadow-md border-b-4 border-purple-700"
                    >
                        <span>🎁</span>
                        <span className="font-bold">
                            {correctCount >= GIFT_THRESHOLD
                                ? "선물 획득! 🎉"
                                : `선물까지 ${GIFT_THRESHOLD - correctCount}문제`}
                        </span>
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
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={startListening}
                                        className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg transition-colors ${isListening ? 'bg-red-500 animate-pulse shadow-red-300' : 'bg-blue-100 hover:bg-blue-200'}`}
                                    >
                                        🎤
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05, translateY: -2 }}
                                        whileTap={{ scale: 0.95, translateY: 2 }}
                                        onClick={() => checkAnswer()}
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

                            {/* AI Explanation Modal */}
                            <AnimatePresence>
                                {explanation && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                                        onClick={() => {
                                            setExplanation(null);
                                            fetchProblem();
                                        }}
                                    >
                                        <motion.div
                                            initial={{ scale: 0.8, y: 50 }}
                                            animate={{ scale: 1, y: 0 }}
                                            exit={{ scale: 0.8, y: 50 }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-white md:rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col md:flex-row fixed inset-0 md:inset-10 md:h-auto md:max-h-[800px] relative"
                                        >
                                            {/* Left: Visual Area (60%) */}
                                            <div
                                                className="w-full md:w-3/5 bg-slate-50 p-4 flex items-center justify-center relative overflow-hidden cursor-pointer md:cursor-default shrink-0 min-h-[40vh]"
                                                onClick={() => setShowText(!showText)}
                                            >
                                                {/* New Visual Explanation */}
                                                {problem && parseProblem(problem.problem) ? (
                                                    <div className="scale-75 md:scale-100 w-full">
                                                        <VisualExplanation
                                                            count1={parseProblem(problem.problem)!.num1}
                                                            count2={parseProblem(problem.problem)!.num2}
                                                            operator={parseProblem(problem.problem)!.operator}
                                                            visualItems={explanation.visual_items}
                                                        />
                                                    </div>
                                                ) : (
                                                    renderVisualization()
                                                )}

                                                {/* Mobile Hint */}
                                                <div className="absolute bottom-4 text-slate-400 text-sm md:hidden animate-bounce bg-white/80 px-3 py-1 rounded-full">
                                                    {showText ? "화면을 누르면 설명이 닫혀요" : "화면을 눌러서 설명을 보세요!"}
                                                </div>
                                            </div>

                                            {/* Right: Text Area (40%) */}
                                            <div className={`
                                                w-full md:w-2/5 bg-white p-6 flex flex-col h-full
                                                transition-all duration-300 ease-in-out
                                                ${showText ? 'absolute inset-0 z-10 bg-white/95 backdrop-blur-sm' : 'hidden md:flex'}
                                            `}>
                                                <div className="flex items-center gap-2 mb-6 shrink-0">
                                                    <span className="text-4xl bg-blue-100 p-2 rounded-xl">🤖</span>
                                                    <h3 className="text-xl font-black text-slate-700">AI 선생님의 힌트</h3>
                                                </div>

                                                <div className="flex-1 overflow-y-auto min-h-0">
                                                    <p className="text-lg font-bold text-slate-700 mb-6 leading-relaxed whitespace-pre-wrap">
                                                        {explanation.message || "선생님이 설명을 준비하고 있어요..."}
                                                    </p>
                                                </div>

                                                <div className="flex flex-col gap-3 mt-4 shrink-0">
                                                    <button
                                                        onClick={() => explanation.audio_base64 && playAudio(explanation.audio_base64)}
                                                        className="flex items-center justify-center gap-2 text-blue-500 font-bold hover:bg-blue-50 py-3 rounded-xl transition-colors"
                                                    >
                                                        <span>🔊</span> 다시 듣기
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setExplanation(null);
                                                            fetchProblem();
                                                        }}
                                                        className="w-full bg-gradient-to-r from-green-400 to-blue-500 text-white text-xl font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
                                                    >
                                                        OK! 다음 문제 👍
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                        </motion.div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 opacity-50">
                            <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-xl font-bold text-blue-400">문제를 만들고 있어요...</p>
                        </div>
                    )
                    }
                </AnimatePresence >

                {/* Timeout Transition Modal */}
                <AnimatePresence>
                    {showTimeoutTransition && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.5, y: 50 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.5, y: 50 }}
                                className="bg-white rounded-[3rem] p-10 max-w-lg w-full text-center shadow-2xl border-8 border-blue-200 relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-6 bg-blue-200"></div>
                                <div className="text-9xl mb-8 animate-bounce">🙋‍♂️</div>
                                <h2 className="text-4xl font-black text-slate-700 mb-4">시간이 다 됐어요!</h2>
                                <p className="text-2xl text-slate-500 font-bold">선생님이랑 같이 풀어볼까요?</p>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div >
        </main >
    );
}
