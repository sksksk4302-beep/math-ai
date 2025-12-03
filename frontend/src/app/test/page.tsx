'use client';
import { useState } from 'react';

export default function TestPage() {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<any>(null);

    // 테스트용 가짜 데이터
    const testProblem = "3 + 5";
    const testWrongAnswer = "7";
    const userName = "한울";

    const handleAskAI = async () => {
        setLoading(true);
        setResponse(null);

        try {
            // 1. 백엔드(Python)로 요청 보내기
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
            const res = await fetch(`${apiUrl}/explain-error`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    problem: testProblem,
                    wrong_answer: testWrongAnswer,
                    user_name: userName,
                }),
            });

            // 2. 응답 받기
            const data = await res.json();
            setResponse(data);
        } catch (error) {
            console.error("에러 발생:", error);
            alert("선생님이 바쁘신가봐요 😅 (백엔드 서버가 켜져 있는지 확인하세요!)");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-yellow-50">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border-4 border-orange-200">

                {/* 헤더 영역 */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-orange-600 mb-2">AI 산수 선생님 🍎</h1>
                    <p className="text-gray-600">문제를 틀렸을 때 어떻게 반응할까요?</p>
                </div>

                {/* 문제 상황 시뮬레이션 */}
                <div className="bg-gray-100 p-4 rounded-xl mb-6 text-center">
                    <p className="text-lg">문제: <span className="font-bold">{testProblem}</span></p>
                    <p className="text-lg">한울이의 답: <span className="text-red-500 font-bold line-through">{testWrongAnswer}</span></p>
                </div>

                {/* 액션 버튼 */}
                <button
                    onClick={handleAskAI}
                    disabled={loading}
                    className={`w-full py-4 rounded-2xl text-xl font-bold text-white transition-all transform hover:scale-105 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 shadow-lg'
                        }`}
                >
                    {loading ? '선생님이 생각중... 🤔' : '선생님 도와주세요! 🙋‍♂️'}
                </button>

                {/* AI 선생님의 답변 영역 */}
                {response && (
                    <div className="mt-8 animate-fade-in-up">
                        <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl relative">
                            <div className="absolute -top-3 left-4 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                AI 선생님
                            </div>
                            <p className="text-lg text-gray-800 mt-2 font-medium">
                                "{response.message}"
                            </p>
                        </div>

                        <div className="mt-4 p-4 bg-black text-green-400 rounded-lg text-xs font-mono">
                            <p className="mb-1 text-white opacity-50">🤖 애니메이션 지시문 (Dev Mode):</p>
                            {response.animation_cue}
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}
