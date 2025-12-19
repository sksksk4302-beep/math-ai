'use client';

import { useState, useEffect, useRef } from 'react';
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

// Config
const API_URL = 'https://math-ai-backend-dlgntatyiq-uc.a.run.app';

export default function Home() {
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
    const GIFT_THRESHOLD = 5;
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);

    // Audio Ref
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [showTimeoutTransition, setShowTimeoutTransition] = useState(false);
    const [isProcessingStt, setIsProcessingStt] = useState(false);

    // 1. Reset & Start Timer when problem changes
    useEffect(() => {
        if (problem) {
            // New Rule: Base 15s + 5s per level
            const limit = 15 + (problem.level - 1) * 5;
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
            const res = await fetch(`${API_URL}/timeout-audio`, { cache: 'no-store' });
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

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };

    const playAudio = (base64Audio: string) => {
        stopAudio(); // Stop previous audio if any
        const url = `data:audio/mp3;base64,${base64Audio}`;
        setAudioUrl(url);

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch(e => console.log("Auto-play blocked, waiting for interaction:", e));
    };

    // Helper to normalize Korean numbers
    const normalizeInput = (text: string): string => {
        const map: { [key: string]: string } = {
            '영': '0', '공': '0',
            '일': '1', '하나': '1',
            '이': '2', '둘': '2',
            '삼': '3', '셋': '3',
            '사': '4', '넷': '4',
            '오': '5', '다섯': '5',
            '육': '6', '여섯': '6',
            '칠': '7', '일곱': '7',
            '팔': '8', '여덟': '8',
            '구': '9', '아홉': '9',
            '십': '10', '열': '10'
        };

        // Check exact matches first
        if (map[text.trim()]) return map[text.trim()];

        // Replace text numbers with digits
        let normalized = text;
        Object.entries(map).forEach(([key, val]) => {
            normalized = normalized.replace(new RegExp(key, 'g'), val);
        });

        // Extract digits
        return normalized.replace(/[^0-9]/g, '');
    };

    const startListening = () => {
        if (isListening || isProcessingStt) return;
        setIsListening(true);

        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.lang = 'ko-KR';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => { };
            recognition.onend = () => {
                // Auto-restart logic
                // Small delay to prevent CPU spinning if error occurs repeatedly
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log("Recognition restart ignored");
                    }
                }, 200);
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                console.log("Mic Transcript:", transcript);

                const number = normalizeInput(transcript);

                if (number) {
                    setUserAnswer(number);
                    checkAnswer(number);
                }
            };

            recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
                // If not-allowed or service-not-allowed, try fallback
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    handleVoiceRecord();
                }
            };

            try {
                recognition.start();
            } catch (e) {
                console.error("Mic start error:", e);
                setIsListening(false);
                handleVoiceRecord();
            }
        } else {
            // Fallback: MediaRecorder -> Backend STT
            handleVoiceRecord();
        }
    };

    const handleVoiceRecord = async () => {
        setIsListening(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            const audioChunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                setIsProcessingStt(true);
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
                } finally {
                    setIsProcessingStt(false);
                    setIsListening(false);
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                }
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
            alert("마이크 권한이 필요해요! 설정에서 허용해주세요. 🎤");
        }
    };

    // Initial Load & Auto-start STT
    useEffect(() => {
        prefetchProblem();
        // startListening(); // Removed to avoid double start with next useEffect

        return () => {
            stopAudio();
        }
    }, []);

    // Auto-start STT when problem changes (with browser policy safety)
    useEffect(() => {
        if (problem && !loading && !explanation) {
            // Small delay to ensure UI is ready
            const timer = setTimeout(() => {
                startListening();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [problem, loading, explanation]);

    // Logic
    const prefetchProblem = async () => {
        try {
            const res = await fetch(`${API_URL}/generate-problem`, {
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
        stopAudio(); // Stop any leftover audio

        try {
            const res = await fetch(`${API_URL}/generate-problem`, {
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
            await fetch(`${API_URL}/update-level`, {
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
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700', '#FF69B4', '#00BFFF'] });
            setFeedback("정답입니다! 🎉");

            try {
                const res = await fetch(`${API_URL}/submit-result`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user, problem_id: problem.id, is_correct: true }),
                    cache: 'no-store'
                });
                const data = await res.json();
                console.log("Submit result:", data);
                console.log("Previous stats:", stats);
                console.log("New stickers from backend:", data.level_stickers);

                setStats({
                    level: data.new_level,
                    stickers: data.level_stickers, // Ensure this maps to level_stickers
                    totalStickers: data.total_stickers
                });

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
                await fetch(`${API_URL}/submit-result`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user, problem_id: problem.id, is_correct: false }),
                    cache: 'no-store'
                });

                const res = await fetch(`${API_URL}/explain-error`, {
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

                {/* Gift Box Progress Bar - Hidden on Mobile */}
                <div className="hidden md:block w-full max-w-md mx-auto mb-6 px-4">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-slate-500">선물 상자까지</span>
                        <span className="text-xs font-bold text-orange-400">{stats.stickers} / {GIFT_THRESHOLD}</span>
                    </div>
                    <div className="h-6 bg-white rounded-full border-4 border-orange-100 p-1 relative">
                        <motion.div
                            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((stats.stickers / GIFT_THRESHOLD) * 100, 100)}%` }}
                        />
                        <div className="absolute -right-3 -top-3 text-2xl animate-bounce">
                            🎁
                        </div>
                    </div>
                </div>

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
                                    {/* Timer Bar */}
                                    <div className="h-3 md:h-4 bg-slate-100 relative overflow-hidden">
                                        <motion.div
                                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-green-500"
                                            animate={{
                                                width: `${(timeLeft / (15 + ((problem?.level || 1) - 1) * 5)) * 100}%`,
                                                backgroundColor: timeLeft <= 5 ? '#EF4444' : '#22C55E'
                                            }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>

                                    <div className="p-6 md:p-12 flex flex-col items-center gap-6 md:gap-10">
                                        <div className="flex flex-col items-center gap-2 md:gap-4">
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 md:px-4 md:py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs md:text-sm font-bold tracking-wide">
                                                    문제 {stats.totalStickers + 1}
                                                </span>
                                                <div className={`flex items-center gap-1 font-mono font-black text-xl ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                                                    <span>⏰</span>
                                                    <span>{timeLeft}</span>
                                                </div>
                                            </div>
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
                                                onKeyDown={(e) => e.key === 'Enter' && !loading && timeLeft > 0 && checkAnswer()}
                                                placeholder="?"
                                                disabled={loading || timeLeft === 0}
                                                className="w-full h-16 md:h-24 text-center text-3xl md:text-5xl font-bold bg-slate-50 border-4 border-slate-200 rounded-2xl focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all outline-none placeholder-slate-300 disabled:opacity-50 disabled:bg-slate-100"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                <span className="text-2xl md:text-4xl">✏️</span>
                                            </div>

                                            {/* Mic Button - Positioned inside input for visibility */}
                                            <button
                                                onClick={startListening}
                                                disabled={isListening || isProcessingStt}
                                                className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-md transition-all z-10 ${isListening ? 'bg-red-500 animate-pulse text-white' : isProcessingStt ? 'bg-blue-500 animate-bounce text-white' : 'bg-white text-slate-400 hover:text-orange-500 border border-slate-200'}`}
                                            >
                                                <span className="text-xl md:text-2xl">
                                                    {isProcessingStt ? '⏳' : isListening ? '👂' : '🎤'}
                                                </span>
                                            </button>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 md:gap-4 w-full">
                                            <button
                                                onClick={() => checkAnswer()}
                                                disabled={loading || timeLeft === 0}
                                                className="flex-1 bg-gradient-to-b from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white text-lg md:text-2xl font-black py-4 md:py-6 rounded-2xl shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            stopAudio();
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
                                        stopAudio();
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
                                                stopAudio();
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
