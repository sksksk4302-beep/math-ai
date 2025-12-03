'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Counting from './visualizations/Counting';
import TenFrame from './visualizations/TenFrame';

interface MathProblemProps {
    userName: string;
}

export default function MathProblem({ userName }: MathProblemProps) {
    const [problem, setProblem] = useState({ num1: 5, num2: 3, answer: 8 });
    const [userAnswer, setUserAnswer] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [explanation, setExplanation] = useState<any>(null);

    // 문제 생성 함수
    const generateProblem = () => {
        // 1~9 사이의 랜덤 숫자 생성
        const n1 = Math.floor(Math.random() * 9) + 1;
        const n2 = Math.floor(Math.random() * 9) + 1;
        setProblem({
            num1: n1,
            num2: n2,
            answer: n1 + n2
        });
        setUserAnswer('');
        setMessage('');
        setExplanation(null);
    };

    // 컴포넌트 마운트 시 첫 문제 생성
    useEffect(() => {
        generateProblem();
    }, []);

    const handleSubmit = async () => {
        if (!userAnswer) return;

        if (parseInt(userAnswer) === problem.answer) {
            setMessage('정답이야! 참 잘했어! 🎉');
            setExplanation(null);
            return;
        }

        setLoading(true);
        setMessage('');
        setExplanation(null);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/explain-error`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    problem: `${problem.num1} + ${problem.num2}`,
                    wrong_answer: userAnswer,
                    user_name: userName,
                }),
            });

            if (!response.ok) {
                throw new Error('AI 선생님을 부르는데 실패했어요 ㅠㅠ');
            }

            const data = await response.json();
            setExplanation(data);
        } catch (error) {
            console.error(error);
            setMessage('잠시 문제가 생겼어. 다시 시도해볼까?');
        } finally {
            setLoading(false);
        }
    };

    const renderVisualization = () => {
        if (!explanation || !explanation.visual_items) return null;

        switch (explanation.animation_type) {
            case 'counting':
                return <Counting items={explanation.visual_items} />;
            case 'ten_frame':
                return <TenFrame items={explanation.visual_items} />;
            default:
                // 기본값은 Counting으로 처리
                return <Counting items={explanation.visual_items} />;
        }
    };

    return (
        <div className="max-w-2xl mx-auto text-center">
            <div className="flex justify-between items-center mb-8 px-4">
                <span className="text-gray-500 text-sm">Level 1: 덧셈 놀이</span>
                <button
                    onClick={generateProblem}
                    className="text-blue-500 hover:text-blue-700 font-bold text-sm"
                >
                    다른 문제 풀기 🔄
                </button>
            </div>

            <h2 className="text-4xl md:text-6xl font-bold mb-8 md:mb-12 text-blue-600 font-mono tracking-wider">
                {problem.num1} + {problem.num2} = ?
            </h2>

            <div className="flex justify-center items-center gap-4 mb-8">
                <input
                    type="number"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="text-3xl md:text-4xl w-24 md:w-32 p-3 md:p-4 text-center border-4 border-blue-300 rounded-2xl focus:border-blue-500 outline-none bg-white shadow-inner"
                    placeholder="?"
                />
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xl md:text-2xl font-bold py-3 px-6 md:py-4 md:px-8 rounded-2xl shadow-lg disabled:bg-gray-400 transition-all transform active:scale-95"
                >
                    {loading ? '...' : '정답 확인!'}
                </button>
            </div>

            {message && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="text-3xl font-bold text-green-600 mb-4">{message}</div>
                    {message.includes('정답') && (
                        <button
                            onClick={generateProblem}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-md transition-colors animate-bounce"
                        >
                            다음 문제 도전! ➡️
                        </button>
                    )}
                </motion.div>
            )}

            {explanation && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-8 rounded-3xl shadow-2xl border-4 border-orange-200 text-left"
                >
                    <div className="flex items-start gap-6 mb-8">
                        <div className="text-6xl bg-orange-100 p-4 rounded-full">👩‍🏫</div>
                        <div>
                            <h3 className="text-2xl font-bold text-orange-600 mb-2">AI 선생님의 설명</h3>
                            <p className="text-xl leading-relaxed text-gray-700 whitespace-pre-wrap">
                                {explanation.message}
                            </p>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-100">
                        <h4 className="text-lg font-bold text-gray-500 mb-4 text-center">
                            👀 그림으로 살펴볼까?
                        </h4>
                        {renderVisualization()}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
