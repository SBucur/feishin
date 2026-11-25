import isElectron from 'is-electron';
import { memo, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './eq-settings.module.css';
import { buildMpvAudioFilters, type CompressorSettings } from './mpv-audio-filters';

import { WebAudioContext } from '/@/renderer/features/player/context/webaudio-context';
import {
    applyBandToBiquadFilter,
    rebuildBiquadChain,
} from '/@/renderer/features/player/utils/webaudio-eq';
import {
    SettingOption,
    SettingsSection,
} from '/@/renderer/features/settings/components/settings-section';
import { usePlaybackSettings, useSettingsStoreActions } from '/@/renderer/store/settings.store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { Select } from '/@/shared/components/select/select';
import { Slider } from '/@/shared/components/slider/slider';
import { Stack } from '/@/shared/components/stack/stack';
import { Switch } from '/@/shared/components/switch/switch';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import {
    type EqBand,
    eqPresets,
    type EqSettings as EqSettingsType,
    EqType,
    LEGACY_EQ_FREQUENCIES,
    PlayerType,
} from '/@/shared/types/types';

const mpvPlayer = isElectron() ? window.api.mpvPlayer : null;

const EQ_MIN = -12;
const EQ_MAX = 12;
const EQ_STEP = 0.5;

const FREQ_MIN = 20;
const FREQ_MAX = 20_000;
const Q_MIN = 0.3;
const Q_MAX = 5;
// Room for the 12-band presets plus a couple of manual additions
const MAX_BANDS = 16;

// Old custom presets were bare 12-gain arrays; convert them to peaking bands.
const migrateCustomEqPresets = (raw: Record<string, unknown>): Record<string, EqBand[]> => {
    const presets: Record<string, EqBand[]> = {};
    for (const [name, value] of Object.entries(raw)) {
        if (!Array.isArray(value)) continue;
        if (value.every((v) => typeof v === 'number')) {
            presets[name] = LEGACY_EQ_FREQUENCIES.map((freq, i) => ({
                freq,
                gain: (value as number[])[i] ?? 0,
                qFactor: 1.41,
                type: EqType.Peaking,
            }));
        } else {
            presets[name] = value as EqBand[];
        }
    }
    return presets;
};

// ─── Built-in compressor presets ─────────────────────────────────────────────
type CompressorPreset = Omit<CompressorSettings, 'enabled'>;
const COMP_PRESETS: Record<string, CompressorPreset> = {
    Broadcast: { attack: 15, knee: 3, makeup: 6, ratio: 5, release: 200, threshold: -20 },
    Default: { attack: 20, knee: 2.83, makeup: 6, ratio: 4, release: 250, threshold: -24 },
    Gentle: { attack: 50, knee: 6, makeup: 2, ratio: 1.5, release: 500, threshold: -15 },
    Heavy: { attack: 10, knee: 2, makeup: 8, ratio: 8, release: 150, threshold: -30 },
    Light: { attack: 30, knee: 4, makeup: 3, ratio: 2, release: 400, threshold: -18 },
    Limiter: { attack: 1, knee: 1, makeup: 0, ratio: 20, release: 100, threshold: -3 },
    'Loud Master': { attack: 5, knee: 2, makeup: 10, ratio: 6, release: 100, threshold: -28 },
    Moderate: { attack: 20, knee: 3, makeup: 5, ratio: 4, release: 300, threshold: -24 },
};

// ─── Storage helpers ──────────────────────────────────────────────────────────
const LS_EQ_PRESETS = 'feishin_eq_custom_presets';
const LS_COMP_PRESETS = 'feishin_comp_custom_presets';

function loadCustomPresets<T>(key: string): Record<string, T> {
    try {
        return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
        return {};
    }
}

function saveCustomPresets<T>(key: string, presets: Record<string, T>) {
    localStorage.setItem(key, JSON.stringify(presets));
}

// ─── Main component ───────────────────────────────────────────────────────────
export const EqSettings = memo(() => {
    const { t } = useTranslation();
    const settings = usePlaybackSettings();
    const { setSettings } = useSettingsStoreActions();

    // Read DSP nodes via ref so the callback never captures a stale/undefined context.
    const webAudioContext = useContext(WebAudioContext);
    const webAudioContextRef = useRef(webAudioContext);
    useEffect(() => {
        webAudioContextRef.current = webAudioContext;
    }, [webAudioContext]);

    // Custom preset state — stored in localStorage separately from main store
    const [customEqPresets, setCustomEqPresets] = useState<Record<string, EqBand[]>>(() =>
        migrateCustomEqPresets(loadCustomPresets<unknown>(LS_EQ_PRESETS)),
    );
    const [customCompPresets, setCustomCompPresets] = useState<Record<string, CompressorPreset>>(
        () => loadCustomPresets<CompressorPreset>(LS_COMP_PRESETS),
    );
    const [saveEqName, setSaveEqName] = useState('');
    const [saveCompName, setSaveCompName] = useState('');

    const applyFilters = useCallback(
        (eq: EqSettingsType, compressor: CompressorSettings) => {
            // ── MPV player ────────────────────────────────────────────────
            if (settings.type === PlayerType.LOCAL) {
                const filterStr = buildMpvAudioFilters(eq, compressor);
                mpvPlayer?.setProperties({ af: filterStr });
                return;
            }

            // ── Web Audio player ──────────────────────────────────────────
            const webAudio = webAudioContextRef.current.webAudio;
            const dsp = webAudio?.dsp;
            if (!dsp || !webAudio) return;

            dsp.preampGain.gain.value = eq.enabled ? Math.pow(10, eq.preamp / 20) : 1;

            if (dsp.eqFilters.length !== eq.bands.length) {
                dsp.eqFilters = rebuildBiquadChain(webAudio.context, dsp, eq.bands, eq.enabled);
            } else {
                dsp.eqFilters.forEach((filter, i) => {
                    const band = eq.bands[i];
                    if (band) {
                        applyBandToBiquadFilter(filter, band, eq.enabled);
                    }
                });
            }

            // Makeup gain - DynamicsCompressorNode has no makeup param (MPV acompressor does)
            dsp.makeupGain.gain.value = compressor.enabled
                ? Math.pow(10, compressor.makeup / 20)
                : 1;

            if (compressor.enabled) {
                dsp.compressor.threshold.value = compressor.threshold;
                dsp.compressor.ratio.value = compressor.ratio;
                dsp.compressor.attack.value = compressor.attack / 1000;
                dsp.compressor.release.value = compressor.release / 1000;
                dsp.compressor.knee.value = compressor.knee;
            } else {
                dsp.compressor.threshold.value = 0;
                dsp.compressor.ratio.value = 1;
                dsp.compressor.attack.value = 0;
                dsp.compressor.release.value = 0.25;
                dsp.compressor.knee.value = 0;
            }
        },
        // settings.type is the only reactive dep — webAudioContextRef is a
        // stable ref that always holds the latest context value.
        [settings.type],
    );

    // Re-apply on type switch so persisted DSP settings take effect immediately.
    useEffect(() => {
        if (settings.type === PlayerType.WEB) {
            applyFilters(settings.equalizer, settings.compressor);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.type]);

    // ── EQ handlers ──────────────────────────────────────────────────────────
    const handleEqToggle = (enabled: boolean) => {
        const newEq = { ...settings.equalizer, enabled };
        setSettings({ playback: { equalizer: newEq } });
        applyFilters(newEq, settings.compressor);
    };

    const handlePreampChangeEnd = (preamp: number) => {
        const newEq = { ...settings.equalizer, preamp };
        setSettings({ playback: { equalizer: newEq } });
        applyFilters(newEq, settings.compressor);
    };

    const handleBandPatch = (index: number, patch: Partial<EqBand>) => {
        const newBands = settings.equalizer.bands.map((b, i) =>
            i === index ? { ...b, ...patch } : b,
        );
        const newEq = { ...settings.equalizer, bands: newBands };
        setSettings({ playback: { equalizer: newEq } });
        applyFilters(newEq, settings.compressor);
    };

    const handleAddBand = () => {
        if (settings.equalizer.bands.length >= MAX_BANDS) return;
        const band: EqBand = {
            freq: 1000,
            gain: 0,
            qFactor: 1.41,
            type: EqType.Peaking,
        };
        const newEq = { ...settings.equalizer, bands: [...settings.equalizer.bands, band] };
        setSettings({ playback: { equalizer: newEq } });
        applyFilters(newEq, settings.compressor);
    };

    const handleRemoveBand = (index: number) => {
        if (settings.equalizer.bands.length <= 1) return;
        const newEq = {
            ...settings.equalizer,
            bands: settings.equalizer.bands.filter((_, i) => i !== index),
        };
        setSettings({ playback: { equalizer: newEq } });
        applyFilters(newEq, settings.compressor);
    };

    const applyEqPreset = (bands: EqBand[]) => {
        const newEq = {
            ...settings.equalizer,
            bands: bands.map((b) => ({ ...b, id: crypto.randomUUID() })),
            preamp: 0,
        };
        setSettings({ playback: { equalizer: newEq } });
        applyFilters(newEq, settings.compressor);
    };

    const handleSaveEqPreset = () => {
        const name = saveEqName.trim();
        if (!name) return;
        const bands = settings.equalizer.bands.map((b) => ({ ...b }));
        const updated = { ...customEqPresets, [name]: bands };
        setCustomEqPresets(updated);
        saveCustomPresets(LS_EQ_PRESETS, updated);
        setSaveEqName('');
    };

    const handleDeleteEqPreset = (name: string) => {
        const updated = { ...customEqPresets };
        delete updated[name];
        setCustomEqPresets(updated);
        saveCustomPresets(LS_EQ_PRESETS, updated);
    };

    const handleResetEq = () => {
        const newEq = {
            ...settings.equalizer,
            bands: settings.equalizer.bands.map((b) => ({ ...b, gain: 0 })),
            preamp: 0,
        };
        setSettings({ playback: { equalizer: newEq } });
        applyFilters(newEq, settings.compressor);
    };

    // ── Compressor handlers ───────────────────────────────────────────────────
    const handleCompToggle = (enabled: boolean) => {
        const newComp = { ...settings.compressor, enabled };
        setSettings({ playback: { compressor: newComp } });
        applyFilters(settings.equalizer, newComp);
    };

    const handleCompChangeEnd = (key: keyof CompressorSettings, value: number) => {
        const newComp = { ...settings.compressor, [key]: value };
        setSettings({ playback: { compressor: newComp } });
        applyFilters(settings.equalizer, newComp);
    };

    const applyCompPreset = (preset: CompressorPreset) => {
        const newComp = { ...settings.compressor, ...preset };
        setSettings({ playback: { compressor: newComp } });
        applyFilters(settings.equalizer, newComp);
    };

    const handleSaveCompPreset = () => {
        const name = saveCompName.trim();
        if (!name) return;
        const rest = Object.fromEntries(
            Object.entries(settings.compressor).filter(([key]) => key !== 'enabled'),
        ) as CompressorPreset;
        const updated = { ...customCompPresets, [name]: rest };
        setCustomCompPresets(updated);
        saveCustomPresets(LS_COMP_PRESETS, updated);
        setSaveCompName('');
    };

    const handleDeleteCompPreset = (name: string) => {
        const updated = { ...customCompPresets };
        delete updated[name];
        setCustomCompPresets(updated);
        saveCustomPresets(LS_COMP_PRESETS, updated);
    };

    const handleResetComp = () => {
        const newComp = {
            attack: 20,
            enabled: settings.compressor.enabled,
            knee: 2.83,
            makeup: 6,
            ratio: 4,
            release: 250,
            threshold: -24,
        };
        setSettings({ playback: { compressor: newComp } });
        applyFilters(settings.equalizer, newComp);
    };

    // ── Preset select data ────────────────────────────────────────────────────
    const eqPresetSelectData = [
        {
            group: t('setting.equalizerPresetGroupBuiltIn'),
            items: eqPresets.map((preset) => ({ label: preset.name, value: preset.name })),
        },
        ...(Object.keys(customEqPresets).length > 0
            ? [
                  {
                      group: t('setting.equalizerPresetGroupCustom'),
                      items: Object.keys(customEqPresets).map((name) => ({
                          label: name,
                          value: name,
                      })),
                  },
              ]
            : []),
    ];

    const compPresetSelectData = [
        {
            group: t('setting.equalizerPresetGroupBuiltIn'),
            items: Object.keys(COMP_PRESETS).map((name) => ({ label: name, value: name })),
        },
        ...(Object.keys(customCompPresets).length > 0
            ? [
                  {
                      group: t('setting.equalizerPresetGroupCustom'),
                      items: Object.keys(customCompPresets).map((name) => ({
                          label: name,
                          value: name,
                      })),
                  },
              ]
            : []),
    ];

    // ── EQ SettingsSection options ────────────────────────────────────────────
    const eqTypeOptions = [
        { label: t('setting.equalizerTypePeaking'), value: EqType.Peaking },
        { label: t('setting.equalizerTypeLowShelf'), value: EqType.LowShelf },
        { label: t('setting.equalizerTypeHighShelf'), value: EqType.HighShelf },
        { label: t('setting.equalizerTypeLowPass'), value: EqType.LowPass },
        { label: t('setting.equalizerTypeHighPass'), value: EqType.HighPass },
        { label: t('setting.equalizerTypeBandNotch'), value: EqType.BandNotch },
    ];

    const eqOptions: SettingOption[] = [
        {
            control: (
                <Switch
                    defaultChecked={settings.equalizer.enabled}
                    onChange={(e) => handleEqToggle(e.currentTarget.checked)}
                />
            ),
            description:
                settings.type === PlayerType.LOCAL
                    ? t('setting.equalizer', { context: 'descriptionMpv' })
                    : t('setting.equalizer', { context: 'descriptionWebAudio' }),
            title: t('setting.equalizer'),
        },
        ...(settings.equalizer.enabled
            ? ([
                  {
                      control: (
                          <Group gap="xs">
                              <Select
                                  clearable
                                  data={eqPresetSelectData}
                                  onChange={(name) => {
                                      if (!name) return;
                                      const bands =
                                          customEqPresets[name] ??
                                          eqPresets.find((p) => p.name === name)?.bands;
                                      if (bands) applyEqPreset(bands);
                                  }}
                                  placeholder={t('setting.equalizerPresetSelectPlaceholder')}
                                  searchable
                                  value={null}
                                  w={180}
                              />
                              {Object.keys(customEqPresets).length > 0 && (
                                  <Select
                                      clearable
                                      data={Object.keys(customEqPresets).map((name) => ({
                                          label: name,
                                          value: name,
                                      }))}
                                      onChange={(name) => {
                                          if (!name) return;
                                          handleDeleteEqPreset(name);
                                      }}
                                      placeholder={t('setting.equalizerPresetDeletePlaceholder')}
                                      value={null}
                                      w={160}
                                  />
                              )}
                          </Group>
                      ),
                      description: t('setting.equalizerPreset', { context: 'description' }),
                      title: t('setting.equalizerPreset'),
                  },
                  {
                      control: (
                          <Group gap="xs">
                              <TextInput
                                  onChange={(e) => setSaveEqName(e.currentTarget.value)}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEqPreset();
                                  }}
                                  placeholder={t('setting.equalizerPresetNamePlaceholder')}
                                  value={saveEqName}
                                  w={180}
                              />
                              <Button
                                  disabled={!saveEqName.trim()}
                                  onClick={handleSaveEqPreset}
                                  variant="subtle"
                              >
                                  {t('common.save')}
                              </Button>
                          </Group>
                      ),
                      description: t('setting.equalizerSavePreset', { context: 'description' }),
                      title: t('setting.equalizerSavePreset'),
                  },
                  {
                      control: (
                          <Group gap="xs">
                              <Slider
                                  label={(v) => `${v > 0 ? '+' : ''}${v} dB`}
                                  max={EQ_MAX}
                                  min={EQ_MIN}
                                  onChange={(v) => {
                                      setSettings({
                                          playback: {
                                              equalizer: { ...settings.equalizer, preamp: v },
                                          },
                                      });
                                  }}
                                  onChangeEnd={handlePreampChangeEnd}
                                  step={EQ_STEP}
                                  value={settings.equalizer.preamp}
                                  w={200}
                              />
                              {/* Manual preamp input */}
                              <NumberInput
                                  hideControls
                                  max={EQ_MAX}
                                  min={EQ_MIN}
                                  onBlur={(e) => {
                                      const val = parseFloat(e.currentTarget.value);
                                      if (!isNaN(val)) {
                                          const clamped = Math.max(EQ_MIN, Math.min(EQ_MAX, val));
                                          handlePreampChangeEnd(clamped);
                                      }
                                  }}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter') e.currentTarget.blur();
                                  }}
                                  rightSection={
                                      <Text isMuted size="xs">
                                          dB
                                      </Text>
                                  }
                                  size="sm"
                                  step={EQ_STEP}
                                  value={settings.equalizer.preamp}
                                  w={70}
                              />
                              <Button onClick={handleResetEq} variant="subtle">
                                  {t('common.reset')}
                              </Button>
                          </Group>
                      ),
                      description: t('setting.equalizerPreamp', { context: 'description' }),
                      title: t('setting.equalizerPreamp'),
                  },
                  {
                      control: (
                          <Stack gap="xs" maw="100%" w={560}>
                              {settings.equalizer.bands.map((band, i) => (
                                  <Group gap="xs" key={band.id ?? i} wrap="nowrap">
                                      <Select
                                          data={eqTypeOptions}
                                          onChange={(value) =>
                                              value && handleBandPatch(i, { type: value as EqType })
                                          }
                                          size="sm"
                                          value={band.type}
                                          width="22%"
                                      />
                                      <NumberInput
                                          defaultValue={band.freq}
                                          hideControls
                                          key={`freq-${band.freq}`}
                                          max={FREQ_MAX}
                                          min={FREQ_MIN}
                                          onBlur={(e) => {
                                              const val = parseFloat(e.currentTarget.value);
                                              if (!isNaN(val)) {
                                                  handleBandPatch(i, {
                                                      freq: Math.max(
                                                          FREQ_MIN,
                                                          Math.min(FREQ_MAX, val),
                                                      ),
                                                  });
                                              }
                                          }}
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter') e.currentTarget.blur();
                                          }}
                                          rightSection={<Text size="xs">Hz</Text>}
                                          size="sm"
                                          title={t('setting.equalizerBandFrequency')}
                                          width="14%"
                                      />
                                      <NumberInput
                                          defaultValue={band.qFactor}
                                          hideControls
                                          key={`q-${band.qFactor}`}
                                          max={Q_MAX}
                                          min={Q_MIN}
                                          onBlur={(e) => {
                                              const val = parseFloat(e.currentTarget.value);
                                              if (!isNaN(val)) {
                                                  handleBandPatch(i, {
                                                      qFactor: Math.max(
                                                          Q_MIN,
                                                          Math.min(Q_MAX, val),
                                                      ),
                                                  });
                                              }
                                          }}
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter') e.currentTarget.blur();
                                          }}
                                          rightSection={<Text size="xs">Q</Text>}
                                          size="sm"
                                          step={0.1}
                                          title={t('setting.equalizerBandQ')}
                                          width="11%"
                                      />
                                      <Slider
                                          className={styles['band-gain']}
                                          label={null}
                                          max={EQ_MAX}
                                          min={EQ_MIN}
                                          onChange={(v) => handleBandPatch(i, { gain: v })}
                                          step={EQ_STEP}
                                          thumbLabel={`EQ ${band.freq} Hz gain`}
                                          value={band.gain}
                                      />
                                      <Text className={styles['band-gain-value']} size="sm">
                                          {`${band.gain > 0 ? '+' : ''}${band.gain}`}
                                      </Text>
                                      <ActionIcon
                                          aria-label={t('setting.equalizerBandRemove')}
                                          disabled={settings.equalizer.bands.length <= 1}
                                          icon="x"
                                          onClick={() => handleRemoveBand(i)}
                                          size="sm"
                                          variant="subtle"
                                      />
                                  </Group>
                              ))}
                              <Button
                                  disabled={settings.equalizer.bands.length >= MAX_BANDS}
                                  onClick={handleAddBand}
                                  variant="subtle"
                                  w="fit-content"
                              >
                                  {t('common.add')}
                              </Button>
                          </Stack>
                      ),
                      description: t('setting.equalizerBands', { context: 'description' }),
                      title: t('setting.equalizerBands'),
                  },
              ] as SettingOption[])
            : []),
    ];

    // ── Compressor param definitions ──────────────────────────────────────────
    const compParams: {
        description: string;
        key: keyof CompressorSettings;
        max: number;
        min: number;
        step: number;
        title: string;
        unit: string;
    }[] = [
        {
            description: t('setting.compressorThreshold', { context: 'description' }),
            key: 'threshold',
            max: 0,
            min: -60,
            step: 1,
            title: t('setting.compressorThreshold'),
            unit: 'dB',
        },
        {
            description: t('setting.compressorRatio', { context: 'description' }),
            key: 'ratio',
            max: 20,
            min: 1,
            step: 0.5,
            title: t('setting.compressorRatio'),
            unit: ':1',
        },
        {
            description: t('setting.compressorAttack', { context: 'description' }),
            key: 'attack',
            max: 2000,
            min: 0.1,
            step: 1,
            title: t('setting.compressorAttack'),
            unit: 'ms',
        },
        {
            description: t('setting.compressorRelease', { context: 'description' }),
            key: 'release',
            max: 9000,
            min: 1,
            step: 10,
            title: t('setting.compressorRelease'),
            unit: 'ms',
        },
        {
            description: t('setting.compressorMakeupGain', { context: 'description' }),
            key: 'makeup',
            max: 30,
            min: 0,
            step: 0.5,
            title: t('setting.compressorMakeupGain'),
            unit: 'dB',
        },
        {
            description: t('setting.compressorKnee', { context: 'description' }),
            key: 'knee',
            max: 10,
            min: 1,
            step: 0.5,
            title: t('setting.compressorKnee'),
            unit: 'dB',
        },
    ];

    // ── Compressor SettingsSection options ────────────────────────────────────
    const compressorOptions: SettingOption[] = [
        {
            control: (
                <Switch
                    defaultChecked={settings.compressor.enabled}
                    onChange={(e) => handleCompToggle(e.currentTarget.checked)}
                />
            ),
            description:
                settings.type === PlayerType.LOCAL
                    ? t('setting.compressor', { context: 'descriptionMpv' })
                    : t('setting.compressor', { context: 'descriptionWebAudio' }),
            title: t('setting.compressor'),
        },
        ...(settings.compressor.enabled
            ? ([
                  {
                      control: (
                          <Group gap="xs">
                              <Select
                                  clearable
                                  data={compPresetSelectData}
                                  onChange={(name) => {
                                      if (!name) return;
                                      const preset = customCompPresets[name] ?? COMP_PRESETS[name];
                                      if (preset) applyCompPreset(preset);
                                  }}
                                  placeholder={t('setting.equalizerPresetSelectPlaceholder')}
                                  searchable
                                  value={null}
                                  w={180}
                              />
                              {Object.keys(customCompPresets).length > 0 && (
                                  <Select
                                      clearable
                                      data={Object.keys(customCompPresets).map((name) => ({
                                          label: name,
                                          value: name,
                                      }))}
                                      onChange={(name) => {
                                          if (!name) return;
                                          handleDeleteCompPreset(name);
                                      }}
                                      placeholder={t('setting.equalizerPresetDeletePlaceholder')}
                                      value={null}
                                      w={160}
                                  />
                              )}
                          </Group>
                      ),
                      description: t('setting.compressorPreset', { context: 'description' }),
                      title: t('setting.equalizerPreset'),
                  },
                  {
                      control: (
                          <Group gap="xs">
                              <TextInput
                                  onChange={(e) => setSaveCompName(e.currentTarget.value)}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveCompPreset();
                                  }}
                                  placeholder={t('setting.equalizerPresetNamePlaceholder')}
                                  value={saveCompName}
                                  w={180}
                              />
                              <Button
                                  disabled={!saveCompName.trim()}
                                  onClick={handleSaveCompPreset}
                                  variant="subtle"
                              >
                                  {t('common.save')}
                              </Button>
                          </Group>
                      ),
                      description: t('setting.compressorSavePreset', { context: 'description' }),
                      title: t('setting.equalizerSavePreset'),
                  },
                  // One SettingOption per compressor parameter — Slider + NumberInput
                  ...compParams.map(({ description, key, max, min, step, title, unit }) => ({
                      control: (
                          <Group align="center" gap="xs">
                              <Slider
                                  label={(v) => `${v}${unit}`}
                                  max={max}
                                  min={min}
                                  onChange={(v) => {
                                      setSettings({
                                          playback: {
                                              compressor: { ...settings.compressor, [key]: v },
                                          },
                                      });
                                  }}
                                  onChangeEnd={(v) => handleCompChangeEnd(key, v)}
                                  step={step}
                                  value={settings.compressor[key] as number}
                                  w={200}
                              />
                              {/* Manual value input — remounts with new defaultValue
                       when settings change (preset applied, slider moved) */}
                              <NumberInput
                                  hideControls
                                  max={max}
                                  min={min}
                                  onBlur={(e) => {
                                      const val = parseFloat(e.currentTarget.value);
                                      if (!isNaN(val)) {
                                          const clamped = Math.max(min, Math.min(max, val));
                                          handleCompChangeEnd(key, clamped);
                                      }
                                  }}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter') e.currentTarget.blur();
                                  }}
                                  rightSection={
                                      <Text isMuted size="xs">
                                          {unit}
                                      </Text>
                                  }
                                  size="sm"
                                  step={step}
                                  value={settings.compressor[key] as number}
                                  w={80}
                              />
                          </Group>
                      ),
                      description,
                      title,
                  })),
                  {
                      control: (
                          <Button onClick={handleResetComp} variant="subtle">
                              {t('common.resetToDefault')}
                          </Button>
                      ),
                      description: t('setting.compressorReset', { context: 'description' }),
                      title: t('common.reset'),
                  },
              ] as SettingOption[])
            : []),
    ];

    return (
        <>
            <Divider />
            <SettingsSection options={eqOptions} />
            <Divider />
            <SettingsSection options={compressorOptions} />
        </>
    );
});
