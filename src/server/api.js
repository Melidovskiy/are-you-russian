import { isIP } from 'node:net';
import { evaluateIp, normalizeIp, renderText, rateLimit } from './ip-purity.js';
import { signalsFor, scoreLanguagesForRegion, scoreBrowserForRegion } from '../core/signals.js';
export function clientIp(socketAddress, headers, trusted = process.env.TRUSTED_PROXY_IPS || '') {
    const peer = normalizeIp(socketAddress);
    if (trusted.split(',').map(x => normalizeIp(x.trim())).filter(Boolean).includes(peer)) {
        const forwarded = normalizeIp(headers.get('x-real-ip'));
        if (forwarded && isIP(forwarded))
            return forwarded;
    }
    return peer && isIP(peer) ? peer : null;
}
function preferredLanguages(header) {
    const accepted = [];
    for (const entry of (header || '').split(',')) {
        const match = /^([a-z]{1,8}(?:-[a-z0-9]{1,8})*)(?:\s*;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i.exec(entry.trim());
        if (!match) continue;
        const quality = Number(match[2] ?? 1);
        if (quality > 0) accepted.push({ tag: match[1].toLowerCase(), quality });
    }
    accepted.sort((a, b) => b.quality - a.quality);
    return [...new Set(accepted.map(entry => entry.tag))];
}
export function checkHeaders(headers) {
    const languages = preferredLanguages(headers.get('accept-language'));
    const ua = headers.get('user-agent') || '';
    const values = {
        language: languages.length ? { value: languages.join(', '), score: scoreLanguagesForRegion(languages, 'ru') } : null,
        cnBrowser: ua ? { value: scoreBrowserForRegion(ua, 'ru').name || ua, score: scoreBrowserForRegion(ua, 'ru').score } : null,
    };
    const signals = signalsFor('ru').map(s => ({ id: s.id, weight: s.weight, measured: Boolean(values[s.id]), value: values[s.id]?.value ?? null, contribution: values[s.id] ? Math.round(values[s.id].score * s.weight) : null }));
    const measuredWeight = signals.filter(x => x.measured).reduce((n, x) => n + x.weight, 0);
    const minimum = signals.reduce((n, x) => n + (x.contribution ?? 0), 0);
    return { region: 'ru', minimum, maximum: minimum + 100 - measuredWeight, measuredWeight, totalWeight: 100, normalizedScore: measuredWeight ? Math.round(minimum / measuredWeight * 100) : null, signals, note: 'HTTP видит только заголовки запроса. Часовой пояс, шрифты, Intl и WebRTC требуют проверки в браузере. Это не оценка аккаунта Anthropic.' };
}
const WHOAMI_HEADERS = [
    'accept-language',
    'user-agent',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    'sec-gpc',
    'dnt',
    'accept-encoding',
];
function decodeGeoHeader(raw) {
    if (!raw) return null;
    try { return decodeURIComponent(raw.replace(/\+/g, ' ')); }
    catch { return raw; }
}
export function whoamiPayload(headers, ip) {
    const picked = {};
    for (const key of WHOAMI_HEADERS) {
        const value = headers.get(key);
        picked[key] = value && value.length > 0 ? value : null;
    }
    return {
        ip,
        geo: {
            country: decodeGeoHeader(headers.get('x-vercel-ip-country')),
            region: decodeGeoHeader(headers.get('x-vercel-ip-country-region')),
            city: decodeGeoHeader(headers.get('x-vercel-ip-city')),
            timezone: decodeGeoHeader(headers.get('x-vercel-ip-timezone')),
        },
        headers: picked,
    };
}
export async function apiResponse(pathname, request, socketAddress) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Accept, Content-Type', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (request.method === 'OPTIONS')
        return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET')
        return new Response('Method not allowed', { status: 405, headers: { ...cors, Allow: 'GET, OPTIONS' } });
    const url = new URL(request.url);
    const json = pathname === '/api/whoami' || url.searchParams.get('format') === 'json' || (!['text', 'txt'].includes(url.searchParams.get('format')) && request.headers.get('accept')?.includes('application/json'));
    const ip = clientIp(socketAddress, request.headers);
    const headers = { ...cors, 'Content-Type': json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8' };
    try {
        let body;
        if (pathname === '/api/whoami') {
            if (!rateLimit(`whoami:${ip ?? 'unknown'}`))
                return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...headers, 'Retry-After': '60' } });
            body = whoamiPayload(request.headers, ip);
        }
        else if (pathname === '/api/ip') {
            const geoHeaders = new Headers();
            for (const name of ['x-vercel-ip-country', 'x-vercel-ip-country-region', 'x-vercel-ip-city']) {
                const value = request.headers.get(name);
                if (value) geoHeaders.set(name, value);
            }
            const outcome = await evaluateIp(geoHeaders, ip);
            if (outcome.kind === 'rate_limited')
                return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...headers, 'Retry-After': '60' } });
            body = outcome.body;
            if (!json)
                return new Response(renderText(body, 'ru'), { headers });
        }
        else {
            if (!rateLimit(`check:${ip ?? 'unknown'}`))
                return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...headers, 'Retry-After': '60' } });
            body = checkHeaders(request.headers);
            if (!json)
                return new Response(`Индекс российских настроек: ${body.minimum}–${body.maximum}/100\nИзмерено: ${body.measuredWeight}/100\n${body.note}\n`, { headers });
        }
        return new Response(JSON.stringify(body, null, 2), { headers });
    }
    catch {
        return new Response(JSON.stringify({ error: 'lookup_failed', message: 'Источник данных недоступен. Попробуйте позднее.' }), { status: 502, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
    }
}
