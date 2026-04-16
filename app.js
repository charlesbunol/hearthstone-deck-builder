// Configurações Globais
const API_URL = 'https://api.hearthstonejson.com/v1/latest/ptBR/cards.collectible.json';
const IMAGE_BASE_URL = 'https://art.hearthstonejson.com/v1/render/latest/ptBR/256x/';

const STANDARD_SETS = [
    'CORE',
    'FESTIVAL',
    'TITANS',
    'BADLANDS',
    'WHIZBANGS_WORKSHOP',
    'ISLAND_VACATION',
    'SPACE'
];

const CLASSES = {
    DEATHKNIGHT: 'Cavaleiro da Morte',
    DEMONHUNTER: 'Caçador de Demônios',
    DRUID: 'Druida',
    HUNTER: 'Caçador',
    MAGE: 'Mago',
    PALADIN: 'Paladino',
    PRIEST: 'Sacerdote',
    ROGUE: 'Ladino',
    SHAMAN: 'Xamã',
    WARLOCK: 'Bruxo',
    WARRIOR: 'Guerreiro'
};

// Estado da Aplicação
let state = {
    allCards: [],
    currentClass: null,
    filteredCards: [],
    format: 'STANDARD',
    deck: {}, // { "CARD_ID": quantity }
    deckCount: 0,
    manaFilter: null, // null = all, 0-7
    searchQuery: '',
    currentPage: 1,
    cardsPerPage: 20
};

// Referências UI
const DOM = {
    loadingScreen: document.getElementById('loading-screen'),
    classScreen: document.getElementById('class-selection-screen'),
    builderScreen: document.getElementById('deck-builder-screen'),
    classesGrid: document.getElementById('classes-grid'),
    classTitle: document.getElementById('current-class-title'),
    btnBack: document.getElementById('btn-back'),
    formatButtons: document.querySelectorAll('.format-btn'),
    manaButtons: document.querySelectorAll('.mana-btn'),
    searchInput: document.getElementById('search-input'),
    cardsGrid: document.getElementById('cards-grid'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    pageInfo: document.getElementById('page-info'),
    deckList: document.getElementById('deck-list'),
    deckCountText: document.getElementById('deck-count'),
    manaChart: document.getElementById('mana-curve-chart'),
    btnCopy: document.getElementById('btn-copy-deck')
};

// Inicialização
async function init() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // Remove duplicatas por nome (prioriza set CORE e cards normais sobre HERÓIS sem custo)
        const uniqueCardsMap = new Map();
        for (const card of data) {
            if (card.type === 'HERO' && card.cost === undefined) continue;
            
            if (uniqueCardsMap.has(card.name)) {
                if (card.set === 'CORE') {
                    uniqueCardsMap.set(card.name, card);
                }
            } else {
                uniqueCardsMap.set(card.name, card);
            }
        }
        state.allCards = Array.from(uniqueCardsMap.values()); 
        
        renderClasses();
        switchScreen(DOM.classScreen);
    } catch (error) {
        console.error("Erro ao carregar os cartoes:", error);
        alert("Erro ao carregar da API do Hearthstone. Verifique a conexão.");
    }
}

// Navegação de Telas
function switchScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screenElement.classList.add('active');
}

// Renderiza a Seleção de Classes
function renderClasses() {
    DOM.classesGrid.innerHTML = '';
    for (const [classId, className] of Object.entries(CLASSES)) {
        const div = document.createElement('div');
        div.className = 'class-card';
        div.innerHTML = `<h3>${className}</h3>`;
        div.addEventListener('click', () => selectClass(classId, className));
        DOM.classesGrid.appendChild(div);
    }
}

// Seleciona uma classe e entra no Builder
function selectClass(classId, className) {
    state.currentClass = classId;
    state.deck = {};
    state.deckCount = 0;
    state.manaFilter = null;
    state.searchQuery = '';
    state.currentPage = 1;
    
    document.querySelectorAll('.mana-btn').forEach(b => b.classList.remove('active'));
    DOM.searchInput.value = '';
    DOM.classTitle.innerText = `Deck de ${className}`;
    
    applyFilters();
    renderDeckTracker();
    switchScreen(DOM.builderScreen);
}

// Voltar para seleção
DOM.btnBack.addEventListener('click', () => {
    if(confirm('Tem certeza? Seu deck atual será perdido.')) {
        switchScreen(DOM.classScreen);
    }
});

// Filtros
DOM.formatButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const format = e.target.dataset.format;
        state.format = format;
        
        DOM.formatButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        state.currentPage = 1;
        applyFilters();
    });
});

DOM.manaButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const mana = parseInt(e.target.dataset.mana);
        if (state.manaFilter === mana) {
            state.manaFilter = null; // desmarca
            e.target.classList.remove('active');
        } else {
            state.manaFilter = mana;
            DOM.manaButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        }
        state.currentPage = 1;
        applyFilters();
    });
});

DOM.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    state.currentPage = 1;
    applyFilters();
});

function applyFilters() {
    state.filteredCards = state.allCards.filter(card => {
        // Filtro de Formato
        if (state.format === 'STANDARD' && !STANDARD_SETS.includes(card.set)) {
            return false;
        }

        // Filtro de Classe (Classe escolhida ou Neutro)
        const isClassMatch = card.cardClass === state.currentClass || 
                             card.classes?.includes(state.currentClass) || 
                             card.cardClass === 'NEUTRAL';
        if (!isClassMatch) return false;

        // Filtro Mana
        if (state.manaFilter !== null) {
            if (state.manaFilter === 7) {
                if (card.cost < 7) return false;
            } else {
                if (card.cost !== state.manaFilter) return false;
            }
        }

        // Filtro Texto
        if (state.searchQuery) {
            if (!card.name.toLowerCase().includes(state.searchQuery) && 
                !(card.text && card.text.toLowerCase().includes(state.searchQuery))) {
                return false;
            }
        }
        
        return true;
    });

    // Ordernar por custo
    state.filteredCards.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
    
    renderCards();
}

// Paginação e Renderização de Grade
DOM.btnPrev.addEventListener('click', () => {
    if (state.currentPage > 1) {
        state.currentPage--;
        renderCards();
    }
});
DOM.btnNext.addEventListener('click', () => {
    const maxPage = Math.ceil(state.filteredCards.length / state.cardsPerPage);
    if (state.currentPage < maxPage) {
        state.currentPage++;
        renderCards();
    }
});

function renderCards() {
    DOM.cardsGrid.innerHTML = '';
    const startIndex = (state.currentPage - 1) * state.cardsPerPage;
    const endIndex = startIndex + state.cardsPerPage;
    const cardsToRender = state.filteredCards.slice(startIndex, endIndex);

    const maxPage = Math.ceil(state.filteredCards.length / state.cardsPerPage);
    DOM.pageInfo.innerText = `Página ${state.currentPage} de ${maxPage || 1}`;
    DOM.btnPrev.disabled = state.currentPage === 1;
    DOM.btnNext.disabled = state.currentPage === maxPage || maxPage === 0;

    cardsToRender.forEach(card => {
        const div = document.createElement('div');
        div.className = 'hs-card';
        // Desabilita visualmente se não pode adicionar mais (limite copias ou limite cap deck)
        if (!canAddCard(card)) div.classList.add('disabled');

        const img = document.createElement('img');
        img.src = `${IMAGE_BASE_URL}${card.id}.png`;
        img.alt = card.name;
        img.loading = 'lazy'; // Otimiza carregamento das imagens
        // Fallback pra imagem se não existir art renderizada
        img.onerror = () => { img.src = 'https://via.placeholder.com/256x384.png?text=Sem+Arte'; };

        div.appendChild(img);
        div.addEventListener('click', () => addCardToDeck(card));
        DOM.cardsGrid.appendChild(div);
    });
}

// Lógica de Deck Building
function canAddCard(card) {
    if (state.deckCount >= 30) return false;
    const currentCount = state.deck[card.id]?.count || 0;
    const limit = card.rarity === 'LEGENDARY' ? 1 : 2;
    return currentCount < limit;
}

function addCardToDeck(card) {
    if (!canAddCard(card)) return;

    if (!state.deck[card.id]) {
        state.deck[card.id] = { obj: card, count: 0 };
    }
    state.deck[card.id].count++;
    state.deckCount++;
    
    renderDeckTracker();
    renderCards(); // Atualiza visual de cartões possivelmente esgotados
}

function removeCardFromDeck(cardId) {
    if (state.deck[cardId]) {
        state.deck[cardId].count--;
        state.deckCount--;
        if (state.deck[cardId].count <= 0) {
            delete state.deck[cardId];
        }
        renderDeckTracker();
        renderCards();
    }
}

function renderDeckTracker() {
    // Top Stats
    DOM.deckCountText.innerText = `${state.deckCount}/30`;
    if (state.deckCount === 30)DOM.deckCountText.classList.add('full');
    else DOM.deckCountText.classList.remove('full');

    // Deck List order
    const deckArr = Object.values(state.deck)
        .sort((a, b) => a.obj.cost - b.obj.cost || a.obj.name.localeCompare(b.obj.name));
    
    DOM.deckList.innerHTML = '';
    
    const manaCounts = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0}; // 7 é 7+

    deckArr.forEach(item => {
        const { obj, count } = item;
        
        // Populate mana for chart
        let costKey = obj.cost >= 7 ? 7 : obj.cost;
        if(costKey !== undefined) manaCounts[costKey] += count;

        const el = document.createElement('div');
        el.className = 'deck-item';
        
        const rarityClass = `rarity-${obj.rarity || 'COMMON'}`;
        
        el.innerHTML = `
            <div class="deck-item-mana">${obj.cost}</div>
            <div class="deck-item-name ${rarityClass}">${obj.name}</div>
            <div class="deck-item-count">${count}</div>
        `;
        
        // Click to remove
        el.addEventListener('click', () => removeCardFromDeck(obj.id));
        // Hover visual hint to remove could be added
        
        DOM.deckList.appendChild(el);
    });

    renderManaChart(manaCounts);
}

function renderManaChart(counts) {
    DOM.manaChart.innerHTML = '';
    const maxCount = Math.max(...Object.values(counts), 1); // evita divisão por zero
    
    for (let i = 0; i <= 7; i++) {
        let heightPercent = (counts[i] / maxCount) * 100;
        
        const col = document.createElement('div');
        col.className = 'mana-bar-col';
        
        const bar = document.createElement('div');
        bar.className = 'mana-bar';
        bar.style.height = `${heightPercent}%`;
        if (counts[i] > 0) bar.title = `${counts[i]} cartas custo ${i}${i===7?'+':''}`;
        
        const label = document.createElement('div');
        label.className = 'mana-label';
        label.innerText = i === 7 ? '7+' : i;

        col.appendChild(bar);
        col.appendChild(label);
        DOM.manaChart.appendChild(col);
    }
}

// Copiar código do deck - Funcionalidade Simulada
DOM.btnCopy.addEventListener('click', () => {
    if (state.deckCount < 30) {
        alert("O deck precisa ter 30 cartas para ser válido!");
        return;
    }
    
    // Gerar um mock code (A geração real de base64 usa formatacao especifica da Blizzard)
    const deckString = `### Deck de ${CLASSES[state.currentClass]}\n` + 
                       Object.values(state.deck).map(c => `${c.count}x (${c.obj.cost}) ${c.obj.name}`).join('\n');
                       
    navigator.clipboard.writeText(deckString).then(() => {
        alert("Lista de cartas copiada para a área de transferência!");
    });
});

// Start
init();