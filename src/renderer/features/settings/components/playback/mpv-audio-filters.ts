// Builds the MPV `af` audio filter chain string for EQ and compressor.
// Uses FFmpeg lavfi filters, which MPV exposes natively.

import { EqBand, EqSettings, EqType } from '/@/shared/types/types';

export interface CompressorSettings {
    attack: number; // ms
    enabled: boolean;
    knee: number; // dB soft-knee width
    makeup: number; // dB post-compression gain
    ratio: number; // e.g. 4 (means 4:1)
    release: number; // ms
    threshold: number; // dB, e.g. -24
}

/**
 * Returns the MPV `af` property value for EQ + compressor settings.
 * An empty string clears all filters (pass-through).
 */
export function buildMpvAudioFilters(eq: EqSettings, compressor: CompressorSettings): string {
    const parts: string[] = [];

    if (eq.enabled) {
        // Apply preamp as a straight input gain before the band filters.
        // The user is responsible for setting a negative preamp value when
        // boosting bands to avoid clipping — matching the behaviour of VLC,
        // foobar2000, and hardware EQs. The UI preamp slider exists for this purpose.
        if (eq.preamp !== 0) {
            parts.push(`volume=${eq.preamp}dB`);
        }

        for (const band of eq.bands) {
            const filter = buildMpvEqFilter(band);
            if (filter) parts.push(filter);
        }
    }

    if (compressor.enabled) {
        const threshLinear = Math.pow(10, compressor.threshold / 20);
        const makeupLinear = Math.pow(10, compressor.makeup / 20);
        parts.push(
            `lavfi=[acompressor=` +
                `threshold=${threshLinear.toFixed(6)}:` +
                `ratio=${compressor.ratio}:` +
                `attack=${compressor.attack}:` +
                `release=${compressor.release}:` +
                `makeup=${makeupLinear.toFixed(6)}:` +
                `knee=${compressor.knee}` +
                `]`,
        );
    }

    return parts.join(',');
}

// Q to octave width for lavfi width_type=o. Q=1.41 gives ~1 octave, the
// spacing of the old graphical EQ bands.
const qToOctaves = (qFactor: number): number =>
    Math.min(5, Math.max(0.1, (2 / Math.LN2) * Math.asinh(1 / (2 * qFactor))));

const buildMpvEqFilter = (band: EqBand): null | string => {
    const w = qToOctaves(band.qFactor).toFixed(2);

    switch (band.type) {
        case EqType.BandNotch:
            // FFmpeg 4.1+ `bandreject` is a true notch (gain-independent)
            return `lavfi=[bandreject=f=${band.freq}:width_type=o:w=${w}]`;
        case EqType.HighPass:
            return `lavfi=[highpass=f=${band.freq}:width_type=o:w=${w}]`;
        case EqType.HighShelf:
            if (Math.abs(band.gain) < 0.1) return null;
            // FFmpeg's `treble` filter is a high shelf
            return `lavfi=[treble=g=${band.gain}:f=${band.freq}:w=${w}]`;
        case EqType.LowPass:
            // Pass filters have no gain - only frequency and width matter
            return `lavfi=[lowpass=f=${band.freq}:width_type=o:w=${w}]`;
        case EqType.LowShelf:
            if (Math.abs(band.gain) < 0.1) return null;
            // FFmpeg's `bass` filter is a low shelf; `g` is in dB
            return `lavfi=[bass=g=${band.gain}:f=${band.freq}:w=${w}]`;
        case EqType.Peaking:
        default:
            if (Math.abs(band.gain) < 0.1) return null;
            return `lavfi=[equalizer=f=${band.freq}:width_type=o:w=${w}:g=${band.gain}]`;
    }
};
