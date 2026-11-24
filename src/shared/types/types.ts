import { AppRoute } from '@ts-rest/core';
import { TFunction } from 'i18next';
import { ReactNode } from 'react';

import {
    Album,
    AlbumArtist,
    Artist,
    LibraryItem,
    Playlist,
    QueueSong,
    Song,
} from '/@/shared/types/domain-types';
import { ServerFeatures } from '/@/shared/types/features-types';

export enum ItemListKey {
    ALBUM = LibraryItem.ALBUM,
    ALBUM_ARTIST = LibraryItem.ALBUM_ARTIST,
    ALBUM_ARTIST_ALBUM = 'albumArtistAlbum',
    ALBUM_ARTIST_SONG = 'albumArtistSong',
    ALBUM_DETAIL = 'albumDetail',
    ARTIST = LibraryItem.ARTIST,
    FOLDER = LibraryItem.FOLDER,
    FULL_SCREEN = 'fullScreen',
    GENRE = LibraryItem.GENRE,
    GENRE_ALBUM = 'genreAlbum',
    GENRE_SONG = 'genreSong',
    PLAYLIST = LibraryItem.PLAYLIST,
    PLAYLIST_ALBUM = 'playlistAlbum',
    PLAYLIST_SONG = LibraryItem.PLAYLIST_SONG,
    QUEUE_SONG = LibraryItem.QUEUE_SONG,
    RADIO = 'radio',
    SIDE_QUEUE = 'sideQueue',
    SONG = LibraryItem.SONG,
}

export enum ListDisplayType {
    DETAIL = 'detail',
    GRID = 'poster',
    LIST = 'list',
    TABLE = 'table',
}

export enum ListPaginationType {
    INFINITE = 'infinite',
    PAGINATED = 'paginated',
}

export enum Platform {
    LINUX = 'linux',
    MACOS = 'macos',
    WEB = 'web',
    WINDOWS = 'windows',
}

export enum ServerType {
    JELLYFIN = 'jellyfin',
    NAVIDROME = 'navidrome',
    SUBSONIC = 'subsonic',
}

export type CardRoute = {
    route: AppRoute | string;
    slugs?: RouteSlug[];
};

export type CardRow<T> = {
    arrayProperty?: string;
    format?: (value: T, t: TFunction) => ReactNode;
    property: keyof T;
    route?: CardRoute;
};

export type ListPagination = {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
};

export type RouteSlug = {
    idProperty: string;
    slugProperty: string;
};

export const toServerType = (value?: string): null | ServerType => {
    switch (value?.toLowerCase()) {
        case ServerType.JELLYFIN:
            return ServerType.JELLYFIN;
        case ServerType.NAVIDROME:
            return ServerType.NAVIDROME;
        case ServerType.SUBSONIC:
            return ServerType.SUBSONIC;
        default:
            return null;
    }
};

export enum AuthState {
    INVALID = 'invalid',
    LOADING = 'loading',
    VALID = 'valid',
}

export enum CrossfadeStyle {
    CONSTANT_POWER = 'constantPower',
    CONSTANT_POWER_SLOW_CUT = 'constantPowerSlowCut',
    CONSTANT_POWER_SLOW_FADE = 'constantPowerSlowFade',
    DIPPED = 'dipped',
    EQUAL_POWER = 'equalPower',
    EXPONENTIAL = 'exponential',
    LINEAR = 'linear',
    S_CURVE = 'sCurve',
}

export enum EqType {
    BandNotch = 'bandnotch', // Removes a narrow band of frequencies
    HighPass = 'highpass', // Attenuates everything below the cutoff
    HighShelf = 'highshelf', // Boosts or cuts high frequencies
    LowPass = 'lowpass', // Attenuates everything above the cutoff
    LowShelf = 'lowshelf', // Boosts or cuts low frequencies
    Peaking = 'peaking', // Boosts or cuts a narrow band
}

export enum FontType {
    BUILT_IN = 'builtIn',
    CUSTOM = 'custom',
    SYSTEM = 'system',
}

export enum Play {
    INDEX = 'index',
    LAST = 'last',
    LAST_SHUFFLE = 'lastShuffle',
    NEXT = 'next',
    NEXT_SHUFFLE = 'nextShuffle',
    NOW = 'now',
    SHUFFLE = 'shuffle',
}

export enum PlayerQueueType {
    DEFAULT = 'default',
    PRIORITY = 'priority',
}

export enum PlayerRepeat {
    ALL = 'all',
    NONE = 'none',
    ONE = 'one',
}

export enum PlayerShuffle {
    ALBUM = 'album',
    NONE = 'none',
    TRACK = 'track',
}

export enum PlayerStatus {
    PAUSED = 'paused',
    PLAYING = 'playing',
    STOPPED = 'stopped',
}

export enum PlayerStyle {
    CROSSFADE = 'crossfade',
    GAPLESS = 'gapless',
}

export enum PlayerType {
    DLNA = 'dlna',
    JUKEBOX = 'jukebox',
    LOCAL = 'local',
    WEB = 'web',
}

export enum TableColumn {
    ACTIONS = 'actions',
    ALBUM = 'album',
    ALBUM_ARTIST = 'albumArtists',
    ALBUM_COUNT = 'albumCount',
    ALBUM_GROUP = 'albumGroup',
    ARTIST = 'artists',
    BIOGRAPHY = 'biography',
    BIT_DEPTH = 'bitDepth',
    BIT_RATE = 'bitRate',
    BPM = 'bpm',
    CHANNELS = 'channels',
    CODEC = 'container',
    COMMENT = 'comment',
    COMPOSER = 'composer',
    DATE = 'date',
    DATE_ADDED = 'createdAt',
    DISC_NUMBER = 'discNumber',
    DURATION = 'duration',
    GENRE = 'genres',
    GENRE_BADGE = 'genreBadge',
    ID = 'id',
    IMAGE = 'imageUrl',
    LAST_PLAYED = 'lastPlayedAt',
    LAYOUT_FILL = '__layoutFill',
    OWNER = 'username',
    PATH = 'path',
    PLAY_COUNT = 'playCount',
    PLAYLIST_REORDER = 'playlistReorder',
    RELEASE_DATE = 'releaseDate',
    RELEASE_YEAR = 'releaseYear',
    ROW_INDEX = 'rowIndex',
    SAMPLE_RATE = 'sampleRate',
    SIZE = 'size',
    SKIP = 'skip',
    SONG_COUNT = 'songCount',
    TITLE = 'name',
    TITLE_ARTIST = 'titleArtist',
    TITLE_COMBINED = 'titleCombined',
    TRACK_NUMBER = 'trackNumber',
    USER_FAVORITE = 'userFavorite',
    USER_RATING = 'userRating',
    YEAR = 'year',
}

export type DiscoveredServerItem = {
    name: string;
    type: ServerType;
    url: string;
};

export interface EqBand {
    freq: number; // Center frequency in Hz
    gain: number; // Gain in dB, clamped to [-12, 12]
    // Present for bands created by the UI/presets; optional so settings
    // saved before the parametric EQ upgrade still parse.
    id?: string;
    qFactor: number; // Quality factor (0.3–5.0), controls band width
    type: EqType; // EQ filter type
}

export interface EqSettings {
    bands: EqBand[]; // Dynamic array — defaults to 3 bands (Low / Mid / High)
    enabled: boolean;
    preamp: number; // Pre-gain in dB, clamped to [-12, 12]
}

export type GridCardData = {
    cardControls: any;
    cardRows: CardRow<Album | AlbumArtist | Artist | Playlist | Song>[];
    columnCount: number;
    display: ListDisplayType;
    handleFavorite: (options: { id: string[]; isFavorite: boolean; itemType: LibraryItem }) => void;
    handlePlayQueueAdd: (options: PlayQueueAddOptions) => void;
    itemCount: number;
    itemData: any[];
    itemGap: number;
    itemHeight: number;
    itemType: LibraryItem;
    itemWidth: number;
    playButtonBehavior: Play;
    resetInfiniteLoaderCache: () => void;
    route: CardRoute;
};

export type PlayQueueAddOptions = {
    byData?: QueueSong[];
    byItemType?: {
        id: string[];
        type: LibraryItem;
    };
    initialIndex?: number;
    initialSongId?: string;
    playType: Play;
    query?: Record<string, any>;
};

export type QueryBuilderGroup = {
    group: QueryBuilderGroup[];
    rules: QueryBuilderRule[];
    type: 'all' | 'any';
    uniqueId: string;
};

export type QueryBuilderRule = {
    field?: null | string;
    operator?: null | string;
    uniqueId: string;
    value?: any | Date | null | number | string | undefined;
};

export type ServerListItem = {
    credential: string;
    features?: ServerFeatures;
    id: string;
    name: string;
    ndCredential?: string;
    preferRemoteUrl?: boolean;
    remoteUrl?: string;
    savePassword?: boolean;
    type: ServerType;
    url: string;
    userId: null | string;
    username: string;
    version?: string;
};

export type SongState = {
    position?: number;
    repeat?: PlayerRepeat;
    shuffle?: boolean;
    song?: QueueSong;
    status?: PlayerStatus;
    /** This volume is in range 0-100 */
    volume?: number;
};

export type TitleTheme = 'dark' | 'light' | 'system';

export interface UniqueId {
    uniqueId: string;
}

export type WebAudio = {
    context: AudioContext;
    dsp: null | {
        compressor: DynamicsCompressorNode;
        eqFilters: BiquadFilterNode[];
        preampGain: GainNode;
    };
    gains: GainNode[];
    visualizerInputs?: AudioNode[];
};

const generateId = (): string =>
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

const bandFactory = (
    freq: number,
    gain: number,
    type: EqType = EqType.Peaking,
    qFactor = 1.41,
): EqBand => ({
    freq,
    gain,
    id: generateId(),
    qFactor,
    type,
});

// Default 3-band EQ: low shelf / peaking mid / high shelf.
export const getDefaultEqBands = (): EqBand[] => [
    bandFactory(300, 0, EqType.LowShelf, 1.5),
    bandFactory(3000, 0, EqType.Peaking, 2.0),
    bandFactory(6300, 0, EqType.HighShelf, 1.8),
];

// ─── Preset definitions ────────────────────────────────────────────────
export type EqPreset = {
    bands: EqBand[];
    name: string;
};

// Shared module state — callers that persist a preset should clone the
// bands and regenerate ids so two applications never share band ids.
export const eqPresets: EqPreset[] = [
    {
        bands: getDefaultEqBands(),
        name: 'Flat',
    },
    {
        bands: [
            bandFactory(300, 2),
            bandFactory(600, 2),
            bandFactory(1200, 3),
            bandFactory(2400, 2),
            bandFactory(4800, 1),
            bandFactory(9600, 0),
        ],
        name: 'Acoustic',
    },
    {
        bands: [
            bandFactory(300, 6),
            bandFactory(240, 5),
            bandFactory(180, 4),
            bandFactory(120, 2, EqType.LowShelf),
        ],
        name: 'Bass Boost',
    },
    {
        bands: [
            bandFactory(300, -6),
            bandFactory(240, -5),
            bandFactory(180, -4),
            bandFactory(120, -2, EqType.LowShelf),
        ],
        name: 'Bass Cut',
    },
    {
        bands: [
            bandFactory(300, 4),
            bandFactory(600, 3),
            bandFactory(1200, 1),
            bandFactory(2400, 0),
            bandFactory(4800, -1),
            bandFactory(9600, 1),
            bandFactory(19200, 3, EqType.HighShelf),
        ],
        name: 'Electronic',
    },
    {
        bands: [
            bandFactory(300, 5),
            bandFactory(240, 4),
            bandFactory(180, 2),
            bandFactory(120, 1, EqType.LowShelf),
            bandFactory(9600, -1),
            bandFactory(19200, 3, EqType.HighShelf),
        ],
        name: 'Hip-Hop',
    },
];
