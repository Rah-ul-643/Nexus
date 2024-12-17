import { useRef } from 'react';

const useRingtone = (audioPath) => {
    const audioRef = useRef(new Audio(audioPath));
    
    const play = () => {
        audioRef.current.loop = true;
        audioRef.current.volume = 0.8;
        audioRef.current.play().catch(console.error);
    };
    
    const stop = () => {
        const audio = audioRef.current;
        audio.pause();
        audio.currentTime = 0;
    };
    
    return { play, stop };
};

export default useRingtone;