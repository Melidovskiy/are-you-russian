import './theme.js';

const search = document.getElementById('guide-search');
const category = document.getElementById('guide-category');

if (search && category) {
  const cards = [...document.querySelectorAll('[data-guide]')];
  const groups = [...document.querySelectorAll('[data-guide-group]')];
  const count = document.getElementById('guide-count');
  const empty = document.getElementById('guide-empty');

  function filterGuides() {
    const words = search.value.toLocaleLowerCase('ru-RU').trim().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      const matchesCategory = !category.value || card.dataset.category === category.value;
      const matchesSearch = words.every(word => card.dataset.search.includes(word));
      card.hidden = !matchesCategory || !matchesSearch;
      if (!card.hidden) visible++;
    }
    for (const group of groups) {
      group.hidden = ![...group.querySelectorAll('[data-guide]')].some(card => !card.hidden);
    }
    count.textContent = `Показано ${visible} из ${cards.length}`;
    empty.hidden = visible > 0;
  }

  search.addEventListener('input', filterGuides);
  category.addEventListener('change', filterGuides);
  filterGuides();
}
