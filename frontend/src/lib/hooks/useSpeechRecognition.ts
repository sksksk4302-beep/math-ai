import { useState, useCallback } from 'react';
import { normalizeKoreanNumber } from '../utils/korean';

interface UseSpeechRecognitionProps {
    onResult: (number: string) => void;
}

export const useSpeechRecognition = ({ onResult }: UseSpeechRecognitionProps) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessingStt, setIsProcessingStt] = useState(false);

    const handleVoiceRecord = useCallback(async () => {
        setIsListening(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
                    stream.getTracks().forEach(track => track.stop());
                }
            };

            mediaRecorder.start();

            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 3500); // 3.5초로 증가

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

            recognition.onstart = () => { };
            recognition.onend = () => {
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log("Recognition restart ignored");
                    }
                }, 200);
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
                    handleVoiceRecord();
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
