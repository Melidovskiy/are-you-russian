const button = document.getElementById('check-ip');
const output = document.getElementById('ip-result');
const types = { Residential: 'Домашняя сеть', Datacenter: 'Дата-центр', Business: 'Бизнес-сеть', Unknown: 'Неизвестно' };
const labels = { proxy: 'Прокси', vpn: 'VPN', tor: 'Tor', datacenter: 'Дата-центр', abusive: 'Жалобы' };
const deductions = { datacenter: 'Адрес дата-центра', business: 'Бизнес-сеть', tor: 'Выход Tor', proxy_vpn: 'Прокси и VPN', proxy: 'Прокси', vpn: 'VPN', abuse: 'Оценка жалоб AbuseIPDB', abuser: 'Адрес отмечен за нарушения', proxycheck_risk: 'Оценка риска proxycheck', conflict: 'Источники расходятся: выбран более строгий вариант' };
button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Проверяем IP…';
  output.hidden = false;
  output.textContent = 'Запрашиваем источники репутации…';
  try {
    const response = await fetch(new URL('./api/ip?format=json', document.baseURI), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (response.status === 429) throw new Error('Слишком много запросов. Повторите через минуту.');
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Проверка IP требует серверного API. На статическом хостинге доступны браузерные проверки.');
    const body = await response.json();
    const dl = document.createElement('dl');
    dl.className = 'measurements';
    const rows = [
      ['Выходной IP', body.ip || 'Не определён'],
      ['Страна / город', [body.geo.country, body.geo.city].filter(Boolean).join(' / ') || 'Неизвестно'],
      ['Сеть', `${body.network.asn || ''} ${body.network.org || body.network.isp || ''}`.trim() || 'Неизвестно'],
      ['Тип', types[body.network.type] || body.network.type],
      ['Репутация', body.purity === null ? 'Недостаточно данных' : `${body.purity} / 100 (выше — лучше)`],
      ...Object.entries(body.flags).map(([key, value]) => [labels[key] || key, value === null ? 'Неизвестно' : value ? 'Да' : 'Нет']),
      ...Object.entries(body.sources).map(([key, value]) => [key, { ok: 'Получены данные', unavailable: 'Недоступен', unconfigured: 'Ключ не настроен', error: 'Ошибка источника' }[value.status] || value.status]),
      ...body.deductions.map(d => [d.source, `${deductions[d.code] || d.label}: ${d.points}`]),
    ];
    for (const [label, value] of rows) {
      const row = document.createElement('div'); row.className = 'measurement';
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value;
      row.append(dt, dd); dl.append(row);
    }
    output.replaceChildren(dl);
    if (body.notice) {
      const notice = document.createElement('p');
      notice.textContent = { no_ip: 'Не удалось определить IP.', private_ip: 'Локальный адрес: внешняя репутация не проверяется.', unconfigured: 'Ключи источников репутации не настроены.', partial: 'Данные неполные.', degraded: 'Часть источников недоступна.' }[body.notice.code] || 'Данные неполные.';
      output.append(notice);
    }
    const note = document.createElement('p'); note.className = 'section-description';
    note.textContent = 'Репутация IP — отдельная оценка по методике FuckClaude. Она не добавляется к браузерному индексу и не предсказывает решение Anthropic. Отсутствие данных не означает отсутствие риска.';
    output.append(note);
  } catch (error) { output.textContent = error.name === 'TimeoutError' ? 'Источники не ответили вовремя. Попробуйте позднее.' : error.message; }
  finally { button.disabled = false; button.textContent = 'Проверить IP'; }
});
