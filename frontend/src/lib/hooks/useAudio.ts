import { useRef, useCallback } from 'react';

export const useAudio = () => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    }, []);

    const playAudio = useCallback((base64Audio: string) => {
        stopAudio();
        const url = `data:audio/mp3;base64,${base64Audio}`;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch(e => console.log("Auto-play blocked:", e));
    }, [stopAudio]);

    return { playAudio, stopAudio, audioRef };
};
