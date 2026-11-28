import { memo, useCallback, useMemo } from 'react';

import styles from './eq-graph.module.css';

import { useElementSize } from '/@/shared/hooks/use-element-size';
import { type EqBand, EqType } from '/@/shared/types/types';

// Response model mirrors the Web Audio graph (BiquadFilterNode, RBJ cookbook).
// Roughly matches the MPV lavfi chains for the same knobs, but is not exact -
// shelves ignore Q in Web Audio and MPV's bass/treble use a different width semantics.

const FREQ_MIN = 20;
const FREQ_MAX = 20_000;
const DB_MIN = -12;
const DB_MAX = 12;
const SAMPLE_RATE = 48_000;
const SAMPLES = 240;
const FALLBACK_WIDTH = 560;
const HEIGHT = 168;
const PLOT_LEFT = 34;
const PLOT_RIGHT_GAP = 10;
const PLOT_TOP = 8;
const PLOT_BOTTOM = HEIGHT - 20;
const PLOT_H = PLOT_BOTTOM - PLOT_TOP;
// Zero line sits at the midpoint of the ±12 dB range.
const ZERO_Y = PLOT_TOP + (DB_MAX / (DB_MAX - DB_MIN)) * PLOT_H;

const yOf = (db: number) =>
    PLOT_TOP + ((DB_MAX - Math.min(DB_MAX, Math.max(DB_MIN, db))) / (DB_MAX - DB_MIN)) * PLOT_H;

const FREQ_RATIO = (freq: number) =>
    (Math.log10(freq) - Math.log10(FREQ_MIN)) / (Math.log10(FREQ_MAX) - Math.log10(FREQ_MIN));

type Biquad = [b0: number, b1: number, b2: number, a1: number, a2: number];

const bandCoefficients = (band: EqBand): Biquad => {
    let Q = band.qFactor;
    let kind: 'highpass' | 'highshelf' | 'lowpass' | 'lowshelf' | 'peaking' = 'peaking';
    let gain = band.gain;

    switch (band.type) {
        case EqType.BandNotch:
            Q = Math.min(20, band.qFactor * 3);
            gain = -40;
            break;
        case EqType.HighPass:
            kind = 'highpass';
            gain = 0;
            break;
        case EqType.HighShelf:
            kind = 'highshelf';
            break;
        case EqType.LowPass:
            kind = 'lowpass';
            gain = 0;
            break;
        case EqType.LowShelf:
            kind = 'lowshelf';
            break;
        case EqType.Peaking:
        default:
            kind = 'peaking';
            break;
    }

    const f = Math.min(Math.max(band.freq, 10), SAMPLE_RATE / 2 - 10);
    const w0 = (2 * Math.PI * f) / SAMPLE_RATE;
    const cosW = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Q);
    const A = Math.pow(10, gain / 40);

    let b0: number;
    let b1: number;
    let b2: number;
    let a0: number;
    let a1: number;
    let a2: number;

    if (kind === 'peaking') {
        b0 = 1 + alpha * A;
        b1 = -2 * cosW;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosW;
        a2 = 1 - alpha / A;
    } else if (kind === 'lowshelf') {
        b0 = A * (A + 1 - (A - 1) * cosW + 2 * Math.sqrt(A) * alpha);
        b1 = 2 * A * (A - 1 - (A + 1) * cosW);
        b2 = A * (A + 1 - (A - 1) * cosW - 2 * Math.sqrt(A) * alpha);
        a0 = A + 1 + (A - 1) * cosW + 2 * Math.sqrt(A) * alpha;
        a1 = -2 * (A - 1 + (A + 1) * cosW);
        a2 = A + 1 + (A - 1) * cosW - 2 * Math.sqrt(A) * alpha;
    } else if (kind === 'highshelf') {
        b0 = A * (A + 1 + (A - 1) * cosW + 2 * Math.sqrt(A) * alpha);
        b1 = -2 * A * (A - 1 + (A + 1) * cosW);
        b2 = A * (A + 1 + (A - 1) * cosW - 2 * Math.sqrt(A) * alpha);
        a0 = A + 1 - (A - 1) * cosW + 2 * Math.sqrt(A) * alpha;
        a1 = 2 * (A - 1 - (A + 1) * cosW);
        a2 = A + 1 - (A - 1) * cosW - 2 * Math.sqrt(A) * alpha;
    } else if (kind === 'lowpass') {
        b0 = (1 - cosW) / 2;
        b1 = 1 - cosW;
        b2 = (1 - cosW) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosW;
        a2 = 1 - alpha;
    } else {
        b0 = (1 + cosW) / 2;
        b1 = -(1 + cosW);
        b2 = (1 + cosW) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosW;
        a2 = 1 - alpha;
    }

    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
};

const bandDbAt = (band: EqBand, freq: number): number => {
    const [b0, b1, b2, a1, a2] = bandCoefficients(band);
    const w = (2 * Math.PI * freq) / SAMPLE_RATE;
    const c1 = Math.cos(w);
    const s1 = Math.sin(w);
    const c2 = Math.cos(2 * w);
    const s2 = Math.sin(2 * w);

    const numRe = b0 + b1 * c1 + b2 * c2;
    const numIm = -b1 * s1 - b2 * s2;
    const denRe = 1 + a1 * c1 + a2 * c2;
    const denIm = -a1 * s1 - a2 * s2;

    const mag = Math.sqrt((numRe * numRe + numIm * numIm) / (denRe * denRe + denIm * denIm));
    return 20 * Math.log10(Math.max(mag, 1e-9));
};

interface EQGraphProps {
    bands: EqBand[];
    hoverIndex: null | number;
    preamp: number;
}

export const EQGraph = memo(({ bands, hoverIndex, preamp }: EQGraphProps) => {
    const { ref: containerRef, width: containerWidth } = useElementSize();
    const svgWidth = Math.max(320, Math.round(containerWidth) || FALLBACK_WIDTH);
    const plotRight = svgWidth - PLOT_RIGHT_GAP;

    const xOf = useCallback(
        (freq: number) => PLOT_LEFT + FREQ_RATIO(freq) * (plotRight - PLOT_LEFT),
        [plotRight],
    );

    const samples = useMemo(
        () =>
            Array.from({ length: SAMPLES }, (_, i) => {
                const f = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, i / (SAMPLES - 1));
                return f;
            }),
        [],
    );

    const totalPoints = useMemo(() => {
        const points: string[] = [];
        for (const f of samples) {
            const total = preamp + bands.reduce((sum, band) => sum + bandDbAt(band, f), 0);
            points.push(`${xOf(f).toFixed(1)},${yOf(total).toFixed(1)}`);
        }
        return points;
    }, [bands, preamp, samples, xOf]);

    const hoveredBand = hoverIndex !== null ? bands[hoverIndex] : undefined;

    const bandPath = useMemo(() => {
        if (!hoveredBand) return null;
        const points: string[] = [];
        for (const f of samples) {
            points.push(`${xOf(f).toFixed(1)},${yOf(bandDbAt(hoveredBand, f)).toFixed(1)}`);
        }
        return `M ${points.join(' L ')}`;
    }, [hoveredBand, samples, xOf]);

    const bandFillPath = useMemo(() => {
        if (!bandPath) return null;
        return `${bandPath} L ${xOf(FREQ_MAX).toFixed(1)},${ZERO_Y.toFixed(1)} L ${xOf(FREQ_MIN).toFixed(1)},${ZERO_Y.toFixed(1)} Z`;
    }, [bandPath, xOf]);

    const totalPath = `M ${totalPoints.join(' L ')}`;
    const hoveredFreqX = hoveredBand ? xOf(hoveredBand.freq) : 0;

    const gridLines = [-12, -6, 0, 6, 12].map((db) => ({
        db,
        y: yOf(db),
    }));

    const freqLabels = [20, 100, 1000, 10000].map((freq) => ({
        freq,
        label: freq >= 1000 ? `${freq / 1000}k` : `${freq}`,
        x: xOf(freq),
    }));

    return (
        <svg
            aria-label="Equalizer response"
            className={styles.graph}
            ref={containerRef}
            role="img"
            viewBox={`0 0 ${svgWidth} ${HEIGHT}`}
        >
            {gridLines.map(({ db, y }) => (
                <line
                    className={db === 0 ? styles['zero-line'] : styles['grid-line']}
                    key={db}
                    x1={PLOT_LEFT}
                    x2={plotRight}
                    y1={y}
                    y2={y}
                />
            ))}
            {gridLines.map(({ db, y }) => (
                <text
                    className={styles['db-label']}
                    key={`db-${db}`}
                    textAnchor="end"
                    x={PLOT_LEFT - 6}
                    y={y + 3}
                >
                    {db > 0 ? `+${db}` : db}
                </text>
            ))}
            {freqLabels.map(({ freq, label, x }) => (
                <text
                    className={styles['freq-label']}
                    key={freq}
                    textAnchor="middle"
                    x={x}
                    y={HEIGHT - 6}
                >
                    {label}
                </text>
            ))}
            <path className={hoveredBand ? styles['total-ghost'] : styles.total} d={totalPath} />
            {hoveredBand && bandPath && bandFillPath && (
                <>
                    <path className={styles['band-fill']} d={bandFillPath} />
                    <line
                        className={styles['band-marker']}
                        x1={hoveredFreqX}
                        x2={hoveredFreqX}
                        y1={PLOT_TOP}
                        y2={PLOT_BOTTOM}
                    />
                    <path className={styles['band-curve']} d={bandPath} />
                </>
            )}
        </svg>
    );
});
