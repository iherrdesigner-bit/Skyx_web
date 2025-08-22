// Utility: toast
const toast = document.getElementById('toast');
function showToast(msg='Copied') {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(()=>{ toast.classList.remove('show'); toast.classList.add('hidden'); }, 1200);
}

// DOM
const fileInput = document.getElementById('fileInput');
const grid = document.getElementById('grid');
const dropzone = document.getElementById('dropzone');
const panel = document.getElementById('panel');
const closePanel = document.getElementById('closePanel');
const clearBtn = document.getElementById('clearBtn');

// Panel fields
const preview = document.getElementById('preview');
const mfilename = document.getElementById('m-filename');
const msize = document.getElementById('m-size');
const mres = document.getElementById('m-res');
const mcamera = document.getElementById('m-camera');
const mlens = document.getElementById('m-lens');
const mexpo = document.getElementById('m-expo');
const miso = document.getElementById('m-iso');
const mdate = document.getElementById('m-date');
const mgps = document.getElementById('m-gps');
const mbright = document.getElementById('m-bright');
const mtone = document.getElementById('m-tone');

const captionEl = document.getElementById('caption');
const hashtagsEl = document.getElementById('hashtags');
const regenCaptionBtn = document.getElementById('regenCaption');
const regenTagsBtn = document.getElementById('regenTags');
const copyCaptionBtn = document.getElementById('copyCaption');
const copyTagsBtn = document.getElementById('copyTags');
const saveTxtBtn = document.getElementById('saveTxt');

let items = []; // {file, url, width, height, exif, quick}

function bytesToSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes)/Math.log(k));
  return parseFloat((bytes/Math.pow(k,i)).toFixed(2)) + ' ' + sizes[i];
}

function createCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'card';
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.src = item.url;
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = item.file.name;
  card.appendChild(img);
  card.appendChild(label);
  card.addEventListener('click', () => openPanel(idx));
  return card;
}

async function handleFiles(fileList) {
  const arr = [...fileList].filter(f=>f.type.startsWith('image/'));
  for (const file of arr) {
    const url = URL.createObjectURL(file);
    // get intrinsic size
    const dim = await getImageSize(url);
    // read exif via exifr
    let exif = {};
    try { exif = await exifr.parse(file, { tiff: true, ifd1: true, exif: true, gps: true, xmp: true }); } catch(e) { exif = {}; }
    const item = { file, url, width: dim.width, height: dim.height, exif };
    items.push(item);
    const card = createCard(item, items.length-1);
    grid.appendChild(card);
  }
}

function getImageSize(url) {
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=> resolve({width: img.naturalWidth, height: img.naturalHeight});
    img.src = url;
  });
}

// Drag & drop
['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev, e=>{e.preventDefault(); dropzone.style.borderColor = '#3a4356';}));
['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev, e=>{e.preventDefault(); dropzone.style.borderColor = '#2f394a';}));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  handleFiles(files);
});
fileInput.addEventListener('change', e => handleFiles(e.target.files));
clearBtn.addEventListener('click', ()=>{ items=[]; grid.innerHTML=''; });

closePanel.addEventListener('click', ()=>{ panel.classList.add('hidden'); panel.setAttribute('aria-hidden', 'true'); });

// Panel open
async function openPanel(idx) {
  const it = items[idx];
  preview.src = it.url;
  mfilename.textContent = it.file.name;
  msize.textContent = bytesToSize(it.file.size);
  mres.textContent = `${it.width}×${it.height}`;

  // Parse EXIF fields
  const ex = it.exif || {};
  const make = ex.Make || ex.make || '';
  const model = ex.Model || ex.model || '';
  mcamera.textContent = [make, model].filter(Boolean).join(' ').trim() || '—';
  const lens = ex.LensModel || ex.lensModel || ex.LensSpecification || '';
  mlens.textContent = (Array.isArray(lens) ? lens.join(' ') : (lens || '—'));
  const iso = ex.ISO || ex.ISOSpeedRatings || ex['ExifIFDPointer']?.ISOSpeedRatings || null;
  miso.textContent = iso ? String(iso) : '—';

  // Exposure: Shutter + FNumber
  const fnum = ex.FNumber || ex.fNumber || ex.ApertureValue || null;
  const fStr = fnum ? `f/${typeof fnum === 'number' ? fnum.toFixed(1) : fnum}` : '';
  let shutter = ex.ExposureTime || ex.exposureTime || null;
  let shutterStr = '';
  if (shutter) {
    if (typeof shutter === 'number') {
      if (shutter >= 1) shutterStr = `${shutter.toFixed(0)}s`; else shutterStr = `1/${Math.round(1/shutter)}s`;
    } else {
      shutterStr = String(shutter).includes('/') ? `${shutter}s` : `${shutter}s`;
    }
  }
  mexpo.textContent = (shutterStr || '') + (fStr ? (shutterStr?' · ':'') + fStr : '') || '—';

  // Date
  const dt = ex.DateTimeOriginal || ex.CreateDate || ex.ModifyDate || '';
  mdate.textContent = dt ? String(dt).replace(/:/, '-').replace(/:/, '-') : '—';

  // GPS
  function gpsToStr(ex){
    if (!ex || ex.latitude==null || ex.longitude==null) return null;
    const lat = ex.latitude, lon = ex.longitude;
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
  let gpsStr = null;
  try {
    const g = await exifr.gps(it.file);
    gpsStr = gpsToStr(g);
  } catch(e){}
  mgps.textContent = gpsStr || '—';

  // Quick luminance + tone from pixels
  const {avg, tone} = await analyzeTone(it.url);
  mbright.textContent = `${Math.round(avg)}/255`;
  mtone.textContent = tone;

  // Generate caption + hashtags
  captionEl.value = generateCaption({make, model, tone, dt}, it);
  hashtagsEl.value = generateHashtags({make, model, tone}, it);
  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden', 'false');
}

function analyzeTone(url) {
  return new Promise((resolve)=>{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      const w = 64, h = 64;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0,0,w,h).data;
      let sum=0, cool=0, warm=0;
      for (let i=0;i<data.length;i+=4){
        const r=data[i], g=data[i+1], b=data[i+2];
        const y=0.2126*r+0.7152*g+0.0722*b;
        sum+=y;
        if (b>r+10) cool++; if (r>g+10 && r>b+10) warm++;
      }
      const avg = sum/(w*h);
      let tone = 'balanced';
      if (avg<70) tone = 'low-light/moody';
      else if (avg>180) tone = 'bright/airy';
      if (cool>warm && avg<140) tone += ' · cool';
      else if (warm>cool && avg<140) tone += ' · warm';
      resolve({avg, tone});
    };
    img.src = url;
  });
}

// Caption generator (rule-based, promo style)

function generateCaption(ctx, item){
  // Optimized Instagram-style caption (Hook + Story + CTA)
  const enText = (ctx && ctx.userEN) ? ctx.userEN.trim() : "";
  const tone = ctx && ctx.tone ? ctx.tone : "";
  const hooks = [
    "Frozen in time — a glimpse of soul.",
    "When light whispers, stories emerge.",
    "Moments that breathe between shadows.",
    "Cinematic stillness, alive in a frame."
  ];
  const hook = hooks[Math.floor(Math.random()*hooks.length)];
  let story = "";
  if (enText.length>0) {
    story = capitalizeFirst(enText);
  } else {
    if (tone.includes("low-light")) story = "Dark hues wrap the silence with depth.";
    else if (tone.includes("bright")) story = "Bright tones carve clarity into air.";
    else story = "A fleeting scene etched in subtle colors.";
  }
  const ctas = [
    "What story does it tell you?",
    "How does this frame make you feel?",
    "Leave your thoughts below.",
    "Would you pause here too?"
  ];
  const cta = ctas[Math.floor(Math.random()*ctas.length)];
  return `${hook}
${story}
${cta}`;
}
function capitalizeFirst(s){ if(!s) return s; return s.charAt(0).toUpperCase()+s.slice(1); }

// Hashtag generator: 14 HF + 14 LF, EN only, single line

function generateHashtags(ctx, item, mode="engagement"){
  const baseHF = [
    "photography","photooftheday","instaphoto","visualstory","artofvisuals",
    "cinematicphotography","cinematic","creativephoto","lightandshadow","composition",
    "colorgrading","bokeh","moodytones","storytelling"
  ];
  const fillers = [
    "urbanphotography","streetphotography","editorialvibes","dramaticlight","fineartphoto",
    "onlocation","rawcapture","creatorslane","visualpoetry","quietmoments","citylights",
    "silentstreets","shadowplay","framing","travelmood","moodyframe"
  ];
  const tone = (ctx && ctx.tone)||"";
  let lf=[];
  if(tone.includes("low-light")) lf.push("lowlight","nightshots");
  if(tone.includes("bright")) lf.push("brighttones","cleanlook");
  if(ctx && ctx.userEN){
    const kws=(ctx.userEN.toLowerCase().match(/[a-z]{4,}/g)||[]).slice(0,4);
    lf=lf.concat(kws);
  }
  let tags = Array.from(new Set(baseHF.concat(lf, fillers)));
  tags = tags.map(t=>t.startsWith("#")?t:("#"+t));
  if(mode==="reach"){
    return tags.slice(0,28).join(" ");
  } else {
    return tags.slice(0,10).join(" ");
  }
}
  if (tone.includes('bright')) { hfBase.push('cleanlook'); }
  // Cap to uniques
  const hf = Array.from(new Set(hfBase)).slice(0,14).map(t=>`#${t}`);

  // LF: resolution/focal hints from EXIF
  const ex = item.exif || {};
  const fl = (ex.FocalLength && typeof ex.FocalLength === 'number') ? ex.FocalLength : null;
  const lf = [];
  if (fl!=null) {
    if (fl<=24) lf.push('wideangle'); else if (fl>=80) lf.push('telephoto'); else lf.push('standardlens');
  }
  const fnum = ex.FNumber || ex.fNumber;
  if (typeof fnum === 'number') {
    if (fnum<=2.0) lf.push('shallowdepth'); else if (fnum>=8) lf.push('deepfocus');
  }
  // Day part
  if (generateCaption(ctx,item).includes('golden hour')) lf.push('goldenhour');
  if (tone.includes('cool')) lf.push('cooltones');
  if (tone.includes('warm')) lf.push('warmtones');

  // Fillers to reach 14
  const fillers = ['urbanphotography','streetphotography','editorialvibes','dramaticlight','fineartphoto','onlocation','rawcapture','shootandshare','creatorslane','visualpoetry','quietmoments','citylights','silentstreets','shadowplay','framing','archilovers','travelmood'];
  // unique + trimmed
  let lfFinal = Array.from(new Set(lf));
  for (const f of fillers) if (lfFinal.length<14) lfFinal.push(f);
  lfFinal = lfFinal.slice(0,14).map(t=>t.startsWith('#')?t:('#'+t));

  const all = [...hf, ...lfFinal].slice(0,28);
  // Ensure exactly 28
  while (all.length<28) all.push('#visualstory'); // pad if needed
  return all.join(' ');
}

// Buttons
copyCaptionBtn.addEventListener('click', ()=>{ navigator.clipboard.writeText(captionEl.value); showToast('Caption copied'); });
copyTagsBtn.addEventListener('click', ()=>{ navigator.clipboard.writeText(hashtagsEl.value); showToast('Hashtags copied'); });
regenCaptionBtn.addEventListener('click', ()=>{
  // re-run with slight variation by toggling a descriptor
  captionEl.value = generateCaption({}, items.find(x=>x.url===preview.src));
});
regenTagsBtn.addEventListener('click', ()=>{
  hashtagsEl.value = generateHashtags({}, items.find(x=>x.url===preview.src));
});
saveTxtBtn.addEventListener('click', ()=>{
  const name = (mfilename.textContent||'photo').replace(/\.[^.]+$/,'') + '.txt';
  const blob = new Blob([captionEl.value + '\n\n' + hashtagsEl.value], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// Translation (RU->EN) via LibreTranslate-compatible endpoint
const translateBtn = document.getElementById('translateBtn');
const ltEndpointEl = document.getElementById('ltEndpoint');
const promptRU = document.getElementById('promptRU');
const promptEN = document.getElementById('promptEN');

async function translateRuToEn(text, endpoint){
  // Default public endpoint (can be replaced in UI). Keep free usage minimal.
  const url = (endpoint && endpoint.trim()) || 'https://libretranslate.com/translate';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'ru', target: 'en', format: 'text' })
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const out = data.translatedText || (typeof data === 'string' ? data : '');
    return out;
  } catch (e) {
    console.warn('Translation failed:', e);
    return ''; // fallback handled by caller
  }
}

translateBtn?.addEventListener('click', async ()=>{
  const ru = (promptRU?.value || '').trim();
  if (!ru) { showToast('Введите текст'); return; }
  const en = await translateRuToEn(ru, ltEndpointEl?.value || '');
  promptEN.textContent = en || '—';
  // Merge into caption (prefer EN prompt if present)
  const it = items.find(x=>x.url===preview.src);
  captionEl.value = generateCaption({ userEN: en }, it);
  hashtagsEl.value = generateHashtags({ userEN: en }, it);
  showToast('Translated & generated');
});

// Modify caption/tags generators to use userEN when provided
const _origGenerateCaption = generateCaption;
generateCaption = function(ctx, item){
  if (ctx && ctx.userEN) {
    const core = ctx.userEN.trim();
    if (core) {
      // Wrap into promo-style English caption
      const intro = "Cinematic hush: ";
      const outro = " — a frame that asks the feed to linger."
      return intro + core + "." + outro;
    }
  }
  return _origGenerateCaption(ctx, item);
}

const _origGenerateHashtags = generateHashtags;
generateHashtags = function(ctx, item){
  let base = _origGenerateHashtags(ctx, item);
  if (ctx && ctx.userEN) {
    // pull a few keywords from EN text for LF replacement
    const kws = (ctx.userEN.toLowerCase().match(/[a-z]{4,}/g) || []).slice(0,6);
    if (kws.length){
      const tags = base.split(/\s+/);
      // replace last 6 LF tags with keyword-derived tags
      for (let i=0; i<kws.length; i++){
        const t = '#'+kws[i].replace(/[^a-z0-9]/g,'');
        tags[tags.length - 1 - i] = t;
      }
      base = tags.join(' ');
    }
  }
  return base;
}

// Second translator under the photo
const translateBtn2 = document.getElementById('translateBtn2');
const ltEndpointEl2 = document.getElementById('ltEndpoint2');
const promptRU2 = document.getElementById('promptRU2');
const promptEN2 = document.getElementById('promptEN2');

translateBtn2?.addEventListener('click', async ()=>{
  const ru = (promptRU2?.value || '').trim();
  if (!ru) { showToast('Введите текст'); return; }
  const en = await translateRuToEn(ru, ltEndpointEl2?.value || '');
  promptEN2.textContent = en || '—';
  const it = items.find(x=>x.url===preview.src);
  captionEl.value = generateCaption({ userEN: en }, it);
  hashtagsEl.value = generateHashtags({ userEN: en }, it);
  showToast('Translated & generated');
});


// ===== Instagram-optimized caption rules =====
// Build caption as: HOOK (<=125 chars) + line break + 1 short cinematic line + line break + CTA.
// No emojis by default; can be added later as a toggle if needed.
function buildHook(ctx, tone){
  // Prefer user EN text start
  const seed = (ctx && ctx.userEN ? ctx.userEN.trim() : "") || "A moment where light slows the world down";
  // Trim to a punchy single sentence under ~14 words
  let hook = seed.split(/[.!?]/)[0].trim();
  if (hook.length < 24) hook = "Cinematic pause in the " + (tone.includes("low-light")?"dark":"light");
  // Limit to 125 chars
  if (hook.length > 125) hook = hook.slice(0, 122).trim().replace(/\W+$/,'') + "…";
  return hook;
}
function buildBody(tone){
  if (tone.includes("low-light")) return "Quiet shadows, measured breathing, a frame that holds its breath.";
  if (tone.includes("bright")) return "Clean air, crisp lines, light carving space with intent.";
  return "Stillness between movements, shaped by light and timing.";
}
function buildCTA(){
  return "What stays with you in this frame?";
}
function makeOptimizedCaption(ctx, item){
  const it = item || items.find(x=>x.url===preview.src);
  const tone = (ctx && ctx.tone) || (mtone.textContent || "balanced");
  const hook = buildHook(ctx, tone);
  const body = buildBody(tone);
  const cta = buildCTA();
  const out = hook + "\n" + body + "\n" + cta;
  // Update counter
  const hc = document.getElementById('hookCount');
  if (hc) hc.textContent = `hook ${hook.length}/125`;
  return out;
}

// Override caption generation to use optimized format
const __oldGenCap = generateCaption;
generateCaption = function(ctx, item){
  return makeOptimizedCaption(ctx, item);
}

// Hashtag mode toggle
const tagModeEl = document.getElementById('tagMode');

function generateHashtagsEngagement(ctx, item){
  // 8–10 tight tags: mix of HF (3–4) + LF (5–6) based on tone and keywords
  const baseHF = ["photography","cinematicphotography","visualstory","moodytones","lightandshadow"];
  const hf = Array.from(new Set(baseHF)).slice(0,4).map(t=>"#"+t);
  // Reuse LF builder from original, then cut
  const tmp = _origGenerateHashtags ? _origGenerateHashtags(ctx, item) : generateHashtags(ctx,item);
  let tags = tmp.split(/\s+/).filter(Boolean);
  // Remove duplicates and overly generic ones
  const bad = new Set(["#photooftheday","#instaphoto","#composition","#cinematic"]);
  tags = tags.filter(t=>!bad.has(t));
  // Keep tone-focused and scene keywords
  let lf = tags.filter(t=>!hf.includes(t));
  // Construct final 8–10
  const all = Array.from(new Set([...hf, ...lf])).slice(0,10);
  // ensure at least 8
  while (all.length < 8) all.push("#visualstory");
  return all.join(" ");
}

// Hook into existing flow: when mode changes, regenerate
tagModeEl?.addEventListener('change', ()=>{
  const it = items.find(x=>x.url===preview.src);
  if (!it) return;
  if (tagModeEl.value === 'engagement') {
    hashtagsEl.value = generateHashtagsEngagement({}, it);
  } else {
    hashtagsEl.value = _origGenerateHashtags ? _origGenerateHashtags({}, it) : generateHashtags({}, it);
  }
});

// Also update when regenerating
const __oldRegenTags = regenTagsBtn.onclick;
regenTagsBtn.addEventListener('click', ()=>{
  const it = items.find(x=>x.url===preview.src);
  if (!it) return;
  if (tagModeEl && tagModeEl.value === 'engagement') {
    hashtagsEl.value = generateHashtagsEngagement({}, it);
  } else {
    hashtagsEl.value = _origGenerateHashtags ? _origGenerateHashtags({}, it) : generateHashtags({}, it);
  }
});

// Update counter live when editing EN prompt
const promptEN = document.getElementById('promptEN');
const promptEN2 = document.getElementById('promptEN2');
const observer = new MutationObserver(()=>{
  const it = items.find(x=>x.url===preview.src);
  if (!it) return;
  captionEl.value = makeOptimizedCaption({ userEN: (promptEN2?.textContent || promptEN?.textContent || "") }, it);
});
if (promptEN) observer.observe(promptEN, { childList:true, subtree:true });
if (promptEN2) observer.observe(promptEN2, { childList:true, subtree:true });

