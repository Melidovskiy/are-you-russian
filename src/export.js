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

export async function reportImage(report) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  const ipFamilies = report.ipFamilies || [];
  canvas.height = 490 + report.results.length * 58 + (report.ip ? 170 : 0)
    + (report.webrtcRoute ? 36 : 0) + ipFamilies.length * 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#181818';
  ctx.font = '500 36px Roboto, sans-serif';
  ctx.fillText('are you russian', 70, 85);
  ctx.font = '28px Roboto, sans-serif';
  ctx.fillText('Браузерное окружение для Claude', 70, 145);
  ctx.font = '20px Roboto, sans-serif';
  ctx.fillText('Индекс российских настроек', 70, 190);
  ctx.fillStyle = '#c96442';
  ctx.font = '500 76px Roboto, sans-serif';
  ctx.fillText(`${report.summary.minimum}–${report.summary.maximum} / 100`, 70, 250);
  ctx.fillStyle = '#181818';
  ctx.font = '24px Roboto, sans-serif';
  report.results.forEach((result, i) => {
    const y = 330 + i * 58;
    ctx.fillText(result.label || result.id, 70, y);
    ctx.fillText(`${result.points ?? '—'} / ${result.weight}`, 990, y);
  });
  if (report.ip) {
    const y = 350 + report.results.length * 58;
    ctx.font = '24px Roboto, sans-serif';
    ctx.fillText('Репутация IP', 70, y);
    if (report.ip.status === 'ok') {
      const body = report.ip.result;
      ctx.fillStyle = '#c96442';
      ctx.font = '500 36px Roboto, sans-serif';
      ctx.fillText(body.purity === null ? 'Недостаточно данных' : `${body.purity} / 100`, 70, y + 50);
      ctx.fillStyle = '#626262';
      ctx.font = '20px Roboto, sans-serif';
      ctx.fillText(`${networkTypeLabel(body.network.type)}. Репутация IP: выше — лучше.`, 70, y + 88);
    } else {
      ctx.fillText('Проверка IP недоступна', 70, y + 50);
    }
    if (report.webrtcRoute) {
      ctx.fillStyle = '#626262';
      ctx.font = '20px Roboto, sans-serif';
      ctx.fillText(`WebRTC: ${routeComparisonLabels[report.webrtcRoute.status]}.`, 70, y + 124);
    }
    ctx.fillStyle = '#626262';
    ctx.font = '20px Roboto, sans-serif';
    ipFamilies.forEach((result, i) => {
      ctx.fillText(`IPv${result.family}: ${describeIpFamily(result)}`, 70, y + 156 + 32 * i);
    });
  }
  ctx.fillStyle = '#626262';
  ctx.font = '20px Roboto, sans-serif';
  ctx.fillText('Индекс настроек, не вероятность блокировки аккаунта.', 70, canvas.height - 100);
  ctx.fillText(new Date(report.checkedAt).toLocaleString('ru-RU'), 70, canvas.height - 62);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG unavailable')), 'image/png'));
}
