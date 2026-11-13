import {
  REGIONS,
  assertRegionProfiles,
  regionForLang
} from "./regions.js";
import {
  CN_TIMEZONES,
  CLAUDE_TIMEZONES,
  GREATER_CN_TIMEZONES,
  FONTS_SC,
  FONTS_TC,
  FONTS_CN_VENDOR,
  CN_BROWSER_PATTERNS,
  CN_DEVICE_PATTERNS
} from "./signals-cn-assets.js";
function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}
function scoreTimezoneForRegion(tz, profile) {
  if (profile.timezones.includes(tz)) return 1;
  if (profile.partialTimezones.includes(tz)) return 0.6;
  return 0;
}
function scoreTimezone(tz) {
  return scoreTimezoneForRegion(tz, REGIONS.cn);
}
function scoreGenericLanguages(langs, table) {
  const list = langs.map((l) => (l || "").toLowerCase()).filter(Boolean);
  let best = 0;
  for (let i = 0; i < list.length; i++) {
    const lang = list[i];
    for (const { tag, score } of table) {
      const t = tag.toLowerCase();
      const match = lang === t || lang.startsWith(`${t}-`);
      if (match) {
        const s = i === 0 ? score : score * 0.7;
        if (s > best) best = s;
        break;
      }
    }
  }
  return best;
}
function scoreLanguages(langs) {
  const list = langs.map((l) => (l || "").toLowerCase()).filter(Boolean);
  const isTW = (l) => l.startsWith("zh-tw") || l.includes("hant") && l.includes("tw");
  const isHKMO = (l) => l.startsWith("zh-hk") || l.startsWith("zh-mo");
  const isTrad = (l) => isTW(l) || isHKMO(l) || l.includes("hant");
  const firstTrad = list.findIndex(isTrad);
  const isHansCN = (l, i) => l.startsWith("zh-cn") || l.includes("hans") || l === "zh" && (firstTrad === -1 || i < firstTrad);
  const kept = list.map((l, i) => ({ l, i })).filter(({ l, i }) => !isTW(l) && !(l === "zh" && firstTrad !== -1 && i > firstTrad));
  const primary = kept[0];
  if (!primary) return 0;
  if (isHansCN(primary.l, primary.i)) return 1;
  if (isHKMO(primary.l) || primary.l.includes("hant")) return 0.5;
  if (kept.some(({ l, i }) => isHansCN(l, i))) return 0.7;
  if (kept.some(({ l }) => l.startsWith("zh"))) return 0.4;
  return 0;
}
function scoreLanguagesForRegion(langs, regionId) {
  if (regionId === "cn") return scoreLanguages(langs);
  return scoreGenericLanguages(langs, REGIONS[regionId].languages);
}
function scoreCnIntlLocale(locale) {
  const l = locale.toLowerCase();
  if (l.startsWith("zh-cn") || l.includes("hans") || l === "zh") return 1;
  if (l.startsWith("zh") && !l.startsWith("zh-tw")) return 0.5;
  return 0;
}
function scoreIntlLocaleForRegion(locale, regionId) {
  if (regionId === "cn") return scoreCnIntlLocale(locale);
  return scoreGenericLanguages([locale], REGIONS[regionId].languages);
}
function scoreTimezoneOffsetMinutes(offsetMinutesWestOfUtc, profile) {
  if (profile.offsetEastMinutes === null) return 0;
  const expectedWest = -profile.offsetEastMinutes;
  return offsetMinutesWestOfUtc === expectedWest ? 0.7 : 0;
}
function isFontAvailable(font, testString, ctx) {
  const size = "72px";
  const bases = ["monospace", "sans-serif", "serif"];
  return bases.some((base) => {
    ctx.font = `${size} ${base}`;
    const baseWidth = ctx.measureText(testString).width;
    ctx.font = `${size} "${font}", ${base}`;
    const testWidth = ctx.measureText(testString).width;
    return Math.abs(testWidth - baseWidth) > 0.5;
  });
}
function detectRegionalFonts(profile) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { raw: "canvas unavailable", score: 0 };
  const hit = profile.fonts.filter((f) => isFontAvailable(f, profile.fontProbe, ctx));
  let score = 0;
  if (hit.length >= 1) score = Math.min(1, 0.75 + 0.08 * hit.length);
  const raw = hit.length ? hit.slice(0, 4).join(", ") + (hit.length > 4 ? "\u2026" : "") : "none detected";
  return { raw, score };
}
function detectCnFonts() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { raw: "canvas unavailable", score: 0 };
  const probe = REGIONS.cn.fontProbe;
  const sc = FONTS_SC.filter((f) => isFontAvailable(f, probe, ctx));
  const tc = FONTS_TC.filter((f) => isFontAvailable(f, probe, ctx));
  let score = 0;
  if (sc.length >= 1) score = Math.min(1, 0.75 + 0.08 * sc.length);
  else if (tc.length >= 1) score = 0.2;
  const hit = [...sc, ...tc];
  const raw = hit.length ? hit.slice(0, 4).join(", ") + (hit.length > 4 ? "\u2026" : "") : "none detected";
  return { raw, score };
}
function detectVendorFonts(profile) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { raw: "canvas unavailable", score: 0 };
  const probe = profile.fontProbe || "ABCabc012";
  const hit = profile.vendorFonts.filter((f) => isFontAvailable(f, probe, ctx));
  let score = 0;
  if (profile.id === "cn") {
    score = hit.length >= 2 ? 1 : hit.length === 1 ? 0.8 : 0;
  } else if (hit.length >= 1) {
    score = Math.min(1, 0.75 + 0.08 * hit.length);
  }
  const raw = hit.length ? hit.slice(0, 3).join(", ") + (hit.length > 3 ? "\u2026" : "") : "none detected";
  return { raw, score };
}
function uaData() {
  return navigator.userAgentData;
}
function scoreBrowserPatterns(probe, patterns) {
  for (const [re, name] of patterns) {
    if (re.test(probe)) return { name, score: 1 };
  }
  return { name: null, score: 0 };
}
function scoreCnBrowser(probe) {
  return scoreBrowserPatterns(probe, CN_BROWSER_PATTERNS);
}
function scoreBrowserForRegion(probe, regionId) {
  return scoreBrowserPatterns(probe, REGIONS[regionId].browsers);
}
function scoreCnDevice(probe) {
  return scoreDevicePatterns(probe, CN_DEVICE_PATTERNS);
}
function scoreDevicePatterns(probe, patterns) {
  for (const [re, name, score] of patterns) {
    if (re.test(probe)) return { name, score };
  }
  return { name: null, score: 0 };
}
function scoreDeviceForRegion(probe, regionId) {
  return scoreDevicePatterns(probe, REGIONS[regionId].devices);
}
function scoreEmojiVendor(probe) {
  const p = probe.toLowerCase();
  let vendor = "Unknown";
  if (/iphone|ipad|ipod|mac/.test(p)) vendor = "Apple";
  else if (/android/.test(p)) vendor = "Google";
  else if (/win/.test(p)) vendor = "Microsoft";
  else if (/cros/.test(p)) vendor = "Google";
  else if (/linux/.test(p)) vendor = "Linux / Other";
  const vendorScore = {
    Apple: 0.25,
    Microsoft: 0.4,
    Google: 0.35,
    "Linux / Other": 0.5,
    Unknown: 0.4
  };
  return { vendor, score: vendorScore[vendor] ?? 0.4 };
}
function detectWebrtcLeak() {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.RTCPeerConnection) {
      resolve({ raw: "no leak detected", score: 0 });
      return;
    }
    let resolved = false;
    const ips = [];
    let pc = null;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      try {
        if (pc) pc.close();
      } catch {
      }
      if (ips.length === 0) {
        resolve({ raw: "no leak detected", score: 0 });
      } else {
        const raw = ips.slice(0, 2).join(", ");
        resolve({ raw: `candidate leak (${raw})`, score: 0.5 });
      }
    };
    try {
      pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pc.onicecandidate = (e) => {
        if (!e.candidate || !e.candidate.candidate) {
          finish();
          return;
        }
        const match = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/i.exec(e.candidate.candidate);
        if (match && match[1] && !ips.includes(match[1])) {
          ips.push(match[1]);
        }
      };
      pc.createDataChannel("");
      pc.createOffer().then((sdp) => pc?.setLocalDescription(sdp)).catch(() => finish());
    } catch {
      finish();
    }
    setTimeout(finish, 1e3);
  });
}
const ICON = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  clockOffset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4h4"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/></svg>',
  type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6V5h14v1M12 5v14M9 19h6"/></svg>',
  typeBox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.6 15.5 12 8l3.4 7.5M9.8 13h4.4"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.2 8.8-1.7 4.7-4.7 1.7 1.7-4.7z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 17.5h2"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.4 2 3.5 2 3.5-2 3.5-2"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>'
};
const SIGNAL_ICONS = {
  timezone: ICON.clock,
  timezoneOffset: ICON.clockOffset,
  language: ICON.globe,
  intlLocale: ICON.sliders,
  fonts: ICON.type,
  vendorFonts: ICON.typeBox,
  cnBrowser: ICON.compass,
  deviceVendor: ICON.phone,
  webrtcLeak: ICON.shield,
  emoji: ICON.smile
};
const SERVER_MEASURABLE = new Set([
  "timezone",
  "language",
  "cnBrowser",
  "deviceVendor",
  "timezoneOffset",
  "emoji"
]);
function isServerMeasurable(id) {
  return SERVER_MEASURABLE.has(id);
}
function normLangs() {
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  return list.map((l) => (l || "").toLowerCase());
}
function makeDetectors(regionId, profile) {
  return {
    timezone: () => {
      const tz = getTimezone();
      return { raw: tz || "unknown", score: scoreTimezoneForRegion(tz, profile) };
    },
    timezoneOffset: () => {
      const offset = (new Date()).getTimezoneOffset();
      const utcHours = -offset / 60;
      const sign = utcHours >= 0 ? "+" : "-";
      const raw = `UTC${sign}${Math.abs(utcHours)}`;
      return { raw, score: scoreTimezoneOffsetMinutes(offset, profile) };
    },
    language: () => {
      const langs = normLangs();
      return {
        raw: langs.join(", ") || "unknown",
        score: scoreLanguagesForRegion(langs, regionId)
      };
    },
    intlLocale: () => {
      let locale = "";
      try {
        locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
      } catch {
        locale = "";
      }
      return {
        raw: locale || "unknown",
        score: scoreIntlLocaleForRegion(locale, regionId)
      };
    },
    fonts: () => regionId === "cn" ? detectCnFonts() : detectRegionalFonts(profile),
    vendorFonts: () => detectVendorFonts(profile),
    webrtcLeak: detectWebrtcLeak,
    cnBrowser: () => {
      const brands = (uaData()?.brands ?? []).map((b) => b.brand).join(" ");
      const { name, score } = scoreBrowserPatterns(`${navigator.userAgent} ${brands}`, profile.browsers);
      return { raw: name ?? "none detected", score };
    },
    deviceVendor: async () => {
      let extra = "";
      try {
        const high = await uaData()?.getHighEntropyValues?.(["model", "platform", "platformVersion"]);
        if (high) extra = ` ${String(high.model ?? "")} ${String(high.platform ?? "")}`;
      } catch {
      }
      const { name, score } = scoreDevicePatterns(`${navigator.userAgent}${extra}`, profile.devices);
      return { raw: name ?? "none detected", score };
    },
    emoji: () => {
      const ua = (navigator.userAgent || "").toLowerCase();
      const platform = (navigator.platform || "").toLowerCase();
      const { vendor, score } = scoreEmojiVendor(`${platform} ${ua}`);
      return { raw: `${vendor} style`, score };
    }
  };
}
function signalsFor(regionId) {
  const profile = REGIONS[regionId];
  const detectors = makeDetectors(regionId, profile);
  const defs = [];
  for (const id of Object.keys(profile.weights)) {
    const weight = profile.weights[id];
    if (weight <= 0) continue;
    defs.push({
      id,
      weight,
      claudeUsed: regionId === "cn" && id === "timezone" ? true : void 0,
      icon: SIGNAL_ICONS[id],
      detect: detectors[id]
    });
  }
  defs.sort((a, b) => b.weight - a.weight);
  return defs;
}
const SIGNALS = signalsFor("cn");
function measuredWeightForRegion(regionId) {
  const profile = REGIONS[regionId];
  let total = 0;
  for (const id of Object.keys(profile.weights)) {
    if (profile.weights[id] > 0 && isServerMeasurable(id)) total += profile.weights[id];
  }
  return total;
}
function activeWeightForRegion(regionId) {
  return Object.values(REGIONS[regionId].weights).reduce((a, b) => a + b, 0);
}
function riskBand(total) {
  if (total <= 30) return "low";
  if (total <= 60) return "medium";
  return "high";
}
function signalVerdict(score) {
  if (score >= 0.6) return "high";
  if (score >= 0.25) return "medium";
  return "low";
}
assertRegionProfiles();
export {
  CLAUDE_TIMEZONES,
  CN_TIMEZONES,
  FONTS_CN_VENDOR,
  FONTS_SC,
  FONTS_TC,
  GREATER_CN_TIMEZONES,
  REGIONS,
  SIGNALS,
  activeWeightForRegion,
  isServerMeasurable,
  measuredWeightForRegion,
  regionForLang,
  riskBand,
  scoreBrowserForRegion,
  scoreBrowserPatterns,
  scoreCnBrowser,
  scoreCnDevice,
  scoreDeviceForRegion,
  scoreDevicePatterns,
  scoreEmojiVendor,
  scoreLanguages,
  scoreLanguagesForRegion,
  scoreTimezone,
  scoreTimezoneForRegion,
  scoreTimezoneOffsetMinutes,
  signalVerdict,
  signalsFor
};
