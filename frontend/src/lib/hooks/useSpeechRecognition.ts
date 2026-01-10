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
        console.log("🎤 [STT] startListening called, current state:", {
            shouldListen: shouldListenRef.current,
            hasRecognition: !!recognitionRef.current
        });

        // 기존 인스턴스가 있으면 정리
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
                console.log("🛑 [STT] Aborted previous instance");
            } catch (e) {
                console.warn("⚠️ [STT] Abort failed:", e);
            }
        }

        shouldListenRef.current = true;

        const startRecognition = () => {
            if (!('webkitSpeechRecognition' in window)) {
                console.warn("❌ Browser does not support speech recognition");
                return;
            }

            const recognition = new (window as any).webkitSpeechRecognition();
            recognitionRef.current = recognition;

            recognition.lang = 'ko-KR';
            recognition.continuous = true;  // ✅ 지속적으로 음성 듣기
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                console.log("✅ [STT] Recognition started");
                setIsListening(true);
            };

            recognition.onend = () => {
                console.log("🔚 [STT] Recognition ended, shouldListen:", shouldListenRef.current);
                setIsListening(false);

                // 모바일/PC 끊김 방지: 사용자가 멈추지 않았는데 꺼졌다면 재시작
                if (shouldListenRef.current) {
                    console.log("🔄 [STT] Attempting auto-restart...");
                    setTimeout(() => {
                        if (shouldListenRef.current && !recognitionRef.current) {
                            startRecognition();
                        }
                    }, 100);
                } else {
                    recognitionRef.current = null;
                }
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                console.log("🗣️ [STT] Recognized speech:", transcript);
                const number = normalizeKoreanNumber(transcript);
                console.log("🔢 [STT] Normalized to number:", number);
                if (number) {
                    onResultRef.current(number);
                }
            };

            recognition.onerror = (event: any) => {
                console.error("❌ [STT] Speech error:", event.error);
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
                console.log("▶️ [STT] Recognition.start() called");
            } catch (e) {
                console.error("❌ [STT] Start failed:", e);
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
