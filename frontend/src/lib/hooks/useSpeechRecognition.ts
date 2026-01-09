import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeKoreanNumber } from '../utils/korean';

interface UseSpeechRecognitionProps {
    onResult: (number: string) => void;
}

export const useSpeechRecognition = ({ onResult }: UseSpeechRecognitionProps) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const onResultRef = useRef(onResult);

    // ✅ 사용자가 '듣기'를 원하는지 여부 (실제 마이크 상태와 별개)
    // 이 값이 true인 동안에는 마이크가 꺼지면 무조건 다시 켭니다.
    const shouldListenRef = useRef(false);

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    // 마이크 켜기 (재시작 로직 포함)
    const startListening = useCallback(() => {
        if (shouldListenRef.current) return; // 이미 켜려는 의도라면 중복 실행 방지
        shouldListenRef.current = true;

        const startRecognition = () => {
            if (!('webkitSpeechRecognition' in window)) {
                console.warn("Browser does not support speech recognition");
                return;
            }

            // 기존 인스턴스 정리
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch (e) { }
            }

            const recognition = new (window as any).webkitSpeechRecognition();
            recognitionRef.current = recognition;

            recognition.lang = 'ko-KR';
            recognition.continuous = false; // 모바일 호환성을 위해 false 반복 방식 사용
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => setIsListening(true);

            recognition.onend = () => {
                setIsListening(false);
                // 🔥 핵심: 사용자가 stop을 부르지 않았는데 꺼졌다면 즉시 부활 (Keep-Alive)
                if (shouldListenRef.current) {
                    // 브라우저 부하 방지를 위한 아주 짧은 딜레이
                    setTimeout(() => {
                        if (shouldListenRef.current) startRecognition();
                    }, 100);
                } else {
                    recognitionRef.current = null;
                }
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                console.log("🗣️ Recognized:", transcript);
                const number = normalizeKoreanNumber(transcript);
                if (number) {
                    onResultRef.current(number);
                }
            };

            recognition.onerror = (event: any) => {
                console.warn("Speech error:", event.error);
                // 'not-allowed'는 권한 거부이므로 재시작하면 안됨 (무한 루프 방지)
                if (event.error === 'not-allowed') {
                    shouldListenRef.current = false;
                    setIsListening(false);
                    alert("마이크 권한이 차단되었습니다. 주소창 옆 설정에서 허용해주세요.");
                }
                // 그 외 에러(no-speech 등)는 onend에서 재시작됨
            };

            try {
                recognition.start();
            } catch (e) {
                console.error("Start failed:", e);
            }
        };

        startRecognition();
    }, []);

    // 마이크 끄기 (명시적 중단 - 게임 끝날 때만 호출)
    const stopListening = useCallback(() => {
        shouldListenRef.current = false; // 재시작 방지 플래그 끔
        if (recognitionRef.current) {
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    // 컴포넌트 언마운트 시 정리
    useEffect(() => {
        return () => {
            shouldListenRef.current = false;
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    return {
        isListening,
        startListening, // 이제 외부에서 한 번만 부르면 됩니다.
        stopListening,
        isProcessingStt: false // 호환성 유지
    };
};
