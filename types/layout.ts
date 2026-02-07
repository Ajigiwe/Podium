export type GridLayout = '2x2' | '4x4' | '5x5' | 'spotlight';

export interface LayoutConfig {
    columns: number;
    rows: number;
    maxVisible: number;
}

export interface RaisedHand {
    participantId: string;
    participantName: string;
    timestamp: number;
}
