let aiData = [];
let filteredData = [];
let favorites = JSON.parse(localStorage.getItem('u-ai-favorites')) || [];
let showOnlyFavs = false;

function switchView(viewName) {
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
    const target = document.getElementById('view-' + viewName);
    if (target) {
        target.style.display = 'flex';
        setTimeout(() => target.classList.add('active'), 10);
        window.scrollTo(0, 0);
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('u-ai-theme', isLight ? 'light' : 'dark');
    updateThemeIcons(isLight);
}

function updateThemeIcons(isLight) {
    document.getElementById('theme-icon-sun').classList.toggle('hidden', !isLight);
    document.getElementById('theme-icon-moon').classList.toggle('hidden', isLight);
}

function toggleFavorite(e, no) {
    e.stopPropagation();
    if (favorites.includes(no)) { favorites = favorites.filter(f => f !== no); }
    else { favorites.push(no); }
    localStorage.setItem('u-ai-favorites', JSON.stringify(favorites));
    renderGrid();
}

function toggleFavFilter() {
    showOnlyFavs = !showOnlyFavs;
    document.getElementById('fav-dot').className = showOnlyFavs ? 'w-2 h-2 rounded-full bg-red-500' : 'w-2 h-2 rounded-full bg-slate-500';
    handleFilter();
}

function renderIcon(ai, customClass = "") {
    if (ai.isImage) {
        return `<img src="${ai.icon}" alt="${ai.name}" class="ai-icon-img ${customClass}" onerror="this.onerror=null; this.parentElement.innerHTML='⚠️';">`;
    }
    return `<span class="${customClass}">${ai.icon}</span>`;
}

function typeWriter(element, text, speedParam) {
    element.innerHTML = "";
    element.classList.add('typing-cursor');
    let i = 0;
    const calculatedSpeed = Math.max(10, 150 - (speedParam * 1.3));

    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, calculatedSpeed);
        } else {
            element.classList.remove('typing-cursor');
        }
    }
    type();
}

async function loadAIData() {
    try {
        const response = await fetch('./ai_data.json');
        if (!response.ok) throw new Error();
        aiData = await response.json();
    } catch (error) {
        aiData = [{
            "no": "U-1.0",
            "name": "Unfidmatk-AI 1.0",
            "type": "未解読記号生成知能",
            "description": "「どこかの国の文字のようでありながら、世界のどこにも存在しない記号」を生成することに特化したAI。",
            "status": { "logic": 40, "creative": 95, "utility": 50, "speed": 15 },
            "color": "#f87171",
            "icon": "🖋️",
            "isImage": false
        }];
    }
    filteredData = [...aiData];
    renderGrid();
}

async function runLoading() {
    const screen = document.getElementById('loading-screen');
    const bar = document.getElementById('loader-progress');
    const log = document.getElementById('loader-log');
    const seq = ["ACCESSING...", "DECRYPTING...", "PARSING JSON...", "FETCHING ASSETS...", "COMPLETED."];
    await loadAIData();
    for (let i = 0; i < seq.length; i++) {
        log.textContent = seq[i];
        bar.style.width = ((i + 1) * 20) + '%';
        await new Promise(r => setTimeout(r, 150));
    }
    screen.style.opacity = '0';
    setTimeout(() => screen.style.display = 'none', 800);
}

function renderGrid() {
    const grid = document.getElementById('ai-grid');
    if (!grid) return;
    if (filteredData.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-20 text-center opacity-40">該当データなし</div>';
        return;
    }
    grid.innerHTML = filteredData.map(ai => {
        const isFav = favorites.includes(ai.no);
        return `
                <div class="ai-card rounded-[2.5rem] p-8 cursor-pointer group" onclick="showDetails('${ai.no}')">
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${ai.no}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                    </button>
                    <div class="flex justify-between items-start mb-6 opacity-40 text-[9px] pixel-font">
                        <span>ID: ${ai.no}</span>
                        <span>BY: ${ai.author || 'Unknown'}</span>
                    </div>
                    <div class="icon-container mb-8 transform group-hover:scale-110 transition-transform duration-500 text-7xl">
                        ${renderIcon(ai)}
                    </div>
                    <h3 class="text-2xl font-bold text-center mb-1">${ai.name}</h3>
                    <p class="text-[11px] text-sky-500 font-bold text-center uppercase tracking-[0.2em] mb-4">${ai.type}</p>
                    <div class="flex justify-center gap-4 opacity-40 text-[8px] font-bold uppercase tracking-wider">
                        <span>L: ${ai.status?.logic || 0}</span>
                        <span>C: ${ai.status?.creative || 0}</span>
                        <span>S: ${ai.status?.speed || 0}</span>
                    </div>
                </div>`;
    }).join('');
}

function handleFilter() {
    const q = document.getElementById('search-query').value.toLowerCase();
    const sort = document.getElementById('sort-order').value;
    filteredData = aiData.filter(a => {
        const mQ = (a.name || "").toLowerCase().includes(q) || (a.type || "").toLowerCase().includes(q) || (a.author || "").toLowerCase().includes(q);
        const mF = showOnlyFavs ? favorites.includes(a.no) : true;
        return mQ && mF;
    });
    filteredData.sort((a, b) => {
        if (sort === 'no') return a.no.localeCompare(b.no);
        const sA = a.status?.[sort] || 0;
        const sB = b.status?.[sort] || 0;
        return sB - sA;
    });
    renderGrid();
}

function showDetails(no) {
    const ai = aiData.find(a => a.no === no);
    const content = document.getElementById('modal-content');

    content.innerHTML = `
                <div class="flex flex-col gap-10">
                    <div class="flex flex-col md:flex-row gap-10 items-start">
                        <div class="p-10 bg-black/40 rounded-[3.5rem] border border-white/5 flex items-center justify-center w-full md:w-[320px] h-[320px] text-[10rem] overflow-hidden" style="color: ${ai.color}">
                            ${renderIcon(ai)}
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-center mb-2">
                                <h2 class="text-4xl md:text-5xl font-bold text-white tracking-tight">${ai.name}</h2>
                                <span class="pixel-font text-xs opacity-40 px-3 py-1 bg-white/5 rounded-full">${ai.rarity || 'Normal'}</span>
                            </div>
                            <div class="flex flex-wrap items-center gap-3 mb-6">
                                <span class="text-sky-400 font-bold uppercase text-xs tracking-widest">${ai.type}</span>
                                <span class="w-1 h-1 bg-white/20 rounded-full"></span>
                                <span class="text-white/40 text-xs font-bold uppercase tracking-widest">Authored by ${ai.author || 'Unknown'}</span>
                            </div>
                            <p id="typing-desc" class="opacity-70 text-base leading-relaxed bg-white/5 p-6 rounded-2xl border border-white/5 mb-6 min-h-[100px]"></p>
                            <div class="bg-sky-500/10 border border-sky-500/20 p-5 rounded-2xl">
                                <h4 class="text-[10px] text-sky-400 font-bold uppercase tracking-widest mb-2">Usage & Origin</h4>
                                <p class="text-sm opacity-80 leading-relaxed">${ai.usage || '詳細なし'}</p>
                                <p class="text-[10px] mt-2 opacity-50">Origin: ${ai.origin || 'Unknown'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 pt-8 border-t border-white/10">
                        ${renderStat('Logic', ai.status?.logic || 0, ai.color)}
                        ${renderStat('Speed', ai.status?.speed || 0, ai.color, ai.speedCompare)}
                        ${renderStat('Creative', ai.status?.creative || 0, ai.color)}
                        ${renderStat('Utility', ai.status?.utility || 0, ai.color)}
                    </div>
                </div>`;

    document.getElementById('details-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        const desc = document.getElementById('typing-desc');
        typeWriter(desc, ai.description, ai.status?.speed || 50);
        content.querySelectorAll('.status-fill').forEach(f => f.style.width = f.dataset.target + '%');
    }, 100);
}

function renderStat(l, v, c, d) {
    return `<div class="space-y-3">
                <div class="text-[10px] opacity-40 font-bold uppercase tracking-widest">${l}</div>
                <div class="status-bar"><div class="status-fill" data-target="${Math.min(v, 100)}" style="background: ${c}"></div></div>
                <div class="text-right text-[11px] opacity-80 font-bold">${d || v + '%'}</div>
            </div>`;
}

function closeModal() {
    document.getElementById('details-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

window.onload = () => {
    const savedTheme = localStorage.getItem('u-ai-theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        updateThemeIcons(true);
    }
    document.getElementById('search-query').addEventListener('input', handleFilter);
    document.getElementById('sort-order').addEventListener('change', handleFilter);
    document.getElementById('toggle-favorites').addEventListener('click', toggleFavFilter);
    runLoading();
};

window.onclick = e => { if (e.target.id === 'details-modal') closeModal(); };
