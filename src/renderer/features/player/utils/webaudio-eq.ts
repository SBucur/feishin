import { EqBand, EqType } from '/@/shared/types/types';

export type EqDspChain = {
    compressor: DynamicsCompressorNode;
    eqFilters: BiquadFilterNode[];
    makeupGain: GainNode;
    preampGain: GainNode;
};

// Shared by the graph build (audio-players) and live settings updates so
// both paths apply identical type/Q semantics.
export const applyBandToBiquadFilter = (
    filter: BiquadFilterNode,
    band: EqBand,
    enabled: boolean,
): void => {
    filter.frequency.value = band.freq;

    switch (band.type) {
        case EqType.BandNotch:
            // Web Audio has no notch type; a deep narrow peaking cut approximates bandreject.
            filter.type = 'peaking';
            filter.Q.value = Math.min(20, band.qFactor * 3);
            filter.gain.value = enabled ? -40 : 0;
            break;
        case EqType.HighPass:
            filter.type = 'highpass';
            filter.Q.value = band.qFactor;
            filter.gain.value = 0; // unused by pass filters
            break;
        case EqType.HighShelf:
            filter.type = 'highshelf';
            filter.Q.value = band.qFactor;
            filter.gain.value = enabled ? band.gain : 0;
            break;
        case EqType.LowPass:
            filter.type = 'lowpass';
            filter.Q.value = band.qFactor;
            filter.gain.value = 0; // unused by pass filters
            break;
        case EqType.LowShelf:
            // Per the Web Audio spec, Q is ignored for shelf filters.
            filter.type = 'lowshelf';
            filter.Q.value = band.qFactor;
            filter.gain.value = enabled ? band.gain : 0;
            break;
        case EqType.Peaking:
        default:
            filter.type = 'peaking';
            filter.Q.value = band.qFactor;
            filter.gain.value = enabled ? band.gain : 0;
    }
};

// Rewires only the preamp → filters → compressor segment; upstream and
// downstream connections stay untouched. Returns the new filter array.
export const rebuildBiquadChain = (
    context: AudioContext,
    dsp: EqDspChain,
    bands: EqBand[],
    enabled: boolean,
): BiquadFilterNode[] => {
    dsp.preampGain.disconnect();
    for (const filter of dsp.eqFilters) filter.disconnect();

    const filters = bands.map((band) => {
        const filter = context.createBiquadFilter();
        applyBandToBiquadFilter(filter, band, enabled);
        return filter;
    });

    if (filters.length > 0) {
        dsp.preampGain.connect(filters[0]);
        for (let i = 0; i < filters.length - 1; i++) {
            filters[i].connect(filters[i + 1]);
        }
        filters[filters.length - 1].connect(dsp.compressor);
    } else {
        dsp.preampGain.connect(dsp.compressor);
    }

    return filters;
};
