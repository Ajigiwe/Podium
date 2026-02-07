import { useState } from 'react';
import { GridLayout, LayoutConfig } from '@/types/layout';
import { useClassroom } from '@/contexts/ClassroomContext';

const LAYOUT_CONFIGS: Record<GridLayout, LayoutConfig> = {
    '2x2': { columns: 2, rows: 2, maxVisible: 4 },
    '4x4': { columns: 4, rows: 4, maxVisible: 16 },
    '5x5': { columns: 5, rows: 5, maxVisible: 25 },
    'spotlight': { columns: 1, rows: 1, maxVisible: 1 }
};

const MOBILE_LAYOUT_CONFIGS: Record<GridLayout, LayoutConfig> = {
    '2x2': { columns: 1, rows: 4, maxVisible: 4 }, // Stack vertically on mobile
    '4x4': { columns: 1, rows: 16, maxVisible: 16 }, // Stack vertically on mobile
    '5x5': { columns: 1, rows: 25, maxVisible: 25 }, // Stack vertically on mobile
    'spotlight': { columns: 1, rows: 1, maxVisible: 1 }
};

export const useLayoutConfig = () => {
    const { layout, setLayout } = useClassroom();
    const [spotlightParticipant, setSpotlightParticipant] = useState<string | null>(null);

    // Dynamic detection of mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const currentConfigs = isMobile ? MOBILE_LAYOUT_CONFIGS : LAYOUT_CONFIGS;

    return {
        layout,
        setLayout,
        config: currentConfigs[layout],
        spotlightParticipant,
        setSpotlightParticipant
    };
};
