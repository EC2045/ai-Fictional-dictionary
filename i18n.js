(() => {
  'use strict';
  const script = document.currentScript;
  if (!script || document.getElementById('ec-language-guide')) return;
  const key = 'ec2045-basic-language';
  const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const detect = () => (navigator.languages || [navigator.language]).find(x => /^(ja|en)(-|$)/i.test(x))?.slice(0, 2).toLowerCase() || 'ja';
  const native = !!document.querySelector('script[data-lang-path]');
  const site = script.dataset.site || decodeURIComponent(location.pathname.split('/').filter(Boolean)[0] || 'ec2045.github.io');
  const normalise = text => text.replace(/\s+/g, ' ').trim();
  const supported = (script.dataset.languages || 'ja,en').split(',');
  let dictionaries = {}, dictionary = {}, activeLanguage = 'ja', queued = false;
  const originals = new WeakMap(), attributes = new WeakMap();
  const box = document.createElement('aside');
  box.id = 'ec-language-guide';
  box.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;max-width:min(390px,calc(100vw - 32px));padding:12px 16px;border:1px solid #888;border-radius:12px;background:#fff;color:#18202a;box-shadow:0 4px 24px #0003;font:14px/1.6 system-ui,sans-serif;text-align:left;box-sizing:border-box';
  const label = document.createElement('label');
  label.textContent = '日本語 / English '; label.htmlFor = 'ec-language-choice';
  const select = document.createElement('select'); select.id = 'ec-language-choice';
  select.style.cssText = 'background:#fff;color:#18202a;border:1px solid #888;border-radius:5px;padding:4px;font:inherit';
  for (const [value, text] of [['auto', '自動 / Auto'], ...supported.map(code => [code, ({ja:'日本語',en:'English','en-x-es':'English · Spanish-style spelling'})[code] || code])]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
  }
  const details = document.createElement('details'), summary = document.createElement('summary'), intro = document.createElement('p'), link = document.createElement('a');
  intro.style.margin = '8px 0'; link.href = 'https://ec2045.github.io/'; link.style.color = '#2454aa';
  details.append(summary, intro, link); box.append(label, select, details); document.body.append(box);
  function translate(original) {
    if (!activeLanguage.startsWith('en')) return original;
    const text = normalise(original);
    let translated = dictionary[text];
    // These are rendered afresh by the live calendar, rather than stored in HTML.
    if (translated === undefined && site === 'WST-TIME') {
      translated = text.replace(/東暦(\d+)年\s*(\d+)月(?:\s*(\d+)日)?/g, (_, y, m, d) => `East Calendar ${y}, Month ${m}${d ? `, Day ${d}` : ''}`);
      translated = translated.replace(/\(([天知人和駿律水])\)/g, (_, day) => '(' + ({'天':'Ten','知':'Chi','人':'Jin','和':'Wa','駿':'Shun','律':'Ritsu','水':'Sui'})[day] + ')').replace(/([+−-]?\d+)\s*時間/g, '$1 hours');
      if (translated === text) translated = undefined;
    }
    if (translated === undefined && site === 'waon-weather-forecast') {
      const weather = value => value.replace(/晴れ?|曇り?|雨|雪|雷|のち|時々|一時/g, word => ({'晴れ':'sunny','晴':'sunny','曇り':'cloudy','曇':'cloudy','雨':'rain','雪':'snow','雷':'thunder','のち':', then ','時々':', occasionally ','一時':', briefly '})[word]);
      translated = text.replace(/^同期完了:\s*/, 'Updated: ').replace(/^オフライン予測:\s*/, 'Offline forecast: ').replace(/本日の和温陣国は「(.+?)」の見込みです。風速・湿度ともに比較的穏やかな大気状態が予測されています。/, (_, conditions) => `Today in Waon Jinkoku: ${weather(conditions)}. Relatively calm wind and humidity conditions are expected.`).replace(/(\d+)月(\d+)日/g, '$1/$2').replace(/\((今日|明日|明後日)\)/g, (_, day) => '(' + dictionary[day] + ')');
      if (/^[晴れ曇り雨雪雷のち時々一]+$/.test(text)) translated = weather(text);
      if (translated === text) translated = undefined;
    }
    if (translated === undefined) return original;
    return original.slice(0, original.indexOf(original.trimStart())) + translated + original.slice(original.trimEnd().length);
  }
  function translatePage() {
    observer.disconnect();
    try {
      document.querySelectorAll('[data-i18n-html]').forEach(element => {
        const value = dictionaries[activeLanguage]?.[element.dataset.i18nHtml];
        if (value !== undefined && element.dataset.renderedLanguage !== activeLanguage) {
          element.innerHTML = value; element.dataset.renderedLanguage = activeLanguage;
        }
      });
      const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, parent = node.parentElement;
        if (!parent || parent.closest('script,style,code,pre,textarea,svg,[contenteditable="true"],#ec-language-guide,[data-lang-key],[data-i18n-html],[translate="no"]')) continue;
        const current = node.data;
        let record = originals.get(node);
        if (!record || current !== record.last) record = { original: current, last: current };
        const translated = translate(record.original);
        // Preserve implicit option values used by filters before changing their labels.
        if (translated !== current && parent.tagName === 'OPTION' && !parent.hasAttribute('value')) parent.value = parent.value;
        if (translated !== current) node.data = translated;
        record.last = translated; originals.set(node, record);
      }
      document.querySelectorAll('[placeholder],[alt],[title],[aria-label],meta[name="description"],meta[property="og:title"],meta[property="og:description"]').forEach(element => {
        if (element.closest('#ec-language-guide,[translate="no"]')) return;
        let records = attributes.get(element); if (!records) records = new Map();
        for (const name of ['placeholder', 'alt', 'title', 'aria-label', 'content']) {
          if (!element.hasAttribute(name)) continue;
          const current = element.getAttribute(name);
          let record = records.get(name);
          if (!record || current !== record.last) record = { original: current, last: current };
          const translated = translate(record.original);
          if (translated !== current) element.setAttribute(name, translated);
          record.last = translated; records.set(name, record);
        }
        attributes.set(element, records);
      });
    } finally { observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'alt', 'title', 'aria-label', 'content'] }); }
  }
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true; requestAnimationFrame(() => { queued = false; translatePage(); });
  });
  function apply(syncNative = false) {
    const nativePreference = read('user-lang-setting');
    activeLanguage = select.value === 'auto' ? (native && nativePreference ? nativePreference : detect()) : select.value;
    if (!supported.includes(activeLanguage) && !native) activeLanguage = detect();
    dictionary = dictionaries[activeLanguage] || dictionaries.en || {};
    box.lang = activeLanguage;
    const english = activeLanguage.startsWith('en');
    summary.textContent = english ? 'About this site' : 'このサイトについて';
    intro.textContent = dictionary['@intro'] || (english ? script.dataset.en || '' : script.dataset.ja || '');
    link.textContent = english ? 'Explore the World Portal →' : '世界ポータルへ →';
    intro.hidden = !intro.textContent;
    if (!intro.textContent) intro.hidden = true;
    let note = box.querySelector('[data-spelling-note]');
    if (!note) { note = document.createElement('p'); note.dataset.spellingNote = ''; note.style.margin = '8px 0'; details.append(note); }
    note.textContent = dictionary['@spelling.note'] || ''; note.hidden = !note.textContent;
    if (syncNative && native && typeof window.setLang === 'function') window.setLang(activeLanguage);
    if (!native) document.documentElement.lang = activeLanguage;
    translatePage();
    window.dispatchEvent(new CustomEvent('site-language-change', {detail:{lang:activeLanguage}}));
  }
  select.value = ['auto', ...supported].includes(read(key)) ? read(key) : 'auto';
  select.addEventListener('change', () => {
    write(key, select.value);
    // Auto must resume browser detection instead of keeping a stale native choice.
    if (select.value === 'auto' && native) write('user-lang-setting', detect());
    apply(true);
  });
  window.addEventListener('languagechange', () => { if (select.value === 'auto') { if (native) write('user-lang-setting', detect()); apply(true); } });
  window.addEventListener('ec2045:languagechange', event => {
    const lang = event.detail.lang;
    const saved = read(key);
    // A late native startup must not overwrite an explicit cross-site choice.
    if (!event.detail.userInitiated && supported.includes(saved) && saved !== lang) {
      window.setLang(saved);
      return;
    }
    if (event.detail.userInitiated) write(key, supported.includes(lang) ? lang : 'auto');
    select.value = supported.includes(lang) ? lang : 'auto';
    apply(false);
  });
  const initialise = () => apply(select.value !== 'auto');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true }); else initialise();
  function parseLang(source) {
    const result = Object.create(null);
    const decode = value => value.replace(/\\([\\nrt=])/g, (_, c) => ({n:'\n',r:'\r',t:'\t'}[c] ?? c));
    for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      if (!line.trim() || /^\s*[#;]/.test(line)) continue;
      let separator = -1;
      for (let i=0;i<line.length;i++) { if (line[i] === '\\') { i++; continue; } if (line[i] === '=') {separator=i;break;} }
      if (separator < 0) throw new Error('Invalid .lang entry');
      const key=decode(line.slice(0,separator));
      if (Object.hasOwn(result,key)) throw new Error('Duplicate .lang key: '+key);
      result[key]=decode(line.slice(separator+1));
    }
    return result;
  }
  Promise.all(supported.map(async language => {
    try {
      const response=await fetch(new URL('lang/'+language+'.lang?v=20261102-1',script.src));
      if(!response.ok) throw new Error('Translations: '+response.status);
      dictionaries[language]=parseLang(await response.text());
    } catch(error) { console.warn('[ec2045-i18n]',error); }
  })).then(() => apply(false));
})();
