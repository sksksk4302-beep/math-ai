'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import VisualExplanation from '../components/VisualExplanation';
import AchievementPopup from '../components/AchievementPopup';
import LevelUpPopup from '../components/LevelUpPopup';
import { Problem, Stats, Explanation, INITIAL_PROBLEM, API_URL, GIFT_THRESHOLD, TOTAL_GOAL } from '../lib/types';
import { useAudio } from '../lib/hooks/useAudio';
import { useTimer } from '../lib/hooks/useTimer';
import { useSpeechRecognition } from '../lib/hooks/useSpeechRecognition';

export default function Home() {
    // 사용자 및 기본 상태
    const [user, setUser] = useState('');
    const [userName] = useState("한울이");

    // 초기 사용자 설정
    useEffect(() => {
        const storedUser = localStorage.getItem('math_ai_user_id');
        if (storedUser) {
            setUser(storedUser);
        } else {
            const newUser = "user_" + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('math_ai_user_id', newUser);
            setUser(newUser);
        }
    }, []);

    // 문제 및 통계 상태
    const [problem, setProblem] = useState<Problem | null>(null);
    const [nextProblem, setNextProblem] = useState<Problem | null>(null);
    const [stats, setStats] = useState<Stats>({ level: 1, stickers: 0, totalStickers: 0 });

    // UI 상태
    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState<string>('');
    const [explanation, setExplanation] = useState<Explanation | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [shake, setShake] = useState(false);
    const [showTimeoutTransition, setShowTimeoutTransition] = useState(false);

    // 새로운 기능 상태
    const [showAchievement, setShowAchievement] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [newLevel, setNewLevel] = useState(1);
    const [waitingForAnswer, setWaitingForAnswer] = useState(false);
    const [stickerIncrement, setStickerIncrement] = useState(0);

    // 커스텀 훅들
    const { playAudio, stopAudio } = useAudio();

    const handleTimeOver = async () => {
        setTimerActive(false);
        setShowTimeoutTransition(true);

        try {
            const res = await fetch(`${API_URL}/timeout-audio`, { cache: 'no-store' });
            const data = await res.json();
            if (data.audio_base64) {
                playAudio(data.audio_base64);
            }
        } catch (e) {
            console.error("Timeout audio failed:", e);
        }

        setTimeout(() => {
            setShowTimeoutTransition(false);
            setFeedback("시간 초과! 땡! ⏰");
            checkAnswer(undefined, true);
        }, 3500);
    };

    const { timeLeft, timerActive, setTimerActive } = useTimer({
        problem,
        waitingForAnswer,
        onTimeOver: handleTimeOver
    });

    const handleSttResult = (number: string) => {
        setUserAnswer(number);
        // STT는 입력만 하고 자동 제출하지 않음
    };

    const { isListening, isProcessingStt, startListening } = useSpeechRecognition({
        onResult: handleSttResult
    });

    // 답변 입력 시작 시 타이머 활성화
    useEffect(() => {
        if (waitingForAnswer && userAnswer.length > 0) {
            setTimerActive(true);
            setWaitingForAnswer(false);
        }
    }, [userAnswer, waitingForAnswer, setTimerActive]);

    // 별 스티커 애니메이션
    useEffect(() => {
        if (stickerIncrement > 0) {
            const timer = setTimeout(() => setStickerIncrement(0), 1000);
            return () => clearTimeout(timer);
        }
    }, [stickerIncrement]);

    // 25문제 달성 체크
    useEffect(() => {
        if (stats.totalStickers === 25 && !showAchievement) {
            const alreadyShown = localStorage.getItem('achievement_25_shown');
            if (!alreadyShown) {
                setShowAchievement(true);
                localStorage.setItem('achievement_25_shown', 'true');
            }
        }
    }, [stats.totalStickers, showAchievement]);

    // 초기 로드: 사용자 ID가 설정되면 문제와 통계 가져오기
    useEffect(() => {
        if (user) {
            fetchProblem();
        }
        return () => stopAudio();
    }, [user]);

    // 문제 변경 시 STT 자동 시작
    useEffect(() => {
        if (problem && !loading && !explanation) {
            const timer = setTimeout(() => {
                startListening();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [problem, loading, explanation, startListening]);

    // API 함수들
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
        stopAudio();

        try {
            const res = await fetch(`${API_URL}/generate-problem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user }),
                cache: 'no-store'
            });
            const data = await res.json();
            setProblem(data);

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
        setWaitingForAnswer(true); // 새 문제 시작 시 답변 대기

        setNextProblem(null);
        setLoading(false);
        prefetchProblem();
    };

    const checkAnswer = async (answerOverride?: string, isTimeout = false) => {
        if (!problem) return;
        if (!isTimeout && (!answerOverride && !userAnswer)) return;

        setTimerActive(false);

        // 현재 문제를 저장 (오답 설명용)
        const currentProblem = problem;

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

                console.log("🎯 백엔드 응답:", data);
                console.log("💫 현재 stats:", stats);
                console.log("⭐ total_stickers:", data.total_stickers);
                console.log("📊 Setting new stats - Level:", data.new_level, "LevelStickers:", data.level_stickers, "TotalStickers:", data.total_stickers);

                setStats({
                    level: data.new_level,
                    stickers: data.level_stickers,
                    totalStickers: data.total_stickers
                });

                setStickerIncrement(1); // 별 애니메이션 트리거

                if (data.new_level > stats.level) {
                    setNewLevel(data.new_level);
                    setShowLevelUp(true);
                    setFeedback(`Lv.${data.new_level}로 넘어가겠습니다!! 🚀`);
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
                        problem: currentProblem.problem,
                        wrong_answer: isTimeout ? "시간초과" : (answerOverride || userAnswer),
                        user_name: userName
                    }),
                    cache: 'no-store'
                });
                const data = await res.json();
                setExplanation({ ...data, problem: currentProblem.problem });
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
                <header className="flex justify-between items-center mb-6 md:mb-12 relative z-50">
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
                                {isListening && !isProcessingStt && (
                                    <span className="text-lg md:text-xl animate-pulse ml-1">
                                        🎤
                                    </span>
                                )}
                                {isProcessingStt && (
                                    <span className="text-lg md:text-xl animate-bounce ml-1">
                                        ⏳
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
                                        {/* 답변 대기 메시지 - STT 준비 완료 시에만 표시 */}
                                        <div className="h-8 flex items-center justify-center">
                                            {waitingForAnswer && isListening && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="text-orange-500 font-bold text-lg md:text-xl animate-pulse"
                                                >
                                                    🎤 정답을 말씀하세요!
                                                </motion.div>
                                            )}
                                            {waitingForAnswer && !isListening && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-slate-400 font-medium text-sm md:text-base"
                                                >
                                                    👂 귀를 기울이고 있어요...
                                                </motion.div>
                                            )}
                                        </div>

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

                                        {/* Input Area - 마이크 버튼 제거됨 */}
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
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 md:gap-4 w-full">
                                            <button
                                                onClick={() => checkAnswer()}
                                                disabled={loading || timeLeft === 0}
                                                className="flex-1 bg-gradient-to-b from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white text-lg md:text-2xl font-black py-4 md:py-6 rounded-2xl shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
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
                                    : 'bg-white border-red-100 text-red-500'}`}
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

            {/* Achievement Popup */}
            <AchievementPopup
                isOpen={showAchievement}
                onClose={() => setShowAchievement(false)}
            />

            {/* Level Up Popup */}
            <LevelUpPopup
                isOpen={showLevelUp}
                level={newLevel}
                userName={userName}
                onClose={() => setShowLevelUp(false)}
            />
        </main>
    );
}
