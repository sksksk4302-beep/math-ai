// Helper to normalize Korean numbers to digits
export const normalizeKoreanNumber = (text: string): string => {
    const map: { [key: string]: string } = {
        '영': '0', '공': '0',
        '일': '1', '하나': '1',
        '이': '2', '둘': '2',
        '삼': '3', '셋': '3',
        '사': '4', '넷': '4',
        '오': '5', '다섯': '5',
        '육': '6', '여섯': '6',
        '칠': '7', '일곱': '7',
        '팔': '8', '여덟': '8',
        '구': '9', '아홉': '9',
        '십': '10', '열': '10'
    };

    // Check exact matches first
    if (map[text.trim()]) return map[text.trim()];

    // Replace text numbers with digits
    let normalized = text;
    Object.entries(map).forEach(([key, val]) => {
        normalized = normalized.replace(new RegExp(key, 'g'), val);
    });

    // Extract digits
    return normalized.replace(/[^0-9]/g, '');
};
