import { EqBand, EqType } from '/@/shared/types/types';

// Maps a parametric EQ band onto a Web Audio BiquadFilterNode. Shared
// between the initial graph build (audio-players) and the live updates
// driven from the settings panel (eq-settings) so both stay in sync.
export const applyBandToBiquadFilter = (
    filter: BiquadFilterNode,
    band: EqBand,
    enabled: boolean,
): void => {
    filter.frequency.value = band.freq;

    switch (band.type) {
        case EqType.BandNotch:
            // Web Audio has no notch type; a deep, narrow peaking cut
            // approximates the lavfi `bandreject` used on the MPV backend.
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
            // Note: per the Web Audio spec, Q is ignored for shelf filters.
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
