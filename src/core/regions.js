import {
  CN_TIMEZONES,
  GREATER_CN_TIMEZONES,
  CN_BROWSER_PATTERNS,
  CN_DEVICE_PATTERNS,
  FONTS_SC,
  FONTS_CN_VENDOR
} from "./signals-cn-assets.js";
const WEIGHTS_CN = {
  timezone: 24,
  language: 18,
  fonts: 14,
  vendorFonts: 10,
  webrtcLeak: 10,
  cnBrowser: 8,
  deviceVendor: 6,
  intlLocale: 4,
  timezoneOffset: 3,
  emoji: 3
};
const WEIGHTS_RU = {
  timezone: 40,
  language: 35,
  fonts: 0,
  vendorFonts: 14,
  webrtcLeak: 0,
  cnBrowser: 11,
  deviceVendor: 0,
  intlLocale: 0,
  timezoneOffset: 0,
  emoji: 0
};
const WEIGHTS_IR = {
  timezone: 34,
  language: 24,
  fonts: 20,
  vendorFonts: 0,
  webrtcLeak: 10,
  cnBrowser: 0,
  deviceVendor: 0,
  intlLocale: 5,
  timezoneOffset: 4,
  emoji: 3
};
const WEIGHTS_CU = {
  timezone: 50,
  language: 25,
  fonts: 0,
  vendorFonts: 0,
  webrtcLeak: 15,
  cnBrowser: 0,
  deviceVendor: 0,
  intlLocale: 7,
  timezoneOffset: 0,
  emoji: 3
};
const WEIGHTS_SY = {
  timezone: 45,
  language: 25,
  fonts: 0,
  vendorFonts: 0,
  webrtcLeak: 15,
  cnBrowser: 0,
  deviceVendor: 0,
  intlLocale: 7,
  timezoneOffset: 5,
  emoji: 3
};
const WEIGHTS_MM = {
  timezone: 32,
  language: 22,
  fonts: 22,
  vendorFonts: 0,
  webrtcLeak: 10,
  cnBrowser: 0,
  deviceVendor: 0,
  intlLocale: 6,
  timezoneOffset: 5,
  emoji: 3
};
const REGIONS = {
  cn: {
    id: "cn",
    timezones: CN_TIMEZONES,
    partialTimezones: GREATER_CN_TIMEZONES,
    offsetEastMinutes: 480,
    languages: [],
    fontProbe: "\u4E2D\u6587\u5B57\u4F53\u68C0\u6D4BABCabc012",
    fonts: FONTS_SC,
    vendorFonts: FONTS_CN_VENDOR,
    browsers: CN_BROWSER_PATTERNS,
    devices: CN_DEVICE_PATTERNS,
    weights: WEIGHTS_CN
  },
  ru: {
    id: "ru",
    timezones: [
      "Europe/Kaliningrad",
      "Europe/Moscow",
      "Europe/Simferopol",
      "Europe/Kirov",
      "Europe/Volgograd",
      "Europe/Astrakhan",
      "Europe/Saratov",
      "Europe/Ulyanovsk",
      "Europe/Samara",
      "Asia/Yekaterinburg",
      "Asia/Omsk",
      "Asia/Novosibirsk",
      "Asia/Barnaul",
      "Asia/Tomsk",
      "Asia/Novokuznetsk",
      "Asia/Krasnoyarsk",
      "Asia/Irkutsk",
      "Asia/Chita",
      "Asia/Yakutsk",
      "Asia/Khandyga",
      "Asia/Vladivostok",
      "Asia/Ust-Nera",
      "Asia/Magadan",
      "Asia/Sakhalin",
      "Asia/Srednekolymsk",
      "Asia/Kamchatka",
      "Asia/Anadyr"
    ],
    partialTimezones: [],
    offsetEastMinutes: null,
    languages: [
      { tag: "ru-ru", score: 1 },
      { tag: "ru", score: 0.8 }
    ],
    fontProbe: "\u041F\u0440\u0438\u0432\u0435\u0442 \u043C\u0438\u0440 ABCabc012",
    fonts: [],
    vendorFonts: ["YS Text", "YS Display", "SB Sans Text", "SB Sans Display", "VK Sans Display"],
    browsers: [[/yabrowser|yowser/i, "Yandex Browser"]],
    devices: [],
    weights: WEIGHTS_RU
  },
  ir: {
    id: "ir",
    timezones: ["Asia/Tehran"],
    partialTimezones: [],
    offsetEastMinutes: 210,
    languages: [
      { tag: "fa-ir", score: 1 },
      { tag: "fa", score: 0.8 }
    ],
    fontProbe: "\u0627\u06CC\u0631\u0627\u0646 \u0641\u0627\u0631\u0633\u06CC ABCabc012",
    fonts: [
      "B Nazanin",
      "B Titr",
      "B Yekan",
      "B Mitra",
      "B Lotus",
      "B Zar",
      "IRANSans",
      "IRANSansX",
      "Vazir",
      "Vazirmatn",
      "Sahel",
      "Shabnam",
      "Samim",
      "Tanha",
      "Parastoo",
      "Estedad"
    ],
    vendorFonts: [],
    browsers: [],
    devices: [],
    weights: WEIGHTS_IR
  },
  cu: {
    id: "cu",
    timezones: ["America/Havana"],
    partialTimezones: [],
    offsetEastMinutes: null,
    languages: [
      { tag: "es-cu", score: 1 },
      { tag: "es", score: 0.3 }
    ],
    fontProbe: "",
    fonts: [],
    vendorFonts: [],
    browsers: [],
    devices: [],
    weights: WEIGHTS_CU
  },
  sy: {
    id: "sy",
    timezones: ["Asia/Damascus"],
    partialTimezones: [],
    offsetEastMinutes: 180,
    languages: [
      { tag: "ar-sy", score: 1 },
      { tag: "ar", score: 0.3 }
    ],
    fontProbe: "",
    fonts: [],
    vendorFonts: [],
    browsers: [],
    devices: [],
    weights: WEIGHTS_SY
  },
  mm: {
    id: "mm",
    timezones: ["Asia/Yangon", "Asia/Rangoon"],
    partialTimezones: [],
    offsetEastMinutes: 390,
    languages: [
      { tag: "my-mm", score: 1 },
      { tag: "my", score: 0.9 }
    ],
    fontProbe: "\u1019\u103C\u1014\u103A\u1019\u102C ABCabc012",
    fonts: [
      "Pyidaungsu",
      "Padauk",
      "Myanmar3",
      "Zawgyi-One",
      "Masterpiece Uni Sans",
      "Parabaik",
      "WinUni Innwa",
      "Myanmar Sans Pro"
    ],
    vendorFonts: [],
    browsers: [],
    devices: [],
    weights: WEIGHTS_MM
  }
};
const LANG_REGION = {
  en: "cn",
  zh: "cn",
  ru: "ru",
  fa: "ir",
  es: "cu",
  ar: "sy",
  my: "mm"
};
function regionForLang(lang) {
  return LANG_REGION[lang];
}
function listWeightPair(weight, listLength, id, field) {
  const empty = listLength === 0;
  const zero = weight === 0;
  if (empty !== zero) {
    throw new Error(`Region ${id}: ${field} empty=${empty} but weight=${weight}`);
  }
}
const REGION_IDS = ["cn", "ru", "ir", "cu", "sy", "mm"];
function assertRegionProfiles() {
  for (const id of REGION_IDS) {
    const p = REGIONS[id];
    const sum = Object.values(p.weights).reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      throw new Error(`Region ${p.id} weights sum to ${sum}, expected 100`);
    }
    listWeightPair(p.weights.fonts, p.fonts.length, p.id, "fonts");
    listWeightPair(p.weights.vendorFonts, p.vendorFonts.length, p.id, "vendorFonts");
    listWeightPair(p.weights.cnBrowser, p.browsers.length, p.id, "browsers");
    listWeightPair(p.weights.deviceVendor, p.devices.length, p.id, "devices");
    const offsetActive = p.weights.timezoneOffset > 0;
    const offsetSet = p.offsetEastMinutes !== null;
    if (offsetActive !== offsetSet) {
      throw new Error(`Region ${p.id}: timezoneOffset weight vs offsetEastMinutes mismatch`);
    }
  }
}
export {
  REGIONS,
  assertRegionProfiles,
  regionForLang
};
