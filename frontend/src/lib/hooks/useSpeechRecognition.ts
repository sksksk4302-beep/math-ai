import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeKoreanNumber } from '../utils/korean';

interface UseSpeechRecognitionProps {
    onResult: (number: string) => void;
}

export const useSpeechRecognition = ({ onResult }: UseSpeechRecognitionProps) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const isStartingRef = useRef(false);

    const startListening = useCallback(() => {
        // 중복 호출 방지
        if (isListening || isStartingRef.current) {
            console.log("⚠️ [STT] Already listening or starting, skipping");
            return;
        }

        if (!('webkitSpeechRecognition' in window)) {
            console.warn("❌ Browser does not support speech recognition");
            return;
        }

        isStartingRef.current = true;

        // 이전 인스턴스 완전히 정리 (Zombie Instance 방지)
        if (recognitionRef.current) {
            console.log("🧹 [STT] Cleaning up previous instance");
            try {
                recognitionRef.current.onend = null; // Remove handler to prevent side effects
                recognitionRef.current.abort();
            } catch (e) {
                console.warn("⚠️ [STT] Abort failed:", e);
            }
            recognitionRef.current = null;
        }

        // 새 인스턴스 생성
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.continuous = false;
        recognition.interimResults = false;

        // 현재 인스턴스 저장
        recognitionRef.current = recognition;

        recognition.onstart = () => {
            // 현재 활성화된 인스턴스인지 확인
            if (recognitionRef.current !== recognition) return;

            console.log("✅ [STT] Recognition started");
            setIsListening(true);
            isStartingRef.current = false;
        };

        recognition.onend = () => {
            // 현재 활성화된 인스턴스인지 확인
            if (recognitionRef.current !== recognition) return;

            console.log("🔚 [STT] Recognition ended");
            setIsListening(false);
            isStartingRef.current = false;
        };

        recognition.onresult = (event: any) => {
            // 현재 활성화된 인스턴스인지 확인
            if (recognitionRef.current !== recognition) return;

            const transcript = event.results[0][0].transcript;
            console.log("🗣️ [STT] Recognized speech:", transcript);
            const number = normalizeKoreanNumber(transcript);
            console.log("🔢 [STT] Normalized to number:", number);
            if (number) {
                onResult(number);
            }
        };

        recognition.onerror = (event: any) => {
            // 현재 활성화된 인스턴스인지 확인
            if (recognitionRef.current !== recognition) return;

            console.error("❌ [STT] Speech error:", event.error);
            setIsListening(false);
            isStartingRef.current = false;
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
            isStartingRef.current = false;
            recognitionRef.current = null;
        }
    }, [isListening, onResult]);

    const stopListening = useCallback(() => {
        console.log("🛑 [STT] stopListening called");
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.warn("⚠️ [STT] Stop failed:", e);
            }
            // Do not nullify recognitionRef.current here immediately if we want onend to fire normally?
            // Actually, if we want to force stop and reset state, we can nullify it to ignore subsequent events
            // But usually we want onend to handle the cleanup.
            // However, to be safe and immediate:
            recognitionRef.current = null;
        }
        setIsListening(false);
        isStartingRef.current = false;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                console.log("🧹 [STT] Cleanup on unmount");
                try {
                    recognitionRef.current.onend = null; // Prevent callbacks
                    recognitionRef.current.abort();
                } catch (e) {
                    console.warn("⚠️ [STT] Cleanup abort failed:", e);
                }
                recognitionRef.current = null;
            }
        };
    }, []);

    return {
        isListening,
        startListening,
        stopListening,
    };
};
