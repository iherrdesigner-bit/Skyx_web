// Toast
const toast = document.getElementById('toast');
function showToast(msg='Copied'){toast.textContent=msg;toast.classList.remove('hidden');toast.classList.add('show');setTimeout(()=>{toast.classList.remove('show');toast.classList.add('hidden');},1200);}

// DOM
const fileInput=document.getElementById('fileInput');
const grid=document.getElementById('grid');
const panel=document.getElementById('panel');
const closePanel=document.getElementById('closePanel');
const clearBtn=document.getElementById('clearBtn');

// Panel fields
const preview=document.getElementById('preview');
const mfilename=document.getElementById('m-filename');
const msize=document.getElementById('m-size');
const mres=document.getElementById('m-res');
const miso=document.getElementById('m-iso');
const mexpo=document.getElementById('m-expo');
const mapert=document.getElementById('m-ap');
const mfocal=document.getElementById('m-fl');
const mdate=document.getElementById('m-date');
const mgps=document.getElementById('m-gps');
const mtone=document.getElementById('m-tone');

const captionEl=document.getElementById('caption');
const hashtagsEl=document.getElementById('hashtags');
const regenTagsBtn=document.getElementById('regenTags');
const copyTagsBtn=document.getElementById('copyTags');
const saveTxtBtn=document.getElementById('saveTxt');
const tagModeEl=document.getElementById('tagMode');

// Prompt
const translateBtn2=document.getElementById('translateBtn2');
const ltEndpointEl2=document.getElementById('ltEndpoint2');
const promptRU2=document.getElementById('promptRU2');
const promptEN2=document.getElementById('promptEN2');

let items=[];
const seenFiles = new Set();

function bytesToSize(bytes){if(bytes===0)return'0 B';const k=1024,sizes=['B','KB','MB','GB'];const i=Math.floor(Math.log(bytes)/Math.log(k));return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+' '+sizes[i];}

function createCard(item, idx){const card=document.createElement('div');card.className='card';const img=document.createElement('img');img.loading='lazy';img.src=item.url;const label=document.createElement('div');label.className='label';label.textContent=item.file.name;card.appendChild(img);card.appendChild(label);card.addEventListener('click',()=>openPanel(idx));return card;}

async function handleFiles(fileList){
  const arr = Array.from(fileList || []);
  let processed = 0;
  for (const file of arr){
    const name = (file && file.name) ? file.name.toLowerCase() : '';
    const byExt = /\.(jpg|jpeg|png|heic|heif|gif|webp)$/i.test(name);
    const byType = file && file.type && file.type.startsWith('image/');
    if (!byExt && !byType) continue;

    const key = (file.name||'')+'|'+(file.size||0)+'|'+(file.lastModified||0);
    if (seenFiles.has(key)) continue;
    seenFiles.add(key);

    const url = URL.createObjectURL(file);
    const dim = await getImageSize(url);
    let exif = {};
    try{ exif = await exifr.parse(file,{tiff:true,ifd1:true,exif:true,gps:true,xmp:true}); }catch(e){ exif = {}; }
    const item = { file, url, width: dim.width, height: dim.height, exif };
    items.push(item);
    grid.appendChild(createCard(item, items.length-1));
    processed++;
  }
  if (processed===0){ showToast('Не удалось загрузить фото (или уже добавлены)'); }
}

function getImageSize(url){return new Promise((resolve)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.src=url;});}
fileInput.addEventListener('change',e=>handleFiles(e.target.files));
clearBtn.addEventListener('click',()=>{items=[];grid.innerHTML='';Array.from(seenFiles).forEach(k=>seenFiles.delete(k));});

// Panel open/close
const closePanelBtn=document.getElementById('closePanel');
closePanelBtn.addEventListener('click',()=>{panel.classList.add('hidden');panel.setAttribute('aria-hidden','true');});

async function openPanel(idx){
  const it=items[idx];
  preview.src=it.url;
  mfilename.textContent=it.file.name;
  msize.textContent=bytesToSize(it.file.size);
  mres.textContent=`${it.width}×${it.height}`;
  const ex=it.exif||{};
  miso.textContent = ex.ISO || ex.ISOSpeedRatings || '—';
  const fnum = ex.FNumber || ex.fNumber || ex.ApertureValue;
  mapert.textContent = fnum ? `f/${(typeof fnum==='number')?fnum.toFixed(1):fnum}` : '—';
  const sh = ex.ExposureTime || ex.exposureTime;
  let shStr=''; if (sh){ if (typeof sh==='number'){ shStr = sh>=1?`${sh.toFixed(0)}s`:`1/${Math.round(1/sh)}s`; } else { shStr=`${sh}s`; } }
  mexpo.textContent = shStr || '—';
  const foc = ex.FocalLength; mfocal.textContent = (typeof foc==='number')?`${Math.round(foc)}mm`:'—';
  const dt = ex.DateTimeOriginal || ex.CreateDate || ex.ModifyDate || ''; mdate.textContent = dt?String(dt).replace(/:/,'-').replace(/:/,'-'):'—';
  try{ const g=await exifr.gps(it.file); mgps.textContent = (g && g.latitude!=null && g.longitude!=null) ? `${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}` : '—'; }catch(e){ mgps.textContent='—'; }
  const t = await analyzeTone(it.url); mtone.textContent = t.tone; const st = await getPixelSeedAndStats(it.url); it._cats = st.cats;
  makeOptimizedCaption({tone:t.tone}, it).then(v=>captionEl.value=v);
  hashtagsEl.value = (tagModeEl.value==='engagement') ? generateHashtagsEngagement({}, it) : generateHashtags({}, it);
  panel.classList.remove('hidden'); panel.setAttribute('aria-hidden','false');
}

function analyzeTone(url){return new Promise((resolve)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const canvas=document.createElement('canvas');const w=64,h=64;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data;let sum=0,cool=0,warm=0;for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];const y=0.2126*r+0.7152*g+0.0722*b;sum+=y;if(b>r+10)cool++; if(r>g+10&&r>b+10)warm++;}const avg=sum/(w*h);let tone='balanced';if(avg<70)tone='low-light/moody';else if(avg>180)tone='bright/airy';if(cool>warm&&avg<140)tone+=' · cool'; else if(warm>cool&&avg<140)tone+=' · warm';resolve({avg,tone});};img.src=url;});}

// IG-optimized caption
function buildHook(ctx,tone){const seed=(ctx&&ctx.userEN?ctx.userEN.trim():"")||"A moment where light slows the world down";let hook=seed.split(/[.!?]/)[0].trim();if(hook.length<24)hook="Cinematic pause in the "+(tone.includes("low-light")?"dark":"light");if(hook.length>125)hook=hook.slice(0,122).trim().replace(/\\W+$/,'')+"…";return hook;}
function buildBody(tone){if(tone.includes("low-light"))return"Quiet shadows, measured breathing, a frame that holds its breath.";if(tone.includes("bright"))return"Clean air, crisp lines, light carving space with intent.";return"Stillness between movements, shaped by light and timing.";}
function buildCTA(){return"What stays with you in this frame?";}
async function makeOptimizedCaption(ctx,item){
  const stats = await getPixelSeedAndStats(item.url);
  const tone = (ctx && ctx.tone) || stats.tone || (mtone.textContent||'balanced');
  const seed = (stats.hash ^ (item.file?.size||0) ^ (item.file?.lastModified||0)) >>> 0;
  const rnd = seededRandom(seed);
  const user = (ctx && ctx.userEN ? ctx.userEN.trim() : "");
  // hook pools by category
  const pool = [];
  const add = (arr)=>arr.forEach(v=>pool.push(v));
  if (stats.cats.includes('sky/water')) add(["Horizon breathing in blue","Where the sky writes in water","Air sketched in ripple and light","A calm held by open sky"]);
  if (stats.cats.includes('nature/green')) add(["Green holds the frame steady","Quiet growth between light and leaf","Wind writes soft notes in the field","The earth pauses and listens"]);
  if (stats.cats.includes('warm/city/sunset')) add(["Streets glow like pocket embers","Neon stitches the dusk together","Heat lingers on the edge of glass","Evening hums in warm lines"]);
  if (stats.cats.includes('monochrome')) add(["Grain and breath, all in grayscale","Light pares the scene to bones","Shadows speak in low voices","Edges and hush, nothing extra"]);
  if (pool.length===0) add(["A moment where light slows the world down","Time leans on the frame and rests","Between beats, the image begins","Calm held in passing light"]);
  let hook = user ? user.split(/[.!?]/)[0].trim() : pickFrom(pool, rnd);
  if (hook.length > 125) hook = hook.slice(0,122).trim().replace(/\W+$/,'')+"…";
  if (!user && /low-light/.test(tone)) hook += " • night";
  if (!user && /bright/.test(tone)) hook += " • daylight";

  // body pools by tone
  const bodiesLow=["Quiet shadows, measured breathing, a frame that holds its breath.","Low light, slow steps, details stitched from hush.","Dim edges, steady heart, motion turning into memory."];
  const bodiesBright=["Clean air, crisp lines, light carving space with intent.","Sunlit clarity, edges ringing like glass.","Bright air, easy focus, the day drawn in bold."];
  const bodiesBalanced=["Stillness between movements, shaped by light and timing.","Composed pause, detail settling into place.","A calm hinge between before and after."];
  let body = /low-light/.test(tone) ? pickFrom(bodiesLow, rnd) : /bright/.test(tone) ? pickFrom(bodiesBright, rnd) : pickFrom(bodiesBalanced, rnd);

  const cta = buildCTA();
  const out = hook+"\n"+body+"\n"+cta;
  const hc=document.getElementById('hookCount'); if(hc) hc.textContent=`hook ${hook.length}/125`;
  return out;
}


function generateHashtags(ctx,item){
  const ex=item.exif||{};
  const baseCore=["photography","visualstory","storytelling","creativephoto"];
  const tone=(mtone.textContent||"").toLowerCase();
  const cats=(item._cats||[]);

  const topical=[];
  if (cats.includes('sky/water')) topical.push("sky","bluesky","waterscape","seascape");
  if (cats.includes('nature/green')) topical.push("nature","green","forest","field","outdoor");
  if (cats.includes('warm/city/sunset')) topical.push("citylights","neon","sunset","dusk","nightcity");
  if (cats.includes('monochrome')) topical.push("monochrome","bnw","blackandwhite");

  if (tone.includes("low-light")) topical.push("lowlight","nightshots");
  if (tone.includes("bright")) topical.push("brighttones","cleanair");

  const lens=[];
  const fl = ex.FocalLength;
  if (typeof fl==='number'){ if(fl<=24) lens.push("wideangle"); else if(fl>=80) lens.push("telephoto"); else lens.push("standardlens"); }
  const fnum = ex.FNumber||ex.fNumber; if (typeof fnum==='number' && fnum<=2.0) lens.push("shallowdepth");

  let tags = [];
  tags.push(...baseCore);
  tags.push("cinematicphotography","lightandshadow","colorgrading","bokeh","cinematic");
  tags.push(...topical, ...lens);

  // Deduplicate & format with #
  tags = Array.from(new Set(tags)).map(t=>t.startsWith('#')?t:'#'+t);

  // Cap sizes: mode-aware
  const mode = (document.getElementById('tagMode')?.value)||'engagement';
  const maxLen = mode==='reach' ? 28 : 10;
  return tags.slice(0, maxLen).join(' ');
}

function generateHashtagsEngagement(ctx,item){const baseHF=["photography","cinematicphotography","visualstory","moodytones","lightandshadow"];const hf=Array.from(new Set(baseHF)).slice(0,4).map(t=>"#"+t);let lf=generateHashtags(ctx,item).split(/\\s+/).filter(t=>!hf.includes(t) && !["#photooftheday","#instaphoto","#composition","#cinematic"].includes(t));const all=Array.from(new Set([...hf,...lf])).slice(0,10);while(all.length<8)all.push("#visualstory");return all.join(" ");}

// Clipboard helpers
async function copyToClipboard(text){try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);showToast('Copied');return true;}}catch(e){}const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';ta.style.left='-9999px';document.body.appendChild(ta);ta.focus();ta.select();try{const ok=document.execCommand('copy');document.body.removeChild(ta);showToast(ok?'Copied':'Copy failed');return ok;}catch(e){document.body.removeChild(ta);showToast('Copy failed');return false;}}
const copyCaptionBtn=document.getElementById('copyCaption');copyCaptionBtn?.addEventListener('click',()=>{copyToClipboard(captionEl.value||'');});
copyTagsBtn?.addEventListener('click',()=>{copyToClipboard(hashtagsEl.value||'');});

// Translation (optional; online if endpoint provided)
async function translateRuToEn(text, endpoint){const url=(endpoint&&endpoint.trim())||'https://libretranslate.com/translate';try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:text,source:'ru',target:'en',format:'text'})});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();return data.translatedText||'';}catch(e){console.warn('Translation failed:',e);return '';}}
translateBtn2?.addEventListener('click', async ()=>{const ru=(promptRU2?.value||'').trim(); if(!ru){showToast('Введите текст'); return;} const en=await translateRuToEn(ru, ltEndpointEl2?.value||''); promptEN2.textContent=en||'—'; const it=items.find(x=>x.url===preview.src); makeOptimizedCaption({userEN:en, tone:(mtone.textContent||'')}, it).then(v=>captionEl.value=v); hashtagsEl.value = (tagModeEl.value==='engagement') ? generateHashtagsEngagement({userEN:en}, it) : generateHashtags({userEN:en}, it); showToast('Translated & generated');});

tagModeEl?.addEventListener('change',()=>{const it=items.find(x=>x.url===preview.src); if(!it)return; hashtagsEl.value = (tagModeEl.value==='engagement') ? generateHashtagsEngagement({}, it) : generateHashtags({}, it);});


// === Varied caption (seeded, tone-aware) ===
function seededRandom(seed){ let t = seed % 2147483647; if (t <= 0) t += 2147483646; return function(){ return (t = t * 16807 % 2147483647) / 2147483647; }; }
function getSeedFromItem(item){ const a = (item?.file?.size||0) ^ (item?.file?.lastModified||0) ^ (item?.width||0) ^ (item?.height||0); return a>>>0; }
function pickFrom(arr, rnd){ return arr[Math.floor(rnd()*arr.length)]; }

function buildHook2(ctx,tone,item){
  const seed = getSeedFromItem(item); const rnd = seededRandom(seed);
  const user = (ctx && ctx.userEN ? ctx.userEN.trim() : "");
  if (user) {
    let hook = user.split(/[.!?]/)[0].trim();
    if (hook.length > 125) hook = hook.slice(0,122).trim().replace(/\W+$/,'')+"…";
    if (hook.length < 24) hook = hook + " — " + pickFrom(["held breath","thin light","soft edges","quiet frame"], rnd);
    return hook;
  }
  const cool = tone.includes('cool'), warm = tone.includes('warm');
  const low = tone.includes('low-light'), bright = tone.includes('bright');
  const hooksLow = ["Night folds into a quiet frame","Where shadows breathe a little slower","Silence gathers in the corners of light","Soft darkness, still pulse"];
  const hooksBright = ["Light carves the day into clean lines","Air so clear it hums","Edges sharpen where the sun lands","The day opens like a lens"];
  const hooksBalanced = ["A moment where light slows the world down","Time leans on the frame and rests","Between beats, the image begins","Calm held in passing light"];
  let pool = hooksBalanced; if (low) pool = hooksLow; if (bright) pool = hooksBright;
  let hook = pickFrom(pool, rnd);
  if (cool) hook += " • cool";
  if (warm) hook += " • warm";
  if (hook.length > 125) hook = hook.slice(0,122).trim().replace(/\W+$/,'')+"…";
  return hook;
}

function buildBody2(tone,item){
  const seed = getSeedFromItem(item); const rnd = seededRandom(seed+7);
  const bodiesLow=["Quiet shadows, measured breathing, a frame that holds its breath.","Low light, slow steps, details stitched from hush.","Dim edges, steady heart, motion turning into memory."];
  const bodiesBright=["Clean air, crisp lines, light carving space with intent.","Sunlit clarity, edges ringing like glass.","Bright air, easy focus, the day drawn in bold."];
  const bodiesBalanced=["Stillness between movements, shaped by light and timing.","Composed pause, detail settling into place.","A calm hinge between before and after."];
  if (tone.includes('low-light')) return pickFrom(bodiesLow, rnd);
  if (tone.includes('bright')) return pickFrom(bodiesBright, rnd);
  return pickFrom(bodiesBalanced, rnd);
}



// === Content Analysis (pixels → categories) ===
async function getPixelSeedAndStats(url){
  return new Promise((resolve)=>{
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload = ()=>{
      const w = 96, h = Math.max(64, Math.round(96*img.naturalHeight/img.naturalWidth));
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      const ctx = c.getContext('2d'); ctx.drawImage(img,0,0,w,h);
      const data = ctx.getImageData(0,0,w,h).data;
      let sum=0, cool=0, warm=0, satSum=0, hueBins=new Array(6).fill(0), hash=0;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2];
        const y=0.2126*r+0.7152*g+0.0722*b;
        sum+=y; hash = (hash*31 + r*3 + g*5 + b*7 + 1315423911) >>> 0;
        const max=Math.max(r,g,b),min=Math.min(r,g,b); const s=max===0?0:(max-min)/max; satSum+=s;
        // hue bucket (rough)
        let hue=0;
        if(max===min){ hue=0; }
        else if(max===r){ hue=(60*((g-b)/(max-min))+360)%360; }
        else if(max===g){ hue=(60*((b-r)/(max-min))+120)%360; }
        else { hue=(60*((r-g)/(max-min))+240)%360; }
        const bin = Math.floor(hue/60)%6; hueBins[bin]++;
        if(b>r+10) cool++; if(r>g+10 && r>b+10) warm++;
      }
      const avg=sum/(w*h), sat= satSum/(w*h);
      // categories by hue bins
      const red = hueBins[0]+hueBins[5], yellow=hueBins[1], green=hueBins[2], cyan=hueBins[3], blue=hueBins[4];
      const cats=[];
      if(blue+cyan>green && blue+cyan>red) cats.push('sky/water');
      if(green>blue && green>red) cats.push('nature/green');
      if(red>green && red>blue) cats.push('warm/city/sunset');
      if(sat<0.12) cats.push('monochrome');
      const tone = avg<70?'low-light/moody':(avg>180?'bright/airy':'balanced') + ((cool>warm&&avg<140)?' · cool':(warm>cool&&avg<140)?' · warm':'');
      resolve({avg, sat, hueBins, cats, tone, hash});
    };
    img.src=url;
  });
}

