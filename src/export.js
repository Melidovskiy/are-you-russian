import { networkTypeLabel } from './ip.js';
import { routeComparisonLabels } from './core/webrtc-route.js';
import { describeIpFamily } from './ip-families.js';

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fitText(ctx, value, maxWidth) {
  const text = String(value ?? '');
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

export async function reportImage(report) {
  await document.fonts.ready;
  const dark = document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const palette = dark
    ? { bg: '#141311', surface: '#1c1a17', line: '#2f2c27', text: '#f2eee8', muted: '#a69f96', accent: '#d97757' }
    : { bg: '#f4f1eb', surface: '#fbfaf7', line: '#e0d9ce', text: '#1b1917', muted: '#5d5750', accent: '#d97757' };

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  const ipFamilies = report.ipFamilies || [];
  canvas.height = 500 + report.results.length * 58 + (report.ip ? 175 : 0)
    + (report.webrtcRoute ? 36 : 0) + ipFamilies.length * 32;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = palette.surface;
  ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(40.5, 40.5, canvas.width - 81, canvas.height - 81);

  ctx.fillStyle = palette.accent;
  ctx.fillRect(40, 40, 5, canvas.height - 80);

  ctx.fillStyle = palette.text;
  ctx.font = '650 32px Roboto, Arial, sans-serif';
  ctx.fillText('are you russian', 80, 102);

  ctx.fillStyle = palette.muted;
  ctx.font = '22px "Anthropic Sans", Roboto, sans-serif';
  ctx.fillText('Браузерное окружение для Claude', 80, 142);

  ctx.font = '18px "Anthropic Sans", Roboto, sans-serif';
  ctx.fillText('Индекс российских настроек', 80, 192);

  const scoreText = report.summary.minimum === report.summary.maximum
    ? `${report.summary.minimum} / 100`
    : `${report.summary.minimum}–${report.summary.maximum} / 100`;
  ctx.fillStyle = palette.accent;
  ctx.font = '500 72px "Anthropic Serif", "Source Serif 4", Georgia, serif';
  ctx.fillText(scoreText, 80, 266);

  ctx.fillStyle = palette.text;
  ctx.font = '22px "Anthropic Sans", Roboto, sans-serif';
  report.results.forEach((result, i) => {
    const y = 342 + i * 58;
    ctx.fillStyle = palette.text;
    ctx.fillText(fitText(ctx, result.label || result.id, 840), 80, y);
    ctx.fillStyle = palette.muted;
    const pts = `${result.points ?? '—'} / ${result.weight}`;
    const w = ctx.measureText(pts).width;
    ctx.fillText(pts, canvas.width - 80 - w, y);
  });

  if (report.ip) {
    const y = 368 + report.results.length * 58;
    ctx.fillStyle = palette.text;
    ctx.font = '500 24px "Anthropic Serif", "Source Serif 4", Georgia, serif';
    ctx.fillText('Репутация IP', 80, y);
    if (report.ip.status === 'ok') {
      const body = report.ip.result;
      ctx.fillStyle = palette.accent;
      ctx.font = '500 34px "Anthropic Serif", "Source Serif 4", Georgia, serif';
      ctx.fillText(body.purity === null ? 'Недостаточно данных' : `${body.purity} / 100`, 80, y + 48);
      ctx.fillStyle = palette.muted;
      ctx.font = '19px "Anthropic Sans", Roboto, sans-serif';
      ctx.fillText(fitText(ctx, `${networkTypeLabel(body.network.type)}. Репутация IP: выше — лучше.`, 1020), 80, y + 84);
    } else {
      ctx.fillStyle = palette.muted;
      ctx.font = '20px "Anthropic Sans", Roboto, sans-serif';
      ctx.fillText('Проверка IP недоступна', 80, y + 46);
    }
    if (report.webrtcRoute) {
      ctx.fillStyle = palette.muted;
      ctx.font = '19px "Anthropic Sans", Roboto, sans-serif';
      ctx.fillText(fitText(ctx, `WebRTC: ${routeComparisonLabels[report.webrtcRoute.status]}.`, 1020), 80, y + 120);
    }
    ctx.fillStyle = palette.muted;
    ctx.font = '19px "Anthropic Sans", Roboto, sans-serif';
    ipFamilies.forEach((result, i) => {
      ctx.fillText(fitText(ctx, `IPv${result.family}: ${describeIpFamily(result)}`, 1020), 80, y + 154 + 32 * i);
    });
  }

  ctx.fillStyle = palette.muted;
  ctx.font = '18px "Anthropic Sans", Roboto, sans-serif';
  ctx.fillText('Индекс настроек, не вероятность блокировки аккаунта.', 80, canvas.height - 96);
  ctx.fillText(new Date(report.checkedAt).toLocaleString('ru-RU'), 80, canvas.height - 64);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG unavailable')), 'image/png'));
}
