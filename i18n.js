(() => {
  'use strict';
  const script = document.currentScript;
  if (!script || window.EC_I18N) return;
  const storageKey = 'ec2045-basic-language';
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const site = script.dataset.site || 'site';
  const nativeScript = document.querySelector('script[data-lang-path]');
  const hasNativeLanguage = !!nativeScript || site === 'RAC';
  const supported = (nativeScript?.dataset.languages || script.dataset.languages || 'ja,en').split(',');
  const detect = () => {
    for (const value of navigator.languages || [navigator.language]) {
      const code = String(value).toLowerCase().split('-')[0];
      if (supported.includes(code)) return code;
    }
    return 'ja';
  };
  let preference = read(storageKey) || 'auto';
  if (preference === 'en-x-es') preference = 'en';
  if (preference !== 'auto' && !supported.includes(preference)) preference = 'auto';
  let activeLanguage = 'ja', dictionary = Object.create(null), dictionaries = Object.create(null);
  let queued = false, ready = false;
  const originals = new WeakMap(), attributes = new WeakMap(), bound = new WeakSet();
  const normalise = text => text.replace(/\s+/g, ' ').trim();
  function parseLang(source) {
    const result = Object.create(null);
    const decode = value => value.replace(/\\([\\nrt=])/g, (_, c) => ({n:'\n',r:'\r',t:'\t'}[c] ?? c));
    for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      if (!line.trim() || /^\s*[#;]/.test(line)) continue;
      let separator = -1;
      for (let i=0;i<line.length;i++) { if (line[i] === '\\') { i++; continue; } if (line[i] === '=') { separator=i; break; } }
      if (separator < 0) throw new Error('Invalid .lang entry');
      const key = decode(line.slice(0,separator));
      if (Object.hasOwn(result,key)) throw new Error('Duplicate .lang key: '+key);
      result[key] = decode(line.slice(separator+1));
    }
    return result;
  }
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
          element.innerHTML = value;
          element.dataset.renderedLanguage = activeLanguage;
        }
      });
      const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, parent = node.parentElement;
        if (!parent || parent.closest('script,style,code,pre,textarea,svg,[contenteditable="true"],[data-i18n-ui],#font-ui-wrapper,#settings-menu,#rac-lang-sel,#lang-toggle,[data-lang-key],[data-i18n-html],[translate="no"]')) continue;
        const current = node.data;
        let record = originals.get(node);
        if (!record || current !== record.last) record = {original:current,last:current};
        const translated = translate(record.original);
        if (translated !== current && parent.tagName === 'OPTION' && !parent.hasAttribute('value')) parent.value = parent.value;
        if (translated !== current) node.data = translated;
        record.last = translated; originals.set(node,record);
      }
      document.querySelectorAll('[placeholder],[alt],[title],[aria-label],meta[name="description"],meta[property="og:title"],meta[property="og:description"]').forEach(element => {
        if (element.closest('[data-i18n-ui],[translate="no"]')) return;
        let records = attributes.get(element); if (!records) records = new Map();
        for (const name of ['placeholder','alt','title','aria-label','content']) {
          if (!element.hasAttribute(name)) continue;
          const current = element.getAttribute(name);
          let record = records.get(name);
          if (!record || current !== record.last) record = {original:current,last:current};
          const translated = translate(record.original);
          if (translated !== current) element.setAttribute(name,translated);
          record.last = translated; records.set(name,record);
        }
        attributes.set(element,records);
      });
    } finally {
      observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','alt','title','aria-label','content']});
    }
  }
  function updateControls() {
    document.querySelectorAll('[data-i18n-select]').forEach(select => { if (select.value !== preference) select.value = preference; });
    document.querySelectorAll('[data-i18n-language]').forEach(button => {
      const selected = button.dataset.i18nLanguage === preference;
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  function nativeApply(language) {
    if (site === 'RAC' && typeof window.setRacLanguage === 'function') window.setRacLanguage(language);
    else if (site === 'onva' && typeof window.setOnvaLanguage === 'function') window.setOnvaLanguage(language);
    else if (nativeScript && typeof window.setLang === 'function') window.setLang(language,false);
  }
  function apply(syncNative = false) {
    if (!ready) return;
    activeLanguage = preference === 'auto' ? detect() : preference;
    dictionary = dictionaries[activeLanguage] || Object.create(null);
    if (syncNative) nativeApply(activeLanguage);
    document.documentElement.lang = activeLanguage;
    translatePage();
    updateControls();
    window.dispatchEvent(new CustomEvent('site-language-change',{detail:{lang:activeLanguage,preference}}));
  }
  function choose(value) {
    if (value !== 'auto' && !supported.includes(value)) return;
    preference = value; write(storageKey,value); apply(true);
  }
  window.EC_I18N = {setLanguage:choose,getLanguage:()=>activeLanguage};
  function mountControls() {
    const nativeControl = document.querySelector('#lang-select,#rac-lang-sel');
    if (nativeControl) {
      if (nativeControl.getAttribute('aria-label') !== 'Language / 言語') nativeControl.setAttribute('aria-label','Language / 言語');
      // Native controls retain their own options, event handlers and persistence.
      return;
    }
    if (site === 'onva' || hasNativeLanguage) return;
    const buttons = document.querySelectorAll('[data-i18n-language]');
    if (buttons.length) {
      buttons.forEach(button => {
        if (bound.has(button)) return;
        bound.add(button);
        button.addEventListener('click',()=>choose(button.dataset.i18nLanguage));
      });
      updateControls(); return;
    }
    if (document.querySelector('[data-i18n-select]')) return;
    const panel = document.querySelector('#settings-menu,#font-ui-panel');
    const target = panel || document.querySelector(script.dataset.languageTarget || '[data-language-slot]');
    if (!target) return;
    const wrapper = document.createElement('label');
    wrapper.className = panel ? 'site-language setting-group' : 'site-language';
    wrapper.dataset.i18nUi = '';
    const caption = document.createElement('span');
    caption.textContent = 'Language';
    const select = document.createElement('select');
    select.dataset.i18nSelect = '';
    select.setAttribute('aria-label','Language / 言語');
    select.className = panel ? (target.id === 'settings-menu' ? 'custom-select' : 'setting-control') : '';
    for (const [value,label] of [['auto','Auto'],['ja','日本語'],['en','English']]) {
      const option = document.createElement('option'); option.value=value; option.textContent=label; select.append(option);
    }
    select.addEventListener('change',()=>choose(select.value));
    wrapper.append(caption,select);
    if (panel) {
      wrapper.classList.add('site-language--settings');
      const footer = target.querySelector('.mt-auto');
      if (footer) footer.before(wrapper); else target.append(wrapper);
    } else { target.dataset.languageHost = ''; target.append(wrapper); }
    updateControls();
  }
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;mountControls();translatePage();});
  });
  window.addEventListener('ec2045:languagechange',event=>{
    const language = event.detail.lang;
    if (!event.detail.userInitiated && preference !== 'auto' && preference !== language && supported.includes(preference)) {
      nativeApply(preference); return;
    }
    if (event.detail.userInitiated) { preference=language;write(storageKey,language); }
    else if (preference === 'auto') { activeLanguage=language;dictionary=dictionaries[language]||{};translatePage();updateControls();return; }
    apply(false);
  });
  window.addEventListener('languagechange',()=>{if(preference==='auto')apply(true);});
  async function initialise() {
    const style = document.createElement('style');
    style.textContent = '.site-language{display:inline-flex;align-items:center;gap:.65rem;flex-shrink:0;max-width:100%;font:inherit;font-size:.75rem;letter-spacing:.04em;color:inherit;margin:.5rem 0}.site-language>span{opacity:.6}.site-language select{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:.3em;padding:.45em .65em;min-height:2.4em;max-width:11rem;cursor:pointer}.site-language select option{color:CanvasText;background:Canvas}.site-language select:focus-visible{outline:2px solid currentColor;outline-offset:3px}.site-language--settings{display:flex;flex-direction:column;align-items:stretch;gap:.75rem;margin:1.5rem 0}.site-language--settings select{max-width:100%;width:100%}[data-language-slot]{display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;margin:.5rem 0}[data-language-slot="center"]{justify-content:center}@media(max-width:480px){.site-language>span{display:none}.site-language select{max-width:8rem;font-size:.75rem}}';
    document.head.append(style);
    mountControls();
    await Promise.all(['ja','en'].map(async language=>{
      try {
        const response = await fetch(new URL('lang/'+language+'.lang?v=20261102-ui2',script.src));
        if(!response.ok)throw new Error('Translations: '+response.status);
        dictionaries[language]=parseLang(await response.text());
      } catch(error){console.warn('[site-i18n]',error);}
    }));
    ready=true;mountControls();apply(true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialise,{once:true});else initialise();
})();

