// Toast
const toast = document.getElementById('toast');
function showToast(msg='Copied'){toast.textContent=msg;toast.classList.remove('hidden');toast.classList.add('show');setTimeout(()=>{toast.classList.remove('show');toast.classList.add('hidden');},1200);}

// DOM
const fileInput=document.getElementById('fileInput');
const grid=document.getElementById('grid');
const dropzone=document.getElementById('dropzone');
const panel=document.getElementById('panel');
const closePanel=document.getElementById('closePanel');
const clearBtn=document.getElementById('clearBtn');
const importBtn=document.getElementById('importBtn');

// Panel
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

function bytesToSize(bytes){if(bytes===0)return'0 B';const k=1024,sizes=['B','KB','MB','GB'];const i=Math.floor(Math.log(bytes)/Math.log(k));return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+' '+sizes[i];}

function createCard(item, idx){const card=document.createElement('div');card.className='card';const img=document.createElement('img');img.loading='lazy';img.src=item.url;const label=document.createElement('div');label.className='label';label.textContent=item.file.name;card.appendChild(img);card.appendChild(label);card.addEventListener('click',()=>openPanel(idx));return card;}

async function handleFiles(fileList){
  const list = Array.from(fileList || []);
  let processed = 0;
  for (const file of list){
    const name = (file && file.name) ? file.name.toLowerCase() : '';
    const byExt = /\.(jpg|jpeg|png|heic|heif|gif|webp)$/i.test(name);
    const byType = file && file.type && file.type.startsWith('image/');
    if (!byExt && !byType) {
      // skip non-images
      continue;
    }
    const url = URL.createObjectURL(file);
    const dim = await getImageSize(url);
    let exif = {};
    try { exif = await exifr.parse(file,{tiff:true,ifd1:true,exif:true,gps:true,xmp:true}); } catch(e){ exif = {}; }
    const item = { file, url, width: dim.width, height: dim.height, exif };
    items.push(item);
    const card = createCard(item, items.length - 1);
    grid.appendChild(card);
    processed++;
  }
  if (processed === 0) {
    showToast('Не удалось загрузить фото. Попробуй другое JPG/PNG.');
  }
}

function getImageSize(url){return new Promise((resolve)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.src=url;});}

// DnD
['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.style.borderColor='#3a4356';}));
['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.style.borderColor='rgba(110,150,200,.45)';}));
dropzone.addEventListener('drop',e=>{e.preventDefault();handleFiles(e.dataTransfer.files);});
fileInput.addEventListener('change',e=>handleFiles(e.target.files));
clearBtn.addEventListener('click',()=>{items=[];grid.innerHTML='';});
importBtn?.addEventListener('click',()=>{try{fileInput.click();}catch(e){console.warn('fileInput click failed',e);}});
closePanel.addEventListener('click',()=>{panel.classList.add('hidden');panel.setAttribute('aria-hidden','true');});

// Panel
async function openPanel(idx){
  const it=items[idx];
  preview.src=it.url;
  mfilename.textContent=it.file.name;
  msize.textContent=bytesToSize(it.file.size);
  mres.textContent=`${it.width}×${it.height}`;
  // EXIF
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
  // Tone
  const t = await analyzeTone(it.url); mtone.textContent = t.tone;
  // Caption + tags
  captionEl.value = makeOptimizedCaption({tone:t.tone}, it);
  hashtagsEl.value = (tagModeEl.value==='engagement') ? generateHashtagsEngagement({}, it) : generateHashtags({}, it);
  panel.classList.remove('hidden'); panel.setAttribute('aria-hidden','false');
}

function analyzeTone(url){return new Promise((resolve)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const canvas=document.createElement('canvas');const w=64,h=64;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data;let sum=0,cool=0,warm=0;for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];const y=0.2126*r+0.7152*g+0.0722*b;sum+=y;if(b>r+10)cool++; if(r>g+10&&r>b+10)warm++;}const avg=sum/(w*h);let tone='balanced';if(avg<70)tone='low-light/moody';else if(avg>180)tone='bright/airy';if(cool>warm&&avg<140)tone+=' · cool'; else if(warm>cool&&avg<140)tone+=' · warm';resolve({avg,tone});};img.src=url;});}

// ==== IG-optimized caption ====
function buildHook(ctx,tone){const seed=(ctx&&ctx.userEN?ctx.userEN.trim():"")||"A moment where light slows the world down";let hook=seed.split(/[.!?]/)[0].trim();if(hook.length<24)hook="Cinematic pause in the "+(tone.includes("low-light")?"dark":"light");if(hook.length>125)hook=hook.slice(0,122).trim().replace(/\W+$/,'')+"…";return hook;}
function buildBody(tone){if(tone.includes("low-light"))return"Quiet shadows, measured breathing, a frame that holds its breath.";if(tone.includes("bright"))return"Clean air, crisp lines, light carving space with intent.";return"Stillness between movements, shaped by light and timing.";}
function buildCTA(){return"What stays with you in this frame?";}
function makeOptimizedCaption(ctx,item){const tone=(ctx&&ctx.tone)|| (mtone.textContent||"balanced");const hook=buildHook(ctx,tone);const body=buildBody(tone);const cta=buildCTA();const out=hook+"\\n"+body+"\\n"+cta;const hc=document.getElementById('hookCount');if(hc)hc.textContent=`hook ${hook.length}/125`;return out;}
function generateHashtags(ctx,item){const hf=["#photography","#cinematicphotography","#visualstory","#moodytones","#lightandshadow","#colorgrading","#bokeh","#storytelling","#creativephoto","#cinematic"];const ex=item.exif||{};const tone=(mtone.textContent||"").toLowerCase();let lf=[];if(tone.includes("low-light"))lf.push("lowlight","nightshots","softshadows");if(tone.includes("bright"))lf.push("cleanlook","brighttones");const fnum=ex.FNumber||ex.fNumber; if(typeof fnum==='number' && fnum<=2.0) lf.push("shallowdepth"); const fl=ex.FocalLength; if(typeof fl==='number'){ if(fl<=24)lf.push("wideangle"); else if(fl>=80)lf.push("telephoto"); else lf.push("standardlens"); } lf=Array.from(new Set(lf)).slice(0,14).map(t=>"#"+t); const all=[...hf.slice(0,14),...lf].slice(0,28); while(all.length<28)all.push("#visualstory"); return all.join(" ");}
function generateHashtagsEngagement(ctx,item){const baseHF=["photography","cinematicphotography","visualstory","moodytones","lightandshadow"];const hf=Array.from(new Set(baseHF)).slice(0,4).map(t=>"#"+t);let lf=generateHashtags(ctx,item).split(/\s+/).filter(t=>!hf.includes(t) && !["#photooftheday","#instaphoto","#composition","#cinematic"].includes(t));const all=Array.from(new Set([...hf,...lf])).slice(0,10);while(all.length<8)all.push("#visualstory");return all.join(" ");}

// Translation (optional; works online if endpoint provided)
async function translateRuToEn(text, endpoint){const url=(endpoint&&endpoint.trim())||'https://libretranslate.com/translate';try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:text,source:'ru',target:'en',format:'text'})});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();return data.translatedText||'';}catch(e){console.warn('Translation failed:',e);return '';}}
translateBtn2?.addEventListener('click', async ()=>{const ru=(promptRU2?.value||'').trim(); if(!ru){showToast('Введите текст'); return;} const en=await translateRuToEn(ru, ltEndpointEl2?.value||''); promptEN2.textContent=en||'—'; const it=items.find(x=>x.url===preview.src); captionEl.value = makeOptimizedCaption({userEN:en, tone:(mtone.textContent||'')}, it); hashtagsEl.value = (tagModeEl.value==='engagement') ? generateHashtagsEngagement({userEN:en}, it) : generateHashtags({userEN:en}, it); showToast('Translated & generated');});

// Hashtag mode toggle
tagModeEl?.addEventListener('change',()=>{const it=items.find(x=>x.url===preview.src); if(!it)return; hashtagsEl.value = (tagModeEl.value==='engagement') ? generateHashtagsEngagement({}, it) : generateHashtags({}, it);});


// ===== Clipboard helpers (works in iOS Safari/PWA) =====
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast('Copied');
      return true;
    }
  } catch(e) { /* fallback below */ }
  // Fallback: select hidden textarea and execCommand
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(ok ? 'Copied' : 'Copy failed');
    return ok;
  } catch (e) {
    document.body.removeChild(ta);
    showToast('Copy failed');
    return false;
  }
}


const copyCaptionBtn = document.getElementById('copyCaption');
copyCaptionBtn?.addEventListener('click', () => { copyToClipboard(captionEl.value || ''); });
copyTagsBtn?.addEventListener('click', () => { copyToClipboard(hashtagsEl.value || ''); });
