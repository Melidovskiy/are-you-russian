export interface TimeDeps {
    Date: DateConstructor;
    DateTimeFormat: typeof Intl.DateTimeFormat;
}
export interface Wall {
    y: number;
    m: number;
    d: number;
    wd: number;
    h: number;
    mi: number;
    s: number;
    ms: number;
}
const cache = new WeakMap<object, Map<string, Intl.DateTimeFormat>>();
const GREGORIAN_400_MS = Date.UTC(2000, 0, 1) - Date.UTC(1600, 0, 1);
function utcFromWall(DateCtor: DateConstructor, y: number, m: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number {
    const shift = y >= 0 && y <= 99 ? 400 : 0;
    return DateCtor.UTC(y + shift, m, d, h, mi, s, ms) - (shift ? GREGORIAN_400_MS : 0);
}
function formatter(deps: TimeDeps, timeZone: string, kind: 'parts' | 'name'): Intl.DateTimeFormat {
    let map = cache.get(deps.DateTimeFormat);
    if (!map) {
        map = new Map();
        cache.set(deps.DateTimeFormat, map);
    }
    const key = kind + '\0' + timeZone;
    let dtf = map.get(key);
    if (!dtf) {
        dtf =
            kind === 'name'
                ? new deps.DateTimeFormat('en-US', {
                    timeZone,
                    hourCycle: 'h23',
                    year: 'numeric',
                    timeZoneName: 'long',
                })
                : new deps.DateTimeFormat('en-US', {
                    timeZone,
                    hourCycle: 'h23',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                });
        map.set(key, dtf);
    }
    return dtf;
}
function partMap(dtf: Intl.DateTimeFormat, instant: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (const part of dtf.formatToParts(instant)) {
        if (part.type !== 'literal')
            out[part.type] = part.value;
    }
    return out;
}
export function wallFromInstant(instantMs: number, timeZone: string, deps: TimeDeps): Wall | null {
    if (!Number.isFinite(instantMs))
        return null;
    const map = partMap(formatter(deps, timeZone, 'parts'), instantMs);
    let year = Number(map.year);
    let month = Number(map.month);
    let day = Number(map.day);
    let hour = Number(map.hour);
    const minute = Number(map.minute);
    const second = Number(map.second);
    if (![year, month, day, hour, minute, second].every(Number.isFinite))
        return null;
    if (hour === 24) {
        hour = 0;
        const next = new deps.Date(utcFromWall(deps.Date, year, month - 1, day + 1));
        year = next.getUTCFullYear();
        month = next.getUTCMonth() + 1;
        day = next.getUTCDate();
    }
    const ms = new deps.Date(instantMs).getUTCMilliseconds();
    const wd = new deps.Date(utcFromWall(deps.Date, year, month - 1, day)).getUTCDay();
    return { y: year, m: month - 1, d: day, wd, h: hour, mi: minute, s: second, ms };
}
export function getOffsetMinutes(instantMs: number, timeZone: string, deps: TimeDeps): number {
    const wall = wallFromInstant(instantMs, timeZone, deps);
    if (!wall)
        return 0;
    const asUTC = utcFromWall(deps.Date, wall.y, wall.m, wall.d, wall.h, wall.mi, wall.s, wall.ms);
    return -Math.round((asUTC - instantMs) / 60000);
}
function sameWall(instant: number, y: number, m: number, d: number, h: number, mi: number, s: number, ms: number, timeZone: string, deps: TimeDeps): boolean {
    const wall = wallFromInstant(instant, timeZone, deps);
    return !!wall && wall.y === y && wall.m === m && wall.d === d && wall.h === h && wall.mi === mi && wall.s === s && wall.ms === ms;
}
function offsetsNear(desiredUtc: number, timeZone: string, deps: TimeDeps): number[] {
    const found = new Set<number>();
    const step = 15 * 60 * 1000;
    for (let t = desiredUtc - 18 * 3600000; t <= desiredUtc + 18 * 3600000; t += step) {
        found.add(getOffsetMinutes(t, timeZone, deps));
    }
    found.add(getOffsetMinutes(desiredUtc, timeZone, deps));
    return [...found];
}
export function wallToInstant(y: number, m: number, d: number, h: number, mi: number, s: number, ms: number, timeZone: string, deps: TimeDeps): number {
    const norm = utcFromWall(deps.Date, y, m, d, h, mi, s, ms);
    if (Number.isNaN(norm))
        return NaN;
    const nd = new deps.Date(norm);
    const yy = nd.getUTCFullYear();
    const mm = nd.getUTCMonth();
    const dd = nd.getUTCDate();
    const hh = nd.getUTCHours();
    const mii = nd.getUTCMinutes();
    const ss = nd.getUTCSeconds();
    const mss = nd.getUTCMilliseconds();
    const desired = utcFromWall(deps.Date, yy, mm, dd, hh, mii, ss, mss);
    const off1 = getOffsetMinutes(desired, timeZone, deps);
    const t1 = desired + off1 * 60000;
    if (sameWall(t1, yy, mm, dd, hh, mii, ss, mss, timeZone, deps)) {
        let best = t1;
        for (const delta of [60, -60, 30, -30, 120, -120]) {
            const probe = getOffsetMinutes(t1 + delta * 60000, timeZone, deps);
            if (probe === off1)
                continue;
            const alt = desired + probe * 60000;
            if (alt < best && sameWall(alt, yy, mm, dd, hh, mii, ss, mss, timeZone, deps))
                best = alt;
        }
        return best;
    }
    const hits: number[] = [];
    const misses: number[] = [];
    for (const off of offsetsNear(desired, timeZone, deps)) {
        const instant = desired + off * 60000;
        if (sameWall(instant, yy, mm, dd, hh, mii, ss, mss, timeZone, deps))
            hits.push(instant);
        else
            misses.push(instant);
    }
    if (hits.length)
        return Math.min(...hits);
    if (misses.length)
        return Math.max(...misses);
    return desired;
}
export function longTimeZoneName(instantMs: number, timeZone: string, deps: TimeDeps): string {
    const map = partMap(formatter(deps, timeZone, 'name'), instantMs);
    return map.timeZoneName || timeZone;
}
export function formatGmtOffset(offsetMin: number): string {
    const sign = offsetMin > 0 ? '-' : '+';
    const abs = Math.abs(offsetMin);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `GMT${sign}${hh}${mm}`;
}
export function formatUtcOffsetLabel(offsetMin: number): string {
    const east = -offsetMin;
    const sign = east >= 0 ? '+' : '-';
    const abs = Math.abs(east);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `UTC${sign}${hh}:${mm}`;
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function pad2(n: number): string {
    return String(n).padStart(2, '0');
}
function formatYear(y: number): string {
    if (y >= 0 && y < 10000)
        return String(y).padStart(4, '0');
    const sign = y < 0 ? '-' : '+';
    return sign + String(Math.abs(y));
}
export function formatChromeDate(wall: Wall, offsetMin: number, tzName: string): {
    full: string;
    date: string;
    time: string;
} {
    const date = `${DAYS[wall.wd]} ${MONTHS[wall.m]} ${pad2(wall.d)} ${formatYear(wall.y)}`;
    const time = `${pad2(wall.h)}:${pad2(wall.mi)}:${pad2(wall.s)} ${formatGmtOffset(offsetMin)} (${tzName})`;
    return { date, time, full: `${date} ${time}` };
}
