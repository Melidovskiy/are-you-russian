export const guideCategories = {
  checks: 'Результаты проверки',
  environment: 'Окружение Claude',
  network: 'Сеть и доступ',
};

export const guideSources = {
  regions: { title: 'Anthropic — региональная политика', url: 'https://www.anthropic.com/legal/supported-regions' },
  errors: { title: 'Claude API — коды ошибок', url: 'https://platform.claude.com/docs/en/api/errors' },
  network: { title: 'Claude Code — требования к сети и доменам', url: 'https://code.claude.com/docs/en/network-config' },
  status: { title: 'Claude — состояние сервисов', url: 'https://status.claude.com/' },
  upstream: { title: 'FuckClaude — исходная методика проверки', url: 'https://github.com/LinXiaoTao/FuckClaude' },
  cage: { title: 'Claude Cage — исходный код и описание проекта', url: 'https://github.com/Lee-xeo/Claude-Cage' },
  cageDocs: { title: 'Claude Cage — документация разработчиков', url: 'https://claude-cage.com/docs/' },
};

export const guides = [
  {
    slug: 'antiban-essentials', category: 'checks',
    title: 'Что показывает проверка',
    summary: 'Как читать индекс браузера и репутацию IP. Что можно установить по результату.',
    related: ['environment-cleanup-and-ip-setup', 'claude-cage'],
    sources: ['upstream', 'regions'],
  },
  {
    slug: 'environment-cleanup-and-ip-setup', category: 'checks',
    title: 'Браузер и региональные признаки',
    summary: 'Часовой пояс, языки, шрифты и WebRTC. Какие данные доступны странице и где заканчивается проверка.',
    related: ['antiban-essentials', 'claude-cage'],
    sources: ['upstream', 'cage'],
  },
  {
    slug: 'claude-cage', category: 'environment',
    title: 'Claude Cage',
    summary: 'Изолированная среда для Claude из китайского сообщества. Наш опыт проверки и возможности проекта.',
    related: ['vpn-and-proxy-selection', 'troubleshooting-guide'],
    sources: ['cage', 'cageDocs', 'regions'],
  },
  {
    slug: 'vpn-and-proxy-selection', category: 'network',
    title: 'VPS и маршрут к Claude',
    summary: 'Выходной IP, DNS и домены Claude. Что требуется от сети и почему аренды сервера недостаточно.',
    related: ['claude-cage', 'troubleshooting-guide'],
    sources: ['network', 'cage', 'regions'],
  },
  {
    slug: 'troubleshooting-guide', category: 'network',
    title: 'Как различать ошибки доступа',
    summary: 'Тайм-аут, ошибка TLS, 403 и 429. Какие выводы позволяет сделать каждый симптом.',
    related: ['vpn-and-proxy-selection', 'antiban-essentials'],
    sources: ['errors', 'status', 'network'],
  },
];
