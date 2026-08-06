const SITUATIONS = [
  {id:'fio_caido', txt:'Cabo ou fio rompido, caído no chão', level:'critico'},
  {id:'contato_pessoa', txt:'Fiação em contato com pessoa ou animal', level:'critico'},
  {id:'veiculo_preso', txt:'Veículo preso em fios elétricos', level:'critico'},
  {id:'contato_metal', txt:'Fiação em contato com estrutura metálica (grade, telhado, poste)', level:'critico'},
  {id:'poste_quebrado', txt:'Poste elétrico quebrado ou muito inclinado', level:'alto'},
  {id:'fiacao_exposta', txt:'Fiação exposta ao alcance de pessoas, sem contato', level:'alto'},
  {id:'faisca_fumaca', txt:'Faísca, fumaça ou barulho anormal na rede', level:'alto'},
  {id:'outra', txt:'Outra situação de risco elétrico', level:'medio'},
];

const LEVEL_META = {
  critico:{label:'CRÍTICO', badgeClass:'b-critico', color:'var(--critical)', fill:'100%', pulse:true,
    note:'Risco iminente à vida. Roteamento imediato e prioritário para a equipe operacional.',
    sla:'Atendimento imediato prioritário', slaSub:'Equipe acionada assim que o protocolo é gerado'},
  alto:{label:'ALTO', badgeClass:'b-alto', color:'var(--high)', fill:'66%', pulse:false,
    note:'Situação de risco relevante, sem contato ativo confirmado. Prioridade alta na fila.',
    sla:'Atendimento em até 4 horas', slaSub:'Estimativa de demonstração'},
  medio:{label:'MÉDIO', badgeClass:'b-medio', color:'var(--medium)', fill:'33%', pulse:false,
    note:'Situação a ser avaliada pela equipe técnica antes de despacho de campo.',
    sla:'Atendimento em até 24 horas', slaSub:'Estimativa de demonstração'},
};

const STEPS = ['hero','situacao','evidencia','confirmacao','protocolo'];
let stepIndex = 0;
// cada item de state.files: { file, url, coords:{lat,lng}|null, status:'pending'|'ok'|'error' }
let state = { situationId:null, files:[], consentLocation:false, consentTerm:false, ref:'' };

function renderSituations(){
  const list = document.getElementById('situationList');
  list.innerHTML = '';
  SITUATIONS.forEach(s=>{
    const meta = LEVEL_META[s.level];
    const card = document.createElement('button');
    card.className = 'option-card';
    card.type = 'button';
    card.innerHTML = `<span class="txt">${s.txt}</span><span class="badge ${meta.badgeClass}">${meta.label}</span>`;
    card.onclick = ()=> selectSituation(s.id, card);
    card.dataset.id = s.id;
    list.appendChild(card);
  });
}

function selectSituation(id, el){
  state.situationId = id;
  document.querySelectorAll('.option-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  const s = SITUATIONS.find(x=>x.id===id);
  const meta = LEVEL_META[s.level];
  const wrap = document.getElementById('meterWrap');
  wrap.classList.add('show');
  document.getElementById('meterVal').textContent = meta.label;
  document.getElementById('meterVal').style.color = meta.color;
  const fill = document.getElementById('meterFill');
  fill.style.width = meta.fill;
  fill.style.color = meta.color;
  fill.classList.toggle('pulse', meta.pulse);
  document.getElementById('meterNote').textContent = meta.note;
  updateNextEnabled();
}

function renderThumbs(){
  const wrap = document.getElementById('thumbs');
  wrap.innerHTML = '';
  state.files.forEach((entry,i)=>{
    const div = document.createElement('div');
    div.className = 'thumb' + (entry.status === 'error' ? ' err' : '');
    if(entry.file.type.startsWith('video')){
      div.innerHTML = `<video src="${entry.url}" muted></video>`;
    } else {
      div.innerHTML = `<img src="${entry.url}" alt="Evidência ${i+1}">`;
    }

    const statusEl = document.createElement('div');
    if(entry.status === 'ok'){
      statusEl.className = 'thumb-status ok';
      statusEl.textContent = `${entry.coords.lat.toFixed(4)}, ${entry.coords.lng.toFixed(4)}`;
    } else if(entry.status === 'error'){
      statusEl.className = 'thumb-status error';
      statusEl.textContent = 'Sem localização';
    } else {
      statusEl.className = 'thumb-status pending';
      statusEl.textContent = 'Obtendo local…';
    }
    div.appendChild(statusEl);

    if(entry.status === 'error'){
      const retry = document.createElement('button');
      retry.className = 'retry'; retry.textContent = '↻'; retry.title = 'Tentar novamente';
      retry.onclick = ()=> captureLocationForFile(i);
      div.appendChild(retry);
    }

    const rm = document.createElement('button');
    rm.className = 'rm'; rm.textContent = '✕';
    rm.onclick = ()=>{ state.files.splice(i,1); renderThumbs(); updateNextEnabled(); };
    div.appendChild(rm);

    wrap.appendChild(div);
  });
}

function captureLocationForFile(i){
  const entry = state.files[i];
  if(!entry) return;
  entry.status = 'pending';
  renderThumbs();

  if(!navigator.geolocation){
    entry.status = 'error';
    renderThumbs();
    updateNextEnabled();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos)=>{
      entry.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      entry.status = 'ok';
      renderThumbs();
      updateNextEnabled();
    },
    ()=>{
      entry.coords = null;
      entry.status = 'error';
      renderThumbs();
      updateNextEnabled();
    },
    { enableHighAccuracy:true, timeout:10000 }
  );
}

document.getElementById('fileInput').addEventListener('change', (e)=>{
  Array.from(e.target.files).forEach(file=>{
    state.files.push({ file, url: URL.createObjectURL(file), coords:null, status:'pending' });
  });
  renderThumbs();
  // dispara a captura de localização no exato momento do envio de cada evidência
  state.files.forEach((entry,i)=>{ if(entry.status === 'pending') captureLocationForFile(i); });
  updateNextEnabled();
  e.target.value = '';
});

function toggleLocationConsent(checked){
  state.consentLocation = checked;
  const box = document.getElementById('uploadBox');
  const input = document.getElementById('fileInput');
  const title = document.getElementById('uploadTitle');
  box.classList.toggle('locked', !checked);
  input.disabled = !checked;
  title.textContent = checked ? 'Toque para tirar foto ou gravar vídeo' : 'Autorize a localização acima para anexar';
  updateNextEnabled();
}

function toggleTermConsent(checked){
  state.consentTerm = checked;
  updateNextEnabled();
}

document.getElementById('refField').addEventListener('input', (e)=>{
  state.ref = e.target.value;
});


function updateProgress(){
  const wrap = document.getElementById('progress');
  wrap.innerHTML = '';
  const flowSteps = ['situacao','evidencia','confirmacao'];
  const current = STEPS[stepIndex];
  if(current === 'hero' || current === 'protocolo'){ wrap.style.visibility='hidden'; return; }
  wrap.style.visibility='visible';
  flowSteps.forEach(s=>{
    const dot = document.createElement('div');
    dot.className = 'dot';
    const idx = flowSteps.indexOf(s);
    const curIdx = flowSteps.indexOf(current);
    if(idx < curIdx) dot.classList.add('done');
    if(idx === curIdx) dot.classList.add('now');
    wrap.appendChild(dot);
  });
}

function updateNextEnabled(){
  const btn = document.getElementById('btnNext');
  const current = STEPS[stepIndex];
  let ok = true;
  if(current === 'situacao') ok = !!state.situationId;
  if(current === 'evidencia'){
    // exige consentimento de localização, ao menos 1 evidência, e localização obtida com sucesso para TODAS as evidências
    ok = state.consentLocation && state.files.length > 0 && state.files.every(f => f.status === 'ok');
  }
  if(current === 'confirmacao') ok = !!state.consentTerm;
  btn.disabled = !ok;
}

function updateBottombar(){
  const current = STEPS[stepIndex];
  const bar = document.getElementById('bottombar');
  const back = document.getElementById('btnBack');
  const next = document.getElementById('btnNext');
  if(current === 'hero' || current === 'protocolo'){
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  back.style.visibility = current === 'situacao' ? 'hidden' : 'visible';
  next.textContent = current === 'confirmacao' ? 'Enviar ocorrência' : 'Continuar';
  updateNextEnabled();
}

function renderStep(){
  document.querySelectorAll('.panel').forEach(p=>{
    p.classList.toggle('active', p.dataset.step === STEPS[stepIndex]);
  });
  updateProgress();
  updateBottombar();
  window.scrollTo({top:0, behavior:'instant'});
}

function goTo(stepName){
  stepIndex = STEPS.indexOf(stepName);
  renderStep();
}

function nextStep(){
  const current = STEPS[stepIndex];

  if(current === 'confirmacao'){
    const btn = document.getElementById('btnNext');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    setTimeout(()=>{
      buildSummary();
      generateProtocol();
      stepIndex++;
      renderStep();
    }, 1800);

    return;
  }

  if(stepIndex < STEPS.length - 1){
    stepIndex++;
    if(STEPS[stepIndex] === 'confirmacao') buildSummary();
    renderStep();
  }
}

function prevStep(){
  if(stepIndex > 0){ stepIndex--; renderStep(); }
}

function buildSummary(){
  const s = SITUATIONS.find(x=>x.id===state.situationId);
  const meta = LEVEL_META[s.level];
  document.getElementById('sumSituacao').textContent = s.txt;
  document.getElementById('sumCriticidade').textContent = meta.label;
  document.getElementById('sumCriticidade').style.color = meta.color;
  document.getElementById('sumEvidencias').textContent = `${state.files.length} arquivo(s)`;
  const withLoc = state.files.filter(f => f.status === 'ok').length;
  document.getElementById('sumLocal').textContent = withLoc > 0
    ? `${withLoc}/${state.files.length} evidência(s) com localização vinculada`
    : 'Não informado';
}

function generateProtocol(){
  const s = SITUATIONS.find(x=>x.id===state.situationId);
  const meta = LEVEL_META[s.level];
  const num = 'PERE-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random()*899999));
  document.getElementById('protoNum').textContent = num;
  const badge = document.getElementById('protoCritBadge');
  badge.textContent = meta.label;
  badge.style.background = meta.color;
  badge.style.color = '#fff';
}

function resetFlow(){
  state = { situationId:null, files:[], consentLocation:false, consentTerm:false, ref:'' };
  document.getElementById('meterWrap').classList.remove('show');
  document.getElementById('refField').value = '';
  document.getElementById('consentLocationCheck').checked = false;
  document.getElementById('consentTermCheck').checked = false;
  toggleLocationConsent(false);
  renderThumbs();
  renderSituations();
  goTo('hero');
}

const phoneField = document.getElementById("phoneField");

phoneField.addEventListener("input", function (e) {
    let value = e.target.value.replace(/\D/g, "");

    // Limita a 11 dígitos
    value = value.substring(0, 11);

    if (value.length > 10) {
        // Celular: (99) 9 9999-9999
        value = value.replace(
            /^(\d{2})(\d{1})(\d{4})(\d{0,4}).*/,
            "($1) $2 $3-$4"
        );
    } else if (value.length > 2) {
        value = value.replace(
            /^(\d{2})(\d+)/,
            "($1) $2"
        );
    } else if (value.length > 0) {
        value = value.replace(
            /^(\d*)/,
            "($1"
        );
    }

    e.target.value = value;
});

renderSituations();
renderStep();
