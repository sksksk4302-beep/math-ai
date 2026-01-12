import { useState, useCallback } from 'react';
import { normalizeKoreanNumber } from '../utils/korean';

interface UseSpeechRecognitionProps {
    onResult: (number: string) => void;
}

export const useSpeechRecognition = ({ onResult }: UseSpeechRecognitionProps) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessingStt, setIsProcessingStt] = useState(false);

    const startListening = useCallback(() => {
        if (isListening || isProcessingStt) return;

        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.lang = 'ko-KR';
            recognition.continuous = false;  // ✅ 간단하게 한 번만
            recognition.interimResults = false;

            recognition.onstart = () => {
                console.log("✅ [STT] Recognition started");
                setIsListening(true);
            };

            recognition.onend = () => {
                console.log("🔚 [STT] Recognition ended");
                setIsListening(false);
                // 자동 재시작 없음 - iOS 호환성 문제 회피
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                console.log("🗣️ [STT] Recognized speech:", transcript);
                const number = normalizeKoreanNumber(transcript);
                console.log("🔢 [STT] Normalized to number:", number);
                if (number) {
                    onResult(number);
                }
            };

            recognition.onerror = (event: any) => {
                console.error("❌ [STT] Speech error:", event.error);
                setIsListening(false);
                if (event.error === 'not-allowed') {
                    alert("마이크 권한이 차단되었습니다. 주소창 옆 설정에서 허용해주세요.");
                }
            };

            try {
                recognition.start();
                console.log("▶️ [STT] Recognition.start() called");
            } catch (e) {
                console.error("❌ [STT] Start failed:", e);
                setIsListening(false);
            }
        } else {
            console.warn("❌ Browser does not support speech recognition");
        }
    }, [isListening, isProcessingStt, onResult]);

    const stopListening = useCallback(() => {
        setIsListening(false);
    }, []);

    return {
        isListening,
        startListening,
        stopListening,
        isProcessingStt
    };
};
