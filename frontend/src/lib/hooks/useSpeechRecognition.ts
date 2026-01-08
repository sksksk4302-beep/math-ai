import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeKoreanNumber } from '../utils/korean';

interface UseSpeechRecognitionProps {
    onResult: (number: string) => void;
}

export const useSpeechRecognition = ({ onResult }: UseSpeechRecognitionProps) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessingStt, setIsProcessingStt] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);

    // 1. 컴포넌트 마운트 시 마이크 스트림 미리 확보 (Warm-up)
    useEffect(() => {
        const initStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
                console.log("🎤 Microphone stream initialized");
            } catch (e) {
                console.error("Microphone access denied or not available:", e);
            }
        };

        initStream();

        // 언마운트 시 스트림 정리
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

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.abort(); // stop() 대신 abort()가 더 확실하게 중단
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const handleVoiceRecord = useCallback(async () => {
        setIsListening(true);
        try {
            // 스트림 재사용 또는 새로 요청
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
                        onResult(data.number);
                    }
                } catch (e) {
                    console.error("STT Failed:", e);
                } finally {
                    setIsProcessingStt(false);
                    setIsListening(false);
                    // 스트림을 닫지 않고 유지함 (재사용 위해)
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
            alert("마이크 권한이 필요해요! 설정에서 허용해주세요. 🎤");
        }
    }, [onResult]);

    const startListening = useCallback(() => {
        if (isListening || isProcessingStt) return;

        // 기존 인스턴스 정리
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }

        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognitionRef.current = recognition;

            recognition.lang = 'ko-KR';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => {
                setIsListening(true); // 명시적 상태 업데이트
            };

            recognition.onend = () => {
                // 현재 인스턴스가 맞는지 확인 (Race Condition 방지)
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
                    onResult(number);
                }
            };

            recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);

                // 현재 인스턴스가 맞는지 확인
                if (recognitionRef.current === recognition) {
                    setIsListening(false);
                    recognitionRef.current = null;
                }

                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    handleVoiceRecord(); // 폴백
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
            handleVoiceRecord();
        }
    }, [isListening, isProcessingStt, onResult, handleVoiceRecord]);

    return {
        isListening,
        isProcessingStt,
        startListening,
        stopListening
    };
};
