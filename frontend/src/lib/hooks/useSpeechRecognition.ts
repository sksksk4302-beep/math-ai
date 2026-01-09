import { useState, useCallback, useRef, useEffect, useReducer } from 'react';
import { normalizeKoreanNumber } from '../utils/korean';

interface UseSpeechRecognitionProps {
    onResult: (number: string) => void;
}

export const useSpeechRecognition = ({ onResult }: UseSpeechRecognitionProps) => {
    // ✅ UI 업데이트를 위한 forceUpdate 메커니즘
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    // ✅ 상태를 ref로 관리 (startListening을 stable하게 만들기 위함)
    const isListeningRef = useRef(false);
    const isProcessingSttRef = useRef(false);

    // Fallback용 스트림 (webkitSpeechRecognition 실패 시에만 사용)
    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);

    // ✅ 콜백 함수를 Ref에 담아 최신 상태 유지 (Closure 문제 해결)
    const onResultRef = useRef(onResult);

    // ✅ 중복 시작 방지 가드
    const isStartingRef = useRef(false);

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    // 컴포넌트 언마운트 시 정리
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (recognitionRef.current) {
                recognitionRef.current.abort();
                recognitionRef.current = null;
            }
        };
    }, []);

    const setIsListening = useCallback((value: boolean) => {
        isListeningRef.current = value;
        forceUpdate();
    }, []);

    const setIsProcessingStt = useCallback((value: boolean) => {
        isProcessingSttRef.current = value;
        forceUpdate();
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }
        setIsListening(false);
        isStartingRef.current = false;

        // Fallback 스트림도 정리
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, [setIsListening]);

    // 2. Fallback: 직접 녹음해서 서버로 전송 (Web Speech API 미지원/오류 시)
    const handleVoiceRecord = useCallback(async () => {
        setIsListening(true);
        try {
            let stream = streamRef.current;
            if (!stream || !stream.active) {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
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
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                    const res = await fetch(`${apiUrl}/stt`, {
                        method: 'POST',
                        body: formData,
                        cache: 'no-store'
                    });
                    const data = await res.json();
                    if (data.number) {
                        onResultRef.current(data.number);
                    }
                } catch (e) {
                    console.error("STT Failed:", e);
                } finally {
                    setIsProcessingStt(false);
                    setIsListening(false);
                }
            };

            mediaRecorder.start();
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 3500);

        } catch (e) {
            console.error("Mic access denied:", e);
            setIsListening(false);
            alert("마이크 권한이 필요해요! 🎤");
        }
    }, [setIsListening, setIsProcessingStt]);

    // ✅ 의존성 배열을 []로 만들어 완전히 stable하게
    const startListening = useCallback(() => {
        // 이미 듣고 있거나 처리 중이면 중복 실행 방지
        if (isListeningRef.current || isProcessingSttRef.current || isStartingRef.current) return;

        // 기존 인스턴스 확실히 정리
        if (recognitionRef.current) {
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }

        isStartingRef.current = true;

        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognitionRef.current = recognition;

            recognition.lang = 'ko-KR';
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                console.log("🎤 Speech Recognition Started");
                isStartingRef.current = false;
                setIsListening(true);
            };

            recognition.onend = () => {
                console.log("🎤 Speech Recognition Ended");
                isStartingRef.current = false;
                // 현재 인스턴스가 내 것이 맞는지 확인
                if (recognitionRef.current === recognition) {
                    setIsListening(false);
                    recognitionRef.current = null;
                }
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                console.log("Mic Transcript:", transcript);
                const number = normalizeKoreanNumber(transcript);

                if (number) {
                    onResultRef.current(number);
                }
            };

            recognition.onerror = (event: any) => {
                console.error("Speech error:", event.error);
                isStartingRef.current = false;
                if (recognitionRef.current === recognition) {
                    setIsListening(false);
                    recognitionRef.current = null;
                }

                // 'not-allowed'는 권한 거부, 'no-speech'는 침묵. 
                // 즉시 폴백으로 넘어가면 사용자 경험이 안 좋을 수 있으므로 신중히 처리
                if (event.error === 'not-allowed' || event.error === 'audio-capture') {
                    handleVoiceRecord();
                }
            };

            try {
                recognition.start();
            } catch (e) {
                console.error("Mic start error:", e);
                isStartingRef.current = false;
                setIsListening(false);
                // 즉시 폴백 실행하지 않고 멈춤 (무한 루프 방지)
            }
        } else {
            handleVoiceRecord();
        }
    }, []); // ✅ 빈 배열 = 절대 재생성되지 않음

    return {
        isListening: isListeningRef.current,
        isProcessingStt: isProcessingSttRef.current,
        startListening,
        stopListening
    };
};
