import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeKoreanNumber } from '../utils/korean';

interface UseSpeechRecognitionProps {
    onResult: (number: string) => void;
}

export const useSpeechRecognition = ({ onResult }: UseSpeechRecognitionProps) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessingStt, setIsProcessingStt] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);

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
        };
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
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://math-ai-backend-div6osazmq-uc.a.run.app';
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
        setIsListening(true);

        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.lang = 'ko-KR';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => {
                setIsListening(true); // 명시적 상태 업데이트
            };

            recognition.onend = () => {
                // 자동 재시작 로직 제거 (필요 시 버튼으로 다시 시작)
                setIsListening(false);
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
                setIsListening(false);
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
        startListening
    };
};
