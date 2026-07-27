// ============================================================
// BIOL 40B Lab Exam 2 — Spelling Drill
// One pin at a time; you type the structure. Spelling counts,
// and a wrong spelling gets a hint that shows which letters are off.
// Reads the same generated data.js as the labeling app.
// ============================================================

const RESULT_STORE   = 'bio40b_spell_results';
const SETTINGS_STORE = 'bio40b_spell_settings';
const KEY_STORE      = 'bio40b_labexam2_answerKeys';   // shared with the labeling app
const MARKER_STORE   = 'bio40b_labexam2_markers';      // the labeling app's canvas copy

// Names a student can reasonably type instead of the key's wording. These are
// synonyms, not spellings -- a misspelt synonym still gets the spelling hint.
const ALIASES = {
    'Erythrocytes': ['red blood cell', 'red blood cells', 'rbc', 'rbcs'],
    'Platelets': ['thrombocyte', 'thrombocytes'],
    'Right and left bundle branches': ['bundle branches', 'left and right bundle branches', 'right and left bundle branch'],
    'Atrioventricular bundle (bundle of His)': ['av bundle', 'bundle of his', 'atrioventricular bundle', 'his bundle'],
    'Purkinje fibers': ['purkinje fibres', 'purkinje fibre', 'conduction myofibers'],
    'Myofiber': ['myofibre', 'muscle fiber', 'muscle fibre', 'cardiac muscle fiber'],
    'External nares (nostril)': ['nostril', 'nares', 'external nares'],
    'Vocal fold (vocal cords)': ['vocal cord', 'vocal cords', 'true vocal cord', 'true vocal cords', 'vocal fold'],
    'Opening of auditory (pharyngotympanic) tube': [
        'opening of auditory tube', 'opening of the auditory tube', 'auditory tube opening',
        'pharyngotympanic tube opening', 'eustachian tube opening', 'opening of eustachian tube'],
    'Nasal conchae': ['nasal concha', 'concha', 'conchae', 'turbinate', 'nasal turbinate'],
    'Nasal meatus': ['meatus', 'nasal meatuses'],
    'Tunica interna (intima)': ['tunica intima', 'tunica interna', 'intima'],
    'Anterior interventricular artery': ['left anterior descending artery', 'lad', 'anterior interventricular branch'],
    'Posterior interventricular artery': ['posterior interventricular branch', 'posterior descending artery'],
    'Atrioventricular (AV) node': ['av node', 'atrioventricular node'],
    'Sinoatrial (SA) node': ['sa node', 'sinoatrial node', 'sinuatrial node'],
    'Alveolar duct / sac': ['alveolar duct', 'alveolar sac'],
    'Aorta (ascending)': ['ascending aorta', 'aorta'],
    'Ascending aorta': ['aorta ascending'],
    'Apex of heart': ['apex', 'apex of the heart', 'heart apex'],
    'Auricle of left atrium': ['left auricle', 'auricle of the left atrium'],
    'Right auricle': ['auricle of right atrium', 'auricle of the right atrium'],
    'Parietal layer of serous pericardium': ['parietal pericardium', 'parietal serous pericardium', 'parietal layer of the serous pericardium'],
    'Epicardium (visceral serous pericardium)': ['visceral pericardium', 'visceral serous pericardium'],
    'Tracheal (seromucous) glands': ['tracheal gland', 'seromucous gland', 'seromucous glands', 'tracheal glands'],
    'Pseudostratified ciliated columnar epithelium': ['pseudostratified columnar epithelium', 'ciliated pseudostratified columnar epithelium'],
    'Intercalated disc': ['intercalated disk'],
    'Nucleus (central)': ['nucleus', 'central nucleus'],
    'Main (primary) bronchus': ['primary bronchus', 'main bronchus'],
    'Lobar (secondary) bronchus': ['secondary bronchus', 'lobar bronchus'],
    'Segmental (tertiary) bronchus': ['tertiary bronchus', 'segmental bronchus'],
    'Bicuspid (mitral) valve': ['mitral valve', 'bicuspid valve', 'left atrioventricular valve'],
    'Tricuspid valve': ['right atrioventricular valve'],
    'Aortic semilunar valve': ['aortic valve'],
    'Pulmonary semilunar valve': ['pulmonary valve', 'pulmonic valve'],
    'Intercostal muscles': ['intercostals', 'external intercostals', 'intercostal muscle'],
    'Cricothyroid ligament': ['cricothyroid membrane'],
    'Trabeculae carneae': ['trabecula carnea'],
    'Chordae tendineae': ['chorda tendinea'],
    'Cilia': ['cilium'],
    'Lung': ['lungs']
};

// ---- State ----
let ANSWER_KEYS = {};
let allPins  = [];          // every pin in the whole practical, in station order
let deck     = [];          // the pins in the current run
let deckPos  = 0;
let results  = {};          // pinKey -> { status, attempts, hints }
let settings = { scope: 'all', shuffle: false, pos: 0, mode: 'practice', minutes: 2 };

let q = null;               // current question state

// Test mode: a timed run of whole stations, the way the practical actually
// runs -- you rotate on the clock whether or not you finished the station.
// null whenever we're in practice mode.
let test = null;            // { stations, sIdx, answers, deadline, timerId, reports }

// Zoom / pan
let zoomLevel = 1, panX = 0, panY = 0;
let isPanning = false, panStart = null;
let pinchStartDist = 0, pinchStartZoom = 1;

// ============================================================
// Text normalising, accepted variants, and edit-distance hints
// ============================================================

function norm(s) {
    return String(s)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2018\u2019\u02bc]/g, "'")
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Letters only -- used to tell "spelling is wrong" from "spacing is wrong".
function letters(s) {
    return norm(s).replace(/ /g, '');
}

function singularPlural(n) {
    const w = n.split(' ');
    const last = w[w.length - 1];
    if (last.length < 4) return null;
    let alt;
    if (last.endsWith('ies'))                       alt = last.slice(0, -3) + 'y';
    else if (/(s|x|z|ch|sh)es$/.test(last))         alt = last.slice(0, -2);
    else if (last.endsWith('s') && !last.endsWith('ss')) alt = last.slice(0, -1);
    else                                            alt = last + 's';
    w[w.length - 1] = alt;
    return w.join(' ');
}

// Every spelling of a structure we will accept as correct.
function variantsOf(raw) {
    const out = new Set();
    const add = s => { const n = norm(s); if (n) out.add(n); };

    add(raw);

    if (raw.includes('(')) {
        add(raw.replace(/\s*\([^)]*\)/g, ' '));                  // drop the parenthetical
        add(raw.replace(/(\S+)\s*\(([^)]*)\)/g, '$2'));          // it replaces the word before it
        const trail = raw.match(/^(.*?)\s*\(([^)]*)\)\s*$/);     // trailing one can lead instead
        if (trail) {
            add(trail[2] + ' ' + trail[1]);
            if (trail[2].trim().split(/\s+/).length >= 2) add(trail[2]);
        }
    }

    if (raw.includes('/')) {
        const parts = raw.split('/').map(s => s.trim()).filter(Boolean);
        add(parts.join(' '));
        const lead = parts[0].split(/\s+/);
        parts.forEach((p, i) => {
            add(p);
            if (i > 0 && lead.length > 1) add(lead.slice(0, -1).join(' ') + ' ' + p);
        });
    }

    (ALIASES[raw] || []).forEach(add);

    // Singular and plural of whatever we have so far.
    Array.from(out).forEach(v => {
        const alt = singularPlural(v);
        if (alt) out.add(alt);
    });

    return Array.from(out);
}

// Levenshtein with a backtrace, so we can say *where* the spelling went wrong
// without simply printing the answer. Ops are relative to what was typed:
// match / sub (wrong letter) / extra (letter too many) / missing (letter left out).
function editOps(typed, target) {
    const m = typed.length, n = target.length;
    const dp = [], bt = [];
    for (let i = 0; i <= m; i++) {
        dp.push(new Array(n + 1).fill(0));
        bt.push(new Array(n + 1).fill(''));
    }
    for (let i = 1; i <= m; i++) { dp[i][0] = i; bt[i][0] = 'extra'; }
    for (let j = 1; j <= n; j++) { dp[0][j] = j; bt[0][j] = 'missing'; }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = typed[i - 1] === target[j - 1] ? 0 : 1;
            const sub = dp[i - 1][j - 1] + cost;
            const del = dp[i - 1][j] + 1;      // extra letter in what was typed
            const ins = dp[i][j - 1] + 1;      // letter missing from what was typed
            const best = Math.min(sub, del, ins);
            dp[i][j] = best;
            bt[i][j] = best === sub ? (cost ? 'sub' : 'match') : (best === del ? 'extra' : 'missing');
        }
    }

    const ops = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        const op = (i > 0 && j > 0) ? bt[i][j] : (i > 0 ? 'extra' : 'missing');
        if (op === 'match' || op === 'sub') { ops.push({ op, ch: typed[i - 1] }); i--; j--; }
        else if (op === 'extra')            { ops.push({ op, ch: typed[i - 1] }); i--; }
        else                                { ops.push({ op }); j--; }
    }
    ops.reverse();
    return { dist: dp[m][n], ops };
}

// A miss counts as "the right structure, spelt wrong" if it is within this
// many edits. Longer names get a little more rope.
function spellingTolerance(target) {
    return Math.min(8, Math.max(2, Math.round(target.length * 0.25)));
}

// The structure elsewhere in the practical that the typed answer is nearest to.
// Lets us separate "you named the wrong thing" from "you mistyped the right thing".
function nearestOtherPin(typedNorm, self) {
    let best = null;
    allPins.forEach(p => {
        if (self && p.key === self.key) return;
        const r = bestVariantMatch(typedNorm, p.variants);
        if (r && (!best || r.dist < best.dist)) best = { pin: p, variant: r.variant, dist: r.dist, ops: r.ops };
    });
    return best;
}

function bestVariantMatch(typedNorm, variants) {
    let best = null;
    variants.forEach(v => {
        const r = editOps(typedNorm, v);
        if (!best || r.dist < best.dist) best = { variant: v, dist: r.dist, ops: r.ops };
    });
    return best;
}

// The typed answer, with its bad letters marked. Correct letters they *missed*
// are never shown -- a caret says "something belongs here", not what.
function renderDiff(ops) {
    let html = '', pendingGap = false;
    ops.forEach(o => {
        if (o.op === 'missing') { pendingGap = true; return; }
        if (pendingGap) { html += '<span class="gap" title="a letter is missing here">&#9660;</span>'; pendingGap = false; }
        const ch = o.ch === ' ' ? '&middot;' : escapeHtml(o.ch);
        if (o.op === 'match')      html += `<span class="ok">${ch}</span>`;
        else if (o.op === 'sub')   html += `<span class="bad">${ch}</span>`;
        else                       html += `<span class="extra">${ch}</span>`;
    });
    if (pendingGap) html += '<span class="gap" title="a letter is missing here">&#9660;</span>';
    return `<span class="diff">${html}</span>`;
}

function describeMiss(ops, dist) {
    const subs    = ops.filter(o => o.op === 'sub').length;
    const extras  = ops.filter(o => o.op === 'extra').length;
    const missing = ops.filter(o => o.op === 'missing').length;

    // Two neighbouring wrong letters usually means a transposition ("-ae-" for "-ea-").
    for (let i = 0; i < ops.length - 1; i++) {
        if (ops[i].op === 'sub' && ops[i + 1].op === 'sub' && subs === 2 && dist === 2) {
            return 'Two letters are in the wrong order.';
        }
    }
    if (dist === 1) {
        if (missing) return 'One letter is missing &mdash; the marker shows where.';
        if (extras)  return 'One letter too many.';
        return 'One letter is wrong.';
    }
    const bits = [];
    if (subs)    bits.push(`${subs} wrong letter${subs > 1 ? 's' : ''}`);
    if (missing) bits.push(`${missing} missing`);
    if (extras)  bits.push(`${extras} too many`);
    return `Close &mdash; ${bits.join(', ')}.`;
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// Data
// ============================================================

function loadKeys() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY_STORE) || '{}') || {}; } catch (e) {}
    ANSWER_KEYS = {};
    IMAGE_ORDER.forEach(station => {
        const pins = (saved[station] && saved[station].length) ? saved[station] : PRESET_KEYS[station];
        ANSWER_KEYS[station] = (pins || []).filter(p => p && p.word);
    });

    allPins = [];
    IMAGE_ORDER.forEach(station => {
        ANSWER_KEYS[station].forEach((pin, idx) => {
            allPins.push({
                key: station + ':' + pin.id,
                station, pin,
                indexInStation: idx + 1,
                stationCount: ANSWER_KEYS[station].length,
                variants: variantsOf(pin.word)
            });
        });
    });
}

function loadState() {
    try { results = JSON.parse(localStorage.getItem(RESULT_STORE) || '{}') || {}; } catch (e) { results = {}; }
    try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_STORE) || '{}') || {};
        settings = Object.assign(settings, s);
    } catch (e) {}
}

function saveResults() {
    try { localStorage.setItem(RESULT_STORE, JSON.stringify(results)); } catch (e) {}
}

function saveSettings() {
    try { localStorage.setItem(SETTINGS_STORE, JSON.stringify(settings)); } catch (e) {}
}

// Where the student got to, so a 121-pin run survives closing the tab. Only
// ordered decks resume: a shuffled order isn't stored, so its index is meaningless.
function savePosition() {
    settings.pos = settings.shuffle ? 0 : deckPos;
    saveSettings();
}

// ============================================================
// Deck
// ============================================================

function buildDeck(keepPosition) {
    let pool;
    if (settings.scope === 'all') {
        pool = allPins.slice();
    } else if (settings.scope === 'misses') {
        pool = allPins.filter(p => results[p.key] && results[p.key].status !== 'first');
        if (!pool.length) {
            showToast('Nothing missed yet — running all 121 instead', 'success');
            settings.scope = 'all';
            pool = allPins.slice();
            document.getElementById('scope-select').value = 'all';
        }
    } else {
        pool = allPins.filter(p => p.station === settings.scope);
    }

    if (settings.shuffle) {
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
    }

    deck = pool;
    if (!keepPosition || deckPos >= deck.length) deckPos = 0;
    savePosition();
}

function restartDeck() {
    if (settings.mode === 'test') { startTest(); return; }
    buildDeck(false);
    document.getElementById('summary').style.display = 'none';
    loadQuestion();
}

function clearProgress() {
    results = {};
    saveResults();
    renderScoreboard();
    showToast('Scores cleared', 'success');
}

// ============================================================
// Teacher mode — drag a pin or its label, save the key
// Writes the key the labeling app reads, so a fix lands in both.
// ============================================================

let teacher = null;         // { station, pins, dirty }
let dragging = null;        // { kind: 'pin'|'label', idx, grabDx, grabDy }

function isTeacher() { return settings.mode === 'teacher' && !!teacher; }

// Teacher edits one station; the deck picker's "all"/"misses" have no station,
// so fall back to whichever one the current pin belongs to.
function teacherStation() {
    if (settings.scope !== 'all' && settings.scope !== 'misses') return settings.scope;
    return (q && q.item) ? q.item.station : IMAGE_ORDER[0];
}

function startTeacher() {
    const station = teacherStation();
    teacher = {
        station,
        pins: JSON.parse(JSON.stringify(ANSWER_KEYS[station] || [])),
        dirty: false
    };
    deck = allPins.filter(p => p.station === station);
    deckPos = 0;
    q = { item: deck[0], attempts: 0, hintLevel: 0, solved: false, revealed: false };
    document.getElementById('summary').style.display = 'none';
    document.getElementById('teacher-station').innerHTML =
        `<b>${escapeHtml(IMAGE_DATA[station].title)}</b><br>` +
        `<span class="station-sub">${teacher.pins.length} pins &mdash; drag to correct</span>`;
    renderImage();
    renderTeacherPins();
    setTeacherStatus('');
}

function setTeacherStatus(msg, kind) {
    const el = document.getElementById('teacher-status');
    el.textContent = msg || '';
    el.className = 'teacher-status' + (kind ? ' ' + kind : '');
}

function renderTeacherPins() {
    if (!isTeacher()) return;
    const layer = document.getElementById('markers-layer');
    const svg = document.getElementById('lines-layer');
    svg.innerHTML = '';
    layer.innerHTML = '';

    teacher.pins.forEach((pin, idx) => {
        const dx = pin.labelDx || 0;
        const dy = (pin.labelDx || pin.labelDy) ? (pin.labelDy || 0) : 5;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pin.x + '%');
        line.setAttribute('y1', pin.y + '%');
        line.setAttribute('x2', (pin.x + dx) + '%');
        line.setAttribute('y2', (pin.y + dy) + '%');
        line.setAttribute('stroke', '#1a6fa0');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '4,3');
        line.setAttribute('opacity', '0.8');
        svg.appendChild(line);

        const dot = document.createElement('div');
        dot.className = 'teach-dot';
        dot.dataset.idx = idx;
        dot.dataset.kind = 'pin';
        dot.style.left = pin.x + '%';
        dot.style.top = pin.y + '%';
        dot.textContent = idx + 1;
        layer.appendChild(dot);

        const label = document.createElement('div');
        label.className = 'teach-label';
        label.dataset.idx = idx;
        label.dataset.kind = 'label';
        label.style.left = (pin.x + dx) + '%';
        label.style.top = (pin.y + dy) + '%';
        label.textContent = pin.word;
        layer.appendChild(label);
    });
}

// Screen point -> percentage of the image, undoing the zoom/pan transform.
function clientToPct(clientX, clientY) {
    const viewport = document.getElementById('image-viewport');
    const container = document.getElementById('image-container');
    const r = viewport.getBoundingClientRect();
    const localX = (clientX - r.left - container.offsetLeft - panX) / zoomLevel;
    const localY = (clientY - r.top - container.offsetTop - panY) / zoomLevel;
    return {
        x: (localX / container.offsetWidth) * 100,
        y: (localY / container.offsetHeight) * 100
    };
}

function setupTeacherDrag() {
    const layer = document.getElementById('markers-layer');

    layer.addEventListener('pointerdown', e => {
        if (!isTeacher()) return;
        const el = e.target.closest('.teach-dot, .teach-label');
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(el.dataset.idx, 10);
        const pin = teacher.pins[idx];
        const p = clientToPct(e.clientX, e.clientY);
        const anchorX = el.dataset.kind === 'pin' ? pin.x : pin.x + (pin.labelDx || 0);
        const anchorY = el.dataset.kind === 'pin' ? pin.y
                        : pin.y + ((pin.labelDx || pin.labelDy) ? (pin.labelDy || 0) : 5);
        dragging = { kind: el.dataset.kind, idx, grabDx: p.x - anchorX, grabDy: p.y - anchorY };
        el.classList.add('grabbing');
        el.setPointerCapture(e.pointerId);
    });

    layer.addEventListener('pointermove', e => {
        if (!dragging || !isTeacher()) return;
        // A mouse that is over the image with no button down is not dragging --
        // catches a pointerup that was swallowed elsewhere.
        if (e.pointerType === 'mouse' && e.buttons === 0) { endDrag(); return; }
        e.preventDefault();
        const p = clientToPct(e.clientX, e.clientY);
        const pin = teacher.pins[dragging.idx];
        const x = clamp(p.x - dragging.grabDx, 0, 100);
        const y = clamp(p.y - dragging.grabDy, 0, 100);
        if (dragging.kind === 'pin') { pin.x = round2(x); pin.y = round2(y); }
        else { pin.labelDx = round2(x - pin.x); pin.labelDy = round2(y - pin.y); }
        teacher.dirty = true;
        // Move just this pin's three elements. Re-rendering the layer here would
        // delete the element holding the pointer capture, stranding the drag.
        movePinElements(dragging.idx);
        setTeacherStatus('Unsaved changes', 'dirty');
    });

    // Released anywhere -- including outside the image -- ends the drag.
    ['pointerup', 'pointercancel'].forEach(evt => {
        layer.addEventListener(evt, endDrag);
        window.addEventListener(evt, endDrag);
    });
}

function endDrag() {
    if (!dragging) return;
    dragging = null;
    document.querySelectorAll('.teach-dot.grabbing, .teach-label.grabbing')
            .forEach(el => el.classList.remove('grabbing'));
}

// Reposition one pin's dot, label and leader line in place.
function movePinElements(idx) {
    const pin = teacher.pins[idx];
    const dx = pin.labelDx || 0;
    const dy = (pin.labelDx || pin.labelDy) ? (pin.labelDy || 0) : 5;

    const dot = document.querySelector(`.teach-dot[data-idx="${idx}"]`);
    const label = document.querySelector(`.teach-label[data-idx="${idx}"]`);
    const line = document.querySelectorAll('#lines-layer line')[idx];
    if (dot)   { dot.style.left = pin.x + '%';        dot.style.top = pin.y + '%'; }
    if (label) { label.style.left = (pin.x + dx) + '%'; label.style.top = (pin.y + dy) + '%'; }
    if (line) {
        line.setAttribute('x1', pin.x + '%');
        line.setAttribute('y1', pin.y + '%');
        line.setAttribute('x2', (pin.x + dx) + '%');
        line.setAttribute('y2', (pin.y + dy) + '%');
    }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round2(v) { return Math.round(v * 100) / 100; }

function saveTeacherKey() {
    if (!isTeacher()) return;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY_STORE) || '{}') || {}; } catch (e) {}
    saved[teacher.station] = JSON.parse(JSON.stringify(teacher.pins));
    try {
        localStorage.setItem(KEY_STORE, JSON.stringify(saved));
    } catch (e) {
        setTeacherStatus('Could not save — storage is full or blocked', 'error');
        return;
    }
    // The labeling app keeps its own canvas copy of a station's pins and only
    // re-seeds it from the key when it's missing. Drop the stale copy, or its
    // Teacher Mode would keep showing the pins we just corrected.
    try {
        const canvas = JSON.parse(localStorage.getItem(MARKER_STORE) || '{}') || {};
        if (canvas[teacher.station]) {
            delete canvas[teacher.station];
            localStorage.setItem(MARKER_STORE, JSON.stringify(canvas));
        }
    } catch (e) {}

    teacher.dirty = false;
    loadKeys();                       // refresh pins + accepted spellings
    setTeacherStatus(`Saved ${teacher.pins.length} pins for this station`, 'saved');
    showToast('Answer key saved — the labeling app sees it too', 'success');
}

// Back to the last saved state, discarding this session's dragging.
function revertTeacherEdits() {
    if (!isTeacher()) return;
    teacher.pins = JSON.parse(JSON.stringify(ANSWER_KEYS[teacher.station] || []));
    teacher.dirty = false;
    renderTeacherPins();
    setTeacherStatus('Edits undone', '');
}

// Back to the pins that shipped with the app.
function restoreTeacherPreset() {
    if (!isTeacher()) return;
    const preset = PRESET_KEYS[teacher.station];
    if (!preset || !preset.length) { setTeacherStatus('No original key for this station', 'error'); return; }
    teacher.pins = JSON.parse(JSON.stringify(preset));
    teacher.dirty = true;
    renderTeacherPins();
    setTeacherStatus('Original key loaded — press Save to keep it', 'dirty');
}

// ============================================================
// Test mode — 2 minutes a station, no hints, graded at the buzzer
// ============================================================

function isTest() { return settings.mode === 'test' && !!test; }

function setDrillMode(mode) {
    if (settings.mode === mode) return;
    if (isTeacher() && teacher.dirty &&
        !confirm('This station has unsaved pin edits. Leave without saving?')) return;

    stopClock();
    test = null;
    teacher = null;
    settings.mode = mode;
    saveSettings();

    ['practice', 'test', 'teacher'].forEach(m =>
        document.getElementById('pill-' + m).classList.toggle('active', m === mode));
    document.getElementById('minutes-field').style.display = mode === 'test' ? '' : 'none';
    document.getElementById('test-clock').style.display = mode === 'test' ? '' : 'none';
    const teaching = mode === 'teacher';
    document.getElementById('teacher-card').style.display = teaching ? '' : 'none';
    document.getElementById('quiz-card').style.display  = teaching ? 'none' : '';
    document.getElementById('scoreboard').style.display = teaching ? 'none' : '';
    document.getElementById('how-panel').style.display  = teaching ? 'none' : '';
    // Nothing is being drilled, so the deck controls have nothing to say.
    document.getElementById('shuffle-field').style.display = teaching ? 'none' : '';
    document.getElementById('btn-restart').style.display   = teaching ? 'none' : '';
    document.getElementById('btn-clear').style.display     = teaching ? 'none' : '';
    document.querySelector('.drill-progress').style.display = teaching ? 'none' : '';
    document.getElementById('summary').style.display = 'none';

    if (mode === 'test') startTest();
    else if (mode === 'teacher') startTeacher();
    else { buildDeck(false); loadQuestion(); }
}

// Which stations a test covers, following the deck picker.
function stationsForScope() {
    if (settings.scope === 'all') return IMAGE_ORDER.filter(k => ANSWER_KEYS[k].length);
    if (settings.scope === 'misses') {
        const hit = new Set(allPins.filter(p => results[p.key] && results[p.key].status !== 'first')
                                   .map(p => p.station));
        const list = IMAGE_ORDER.filter(k => hit.has(k));
        return list.length ? list : IMAGE_ORDER.filter(k => ANSWER_KEYS[k].length);
    }
    return [settings.scope];
}

function startTest() {
    stopClock();
    test = { stations: stationsForScope(), sIdx: 0, answers: {}, deadline: 0, timerId: null, reports: [] };
    document.getElementById('summary').style.display = 'none';
    startStation();
}

function startStation() {
    const station = test.stations[test.sIdx];
    deck = allPins.filter(p => p.station === station);
    if (settings.shuffle) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }
    deckPos = 0;
    document.getElementById('summary').style.display = 'none';
    startClock(settings.minutes * 60);
    loadQuestion();
}

function startClock(seconds) {
    stopClock();
    test.deadline = Date.now() + seconds * 1000;
    test.timerId = setInterval(tickClock, 250);
    tickClock();
}

function stopClock() {
    if (test && test.timerId) { clearInterval(test.timerId); test.timerId = null; }
}

function tickClock() {
    if (!test) return;
    const left = Math.max(0, test.deadline - Date.now());
    const secs = Math.ceil(left / 1000);
    const el = document.getElementById('clock-time');
    el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    el.classList.toggle('warning', secs <= 30 && secs > 0);
    el.classList.toggle('expired', secs === 0);
    document.getElementById('clock-label').textContent =
        `Station ${test.sIdx + 1} of ${test.stations.length} · ${shortTitle(test.stations[test.sIdx])}`;
    if (left <= 0) { stopClock(); finishStation(true); }
}

function shortTitle(station) {
    return String(IMAGE_DATA[station].title).replace(/^Station\s*\d+\s*·\s*/, '');
}

// Whatever is in the box belongs to the pin we're leaving.
function stashAnswer() {
    if (!isTest() || !q) return;
    test.answers[q.item.key] = document.getElementById('answer-input').value.trim();
}

// The buzzer, or "Finish station" — grade every pin of the station at once.
function finishStation(ranOut) {
    if (!isTest()) return;
    stashAnswer();
    stopClock();

    const station = test.stations[test.sIdx];
    const rows = deck.map(item => {
        const typed = (test.answers[item.key] || '').trim();
        const verdict = typed ? classifyAnswer(typed, item) : { kind: 'blank' };
        const right = verdict.kind === 'correct' || verdict.kind === 'spacing';
        results[item.key] = {
            status: right ? 'first' : 'missed',
            attempts: typed ? 1 : 0,
            hints: 0,
            word: item.pin.word,
            station: item.station,
            typed
        };
        return { item, typed, right, kind: verdict.kind };
    });
    saveResults();

    const score = rows.filter(r => r.right).length;
    test.reports.push({ station, rows, score, total: rows.length, ranOut: !!ranOut });

    // The station is marked — nothing about it is editable any more.
    const input = document.getElementById('answer-input');
    input.disabled = true;
    input.value = '';
    input.placeholder = 'Station marked';
    ['btn-check', 'btn-back', 'btn-next', 'btn-finish-station']
        .forEach(id => { document.getElementById(id).disabled = true; });

    renderStationReport(ranOut);
    renderScoreboard();
}

function renderStationReport(ranOut) {
    const rep = test.reports[test.reports.length - 1];
    const last = test.sIdx >= test.stations.length - 1;
    const box = document.getElementById('summary');
    box.style.display = 'block';
    box.innerHTML =
        `<h2>${ranOut ? 'Time&rsquo;s up' : 'Station finished'} &mdash; ${escapeHtml(shortTitle(rep.station))}</h2>
         <div class="summary-score">${rep.score} / ${rep.total} correct</div>
         <div class="missed-list report-list">` +
        rep.rows.map(r =>
            `<div class="missed-item ${r.right ? 'row-right' : 'row-wrong'}">
                <b>${escapeHtml(r.item.pin.word)}</b>
                <span class="typed">${r.typed
                    ? `you wrote &ldquo;${escapeHtml(r.typed)}&rdquo;`
                    : 'left blank'}</span>
                <span class="tag ${r.right ? 'ok' : 'revealed'}">${r.right
                    ? '&#10003;'
                    : (r.kind === 'spelling' ? 'spelling' : r.kind === 'blank' ? '&mdash;' : '&#10007;')}</span>
             </div>`).join('') +
        `</div>
         <div class="summary-actions">
            <button class="action-btn submit-btn" onclick="nextStation()">${
                last ? 'See full test report' : 'Next station &rarr;'}</button>
         </div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function nextStation() {
    if (!isTest()) return;
    test.sIdx++;
    if (test.sIdx >= test.stations.length) { finishTest(); return; }
    startStation();
}

function finishTest() {
    stopClock();
    const total = test.reports.reduce((n, r) => n + r.total, 0);
    const score = test.reports.reduce((n, r) => n + r.score, 0);
    const missed = test.reports.flatMap(r => r.rows.filter(x => !x.right));
    const pct = total ? Math.round((score / total) * 100) : 0;

    const box = document.getElementById('summary');
    box.style.display = 'block';
    box.innerHTML =
        `<h2>Test report</h2>
         <div class="summary-score">${score} / ${total} &mdash; ${pct}%</div>
         <h3>By station</h3>
         <div class="station-bars">` +
        test.reports.map(r => {
            const p = r.total ? (r.score / r.total) * 100 : 0;
            return `<div class="station-bar">
                        <span class="sb-name">${escapeHtml(shortTitle(r.station))}</span>
                        <span class="sb-track"><span class="sb-fill" style="width:${p}%"></span></span>
                        <span class="sb-score">${r.score}/${r.total}</span>
                    </div>`;
        }).join('') +
        `</div>` +
        (missed.length
            ? `<h3>Missed (${missed.length})</h3><div class="missed-list report-list">` +
              missed.map(r =>
                  `<div class="missed-item row-wrong"><b>${escapeHtml(r.item.pin.word)}</b>
                    <span class="typed">${r.typed
                        ? `you wrote &ldquo;${escapeHtml(r.typed)}&rdquo;`
                        : 'left blank'}</span></div>`).join('') +
              `</div>`
            : `<p class="summary-perfect">Every pin, on the clock. Nothing to review.</p>`) +
        `<div class="summary-actions">
            ${missed.length ? `<button class="action-btn save-btn" onclick="drillTestMisses()">Practise these ${missed.length}</button>` : ''}
            <button class="action-btn data-btn" onclick="startTest()">Run the test again</button>
         </div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('clock-time').textContent = '0:00';
    document.getElementById('clock-label').textContent = 'Test complete';
}

// Drop out of the clock and practise exactly what the test caught.
function drillTestMisses() {
    const missed = test.reports.flatMap(r => r.rows.filter(x => !x.right)).map(x => x.item);
    stopClock();
    test = null;
    settings.mode = 'practice';
    saveSettings();
    document.getElementById('pill-practice').classList.add('active');
    document.getElementById('pill-test').classList.remove('active');
    document.getElementById('minutes-field').style.display = 'none';
    document.getElementById('test-clock').style.display = 'none';
    document.getElementById('summary').style.display = 'none';
    deck = missed;
    deckPos = 0;
    loadQuestion();
}

// ============================================================
// Question flow
// ============================================================

// Buttons and copy differ between practice and test; keep it in one place.
function applyModeUI() {
    const testing = isTest();
    document.getElementById('btn-hint').style.display   = testing ? 'none' : '';
    document.getElementById('btn-reveal').style.display = testing ? 'none' : '';
    document.getElementById('btn-back').style.display   = testing ? '' : 'none';
    document.getElementById('btn-finish-station').style.display = testing ? '' : 'none';
    document.getElementById('hint-box').style.display = testing ? 'none' : '';

    if (testing) {
        ['btn-check', 'btn-next', 'btn-finish-station']
            .forEach(id => { document.getElementById(id).disabled = false; });
        document.getElementById('btn-back').disabled = deckPos === 0;
        document.getElementById('btn-next').textContent =
            deckPos >= deck.length - 1 ? 'Wrap round' : 'Next →';
        document.getElementById('btn-check').textContent = 'Save';
        document.getElementById('answer-input').placeholder = 'Type it, then Enter for the next pin…';
    } else {
        document.getElementById('answer-input').placeholder = 'Type the structure’s name…';
    }

    const how = document.getElementById('how-panel');
    how.innerHTML = testing
        ? `<h3>Test mode</h3>
           <p>${settings.minutes} minute${settings.minutes > 1 ? 's' : ''} a station, like the
              real rotation. Type an answer and press Enter for the next pin; <b>Back</b> and
              <b>Next</b> move around the station freely, so you can come back to one.
              No hints, no answers &mdash; everything is marked when the clock runs out or
              you press <b>Finish station</b>.</p>`
        : `<h3>How this works</h3>
           <p>One pin at a time, all 121 of them. Type the name exactly &mdash;
              <b>spelling counts</b>. Case, spaces and punctuation don’t.
              Miss it and you’ll get a hint pointing at which letters are
              wrong, and you retype it until it’s right.</p>`;
}

function loadQuestion() {
    const item = deck[deckPos];
    if (!item) { showSummary(); return; }

    q = {
        item,
        attempts: 0,
        hintLevel: 0,
        solved: false,
        revealed: false
    };

    document.getElementById('summary').style.display = 'none';
    document.getElementById('station-line').innerHTML =
        `<b>${escapeHtml(IMAGE_DATA[item.station].title)}</b><br>` +
        `<span class="station-sub">${escapeHtml(IMAGE_DATA[item.station].caption || '')}</span>`;
    document.getElementById('pin-number').textContent =
        `${item.indexInStation} of ${item.stationCount}`;

    const input = document.getElementById('answer-input');
    // In a test the station's answers stay editable until the buzzer, so a pin
    // you come back to still shows what you put.
    input.value = isTest() ? (test.answers[item.key] || '') : '';
    input.disabled = false;
    input.className = '';
    document.getElementById('feedback').innerHTML = '';
    document.getElementById('feedback').className = 'feedback';
    document.getElementById('hint-box').innerHTML = '';
    document.getElementById('btn-hint').disabled = false;
    document.getElementById('btn-reveal').disabled = false;
    document.getElementById('btn-check').textContent = 'Check';

    applyModeUI();
    renderImage();
    renderProgress();
    renderScoreboard();
    if (!isTouchDevice()) { input.focus(); input.select(); }
}

function isTouchDevice() {
    return window.matchMedia && window.matchMedia('(hover: none)').matches;
}

// What an answer is, before any of it touches the page.
//   correct  — accepted spelling of this pin
//   spacing  — right letters, only spacing/punctuation differs
//   other    — names a different structure in the practical
//   spelling — this structure, misspelt; carries the per-letter diff
//   wrong    — none of the above
function classifyAnswer(rawTyped, item) {
    const typed = norm(rawTyped);
    if (!typed) return { kind: 'empty' };

    if (item.variants.includes(typed)) return { kind: 'correct' };

    const typedLetters = typed.replace(/ /g, '');
    if (item.variants.some(v => v.replace(/ /g, '') === typedLetters)) return { kind: 'spacing' };

    // Checked before the spelling branch: "bicuspid" for tricuspid is a wrong
    // structure, not a wrong spelling, and must not be told it merely mistyped.
    const best  = bestVariantMatch(typed, item.variants);
    const rival = nearestOtherPin(typed, item);
    if (rival && rival.dist < best.dist && rival.dist <= spellingTolerance(rival.variant)) {
        return { kind: 'other', rival, exact: rival.dist === 0 };
    }

    if (best && best.dist <= spellingTolerance(best.variant)) {
        return { kind: 'spelling', best };
    }
    return { kind: 'wrong' };
}

function submitAnswer(e) {
    if (e) e.preventDefault();
    if (!q) return;

    // Under the clock nothing is marked: bank the answer and move along.
    if (isTest()) {
        stashAnswer();
        if (deckPos >= deck.length - 1) { deckPos = 0; } else { deckPos++; }
        loadQuestion();
        return;
    }

    // Once solved, Enter just moves on.
    if (q.solved || q.revealed) { nextPin(); return; }

    const input = document.getElementById('answer-input');
    const rawTyped = input.value.trim();
    if (!rawTyped) { input.focus(); return; }

    const verdict = classifyAnswer(rawTyped, q.item);
    if (verdict.kind === 'empty') { input.focus(); return; }
    q.attempts++;

    if (verdict.kind === 'correct') { markCorrect(); return; }
    if (verdict.kind === 'spacing') { markCorrect(true); return; }

    const fb = document.getElementById('feedback');

    if (verdict.kind === 'other') {
        const sameImage = verdict.rival.pin.station === q.item.station;
        fb.className = 'feedback wrong';
        fb.innerHTML =
            `<div class="fb-head">That&rsquo;s ${verdict.exact ? '' : 'closer to '}` +
            `<b>${escapeHtml(verdict.rival.pin.pin.word)}</b> &mdash; not this pin.</div>` +
            `<div class="fb-detail">${sameImage
                ? 'That structure is on this same image, but at a different pin.'
                : 'That structure belongs to another station.'}</div>`;
    } else if (verdict.kind === 'spelling') {
        const best = verdict.best;
        fb.className = 'feedback spelling';
        fb.innerHTML =
            `<div class="fb-head">Right structure &mdash; check your spelling.</div>` +
            `<div class="fb-detail">${describeMiss(best.ops, best.dist)}</div>` +
            renderDiff(best.ops) +
            `<div class="fb-legend"><span class="bad">red</span> = wrong letter, ` +
            `<span class="extra">struck</span> = one too many, ` +
            `<span class="gap">&#9660;</span> = a letter is missing. Try again.</div>`;
    } else {
        fb.className = 'feedback wrong';
        fb.innerHTML =
            `<div class="fb-head">Not this one.</div>` +
            `<div class="fb-detail">Attempt ${q.attempts}. Use <b>Hint</b> if you want a nudge.</div>`;
    }

    input.select();
    // A misspelling already carries its own guidance; don't pile a hint on top.
    if (verdict.kind !== 'spelling') maybeAutoHint();
    renderScoreboard();
}

// After two clean misses, start feeding hints without being asked.
function maybeAutoHint() {
    if (q.attempts >= 2 && q.hintLevel === 0) giveHint();
}

function markCorrect(spacingOnly) {
    q.solved = true;
    const status = (q.attempts === 1 && q.hintLevel === 0) ? 'first' : 'ok';
    recordResult(status);

    const input = document.getElementById('answer-input');
    input.value = q.item.pin.word;
    input.className = 'correct';
    input.disabled = true;

    const fb = document.getElementById('feedback');
    fb.className = 'feedback correct';
    const head = status === 'first'
        ? 'Correct &mdash; first try.'
        : `Correct, on attempt ${q.attempts}${q.hintLevel ? ' (with a hint)' : ''}.`;
    fb.innerHTML =
        `<div class="fb-head">${head}</div>` +
        (spacingOnly ? `<div class="fb-detail">Spelling was right; spacing/punctuation is free.</div>` : '') +
        (q.item.pin.func ? `<div class="fb-func">${escapeHtml(q.item.pin.func)}</div>` : '');

    document.getElementById('btn-check').textContent = 'Next';
    document.getElementById('btn-hint').disabled = true;
    document.getElementById('btn-reveal').disabled = true;
    document.getElementById('btn-next').focus();
    renderPin();
    renderProgress();
    renderScoreboard();
}

function revealAnswer() {
    if (!q || q.solved || q.revealed) return;
    q.revealed = true;
    recordResult('revealed');

    const input = document.getElementById('answer-input');
    input.value = q.item.pin.word;
    input.className = 'revealed';
    input.disabled = true;

    const fb = document.getElementById('feedback');
    fb.className = 'feedback revealed';
    fb.innerHTML =
        `<div class="fb-head">Answer: <b>${escapeHtml(q.item.pin.word)}</b></div>` +
        (q.item.pin.func ? `<div class="fb-func">${escapeHtml(q.item.pin.func)}</div>` : '') +
        `<div class="fb-detail">Filed under &ldquo;review my misses&rdquo;.</div>`;

    document.getElementById('btn-check').textContent = 'Next';
    document.getElementById('btn-hint').disabled = true;
    document.getElementById('btn-reveal').disabled = true;
    renderPin();
    renderProgress();
    renderScoreboard();
}

function recordResult(status) {
    results[q.item.key] = {
        status,
        attempts: q.attempts,
        hints: q.hintLevel,
        word: q.item.pin.word,
        station: q.item.station
    };
    saveResults();
}

function nextPin() {
    if (!q) return;

    // In a test, Next wraps within the station instead of ending anything.
    if (isTest()) {
        stashAnswer();
        deckPos = (deckPos + 1) % deck.length;
        loadQuestion();
        return;
    }

    // Leaving a pin unsolved still counts as a miss, so it comes back in review.
    if (!q.solved && !q.revealed && q.attempts > 0) recordResult('revealed');
    deckPos++;
    savePosition();
    if (deckPos >= deck.length) { showSummary(); return; }
    loadQuestion();
}

function prevPin() {
    if (!isTest() || deckPos === 0) return;
    stashAnswer();
    deckPos--;
    loadQuestion();
}

// ============================================================
// Hints
// ============================================================

function giveHint() {
    if (!q || q.solved || q.revealed) return;
    q.hintLevel = Math.min(q.hintLevel + 1, 3);
    const box = document.getElementById('hint-box');
    const word = q.item.pin.word;
    let html = '';

    if (q.hintLevel >= 1) {
        html += q.item.pin.func
            ? `<div class="hint"><b>What it does:</b> ${escapeHtml(q.item.pin.func)}</div>`
            : `<div class="hint"><b>Shape:</b> ${wordShape(word)}</div>`;
    }
    if (q.hintLevel >= 2) {
        html += `<div class="hint"><b>Shape:</b> ${wordShape(word)}</div>`;
    }
    if (q.hintLevel >= 3) {
        html += `<div class="hint"><b>Half of it:</b> <span class="mask">${maskAlternate(word)}</span></div>`;
    }

    box.innerHTML = html;
    if (q.hintLevel >= 3) document.getElementById('btn-hint').disabled = true;
    renderScoreboard();
    const input = document.getElementById('answer-input');
    if (!input.disabled && !isTouchDevice()) input.focus();
}

// "Left atrium" -> "L___ (4)  a_____ (6)" : first letter and length, nothing else.
function wordShape(word) {
    return word.split(/\s+/).map(w => {
        const core = w.replace(/[^A-Za-z]/g, '');
        if (!core) return escapeHtml(w);
        const rest = '_'.repeat(Math.max(0, core.length - 1));
        return `<span class="mask">${escapeHtml(core[0])}${rest}</span><span class="len">(${core.length})</span>`;
    }).join(' ');
}

// Every other letter, so the shape of the tricky bits shows through.
function maskAlternate(word) {
    let li = 0;
    return escapeHtml(word.split('').map(ch => {
        if (!/[A-Za-z]/.test(ch)) return ch;
        li++;
        return (li % 2 === 1) ? ch : '_';
    }).join(''));
}

// ============================================================
// Rendering
// ============================================================

function renderImage() {
    const item = q.item;
    const img = document.getElementById('main-image');
    if (img.getAttribute('src') !== IMAGE_DATA[item.station].src) {
        img.src = IMAGE_DATA[item.station].src;
        img.alt = IMAGE_DATA[item.station].title;
        zoomReset();
    }
    const draw = () => (isTeacher() ? renderTeacherPins() : renderPin());
    img.onload = () => { draw(); applyZoom(); };
    draw();
}

// One pin, unmistakable: a pulsing dot plus a leader line to a "?" tag placed
// exactly where the labeling app puts that structure's label.
function renderPin() {
    const item = q.item;
    const pin = item.pin;
    const layer = document.getElementById('markers-layer');
    const svg = document.getElementById('lines-layer');

    const dx = pin.labelDx || 0;
    const dy = (pin.labelDx || pin.labelDy) ? (pin.labelDy || 0) : 5;

    svg.innerHTML = '';
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pin.x + '%');
        line.setAttribute('y1', pin.y + '%');
        line.setAttribute('x2', (pin.x + dx) + '%');
        line.setAttribute('y2', (pin.y + dy) + '%');
        line.setAttribute('stroke', '#e07a5f');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '5,3');
        svg.appendChild(line);
    }

    const solved = q.solved || q.revealed;
    layer.innerHTML =
        `<div class="quiz-dot ${solved ? (q.solved ? 'done' : 'shown') : ''}"
              style="left:${pin.x}%; top:${pin.y}%"></div>` +
        `<div class="quiz-tag ${solved ? (q.solved ? 'done' : 'shown') : ''}"
              style="left:${pin.x + dx}%; top:${pin.y + dy}%">${
                solved ? escapeHtml(pin.word) : '?'
              }</div>`;
}

function renderProgress() {
    const pct = deck.length ? (deckPos / deck.length) * 100 : 0;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-text').textContent =
        deck.length ? `${Math.min(deckPos + 1, deck.length)} / ${deck.length}` : '0 / 0';
}

function renderScoreboard() {
    if (isTest()) {
        const answered = deck.filter(it => (test.answers[it.key] || '').trim()).length;
        document.getElementById('scoreboard').innerHTML =
            `<div class="score-row"><span class="chip first">${answered} of ${deck.length} answered</span>
             <span class="chip ok">station ${test.sIdx + 1} / ${test.stations.length}</span></div>
             <div class="score-note">Nothing is marked until the clock stops.</div>`;
        return;
    }
    const done = deck.slice(0, deckPos + (q && (q.solved || q.revealed) ? 1 : 0));
    let first = 0, ok = 0, shown = 0;
    done.forEach(it => {
        const r = results[it.key];
        if (!r) return;
        if (r.status === 'first') first++;
        else if (r.status === 'ok') ok++;
        else shown++;
    });

    const mastered = allPins.filter(p => results[p.key] && results[p.key].status === 'first').length;
    const seen = allPins.filter(p => results[p.key]).length;

    document.getElementById('scoreboard').innerHTML =
        `<div class="score-row">
            <span class="chip first">${first} first try</span>
            <span class="chip ok">${ok} with help</span>
            <span class="chip shown">${shown} shown</span>
         </div>
         <div class="score-note">Across all 121 pins: <b>${mastered}</b> nailed first try,
            ${seen} attempted.</div>`;
}

function showSummary() {
    const box = document.getElementById('summary');
    const rows = deck.map(it => ({ it, r: results[it.key] })).filter(x => x.r);
    const first = rows.filter(x => x.r.status === 'first').length;
    const missed = rows.filter(x => x.r.status !== 'first');

    box.style.display = 'block';
    box.innerHTML =
        `<h2>Deck finished</h2>
         <div class="summary-score">${first} / ${deck.length} first try</div>` +
        (missed.length
            ? `<h3>Worth another pass</h3><div class="missed-list">` +
              missed.map(x =>
                  `<div class="missed-item"><b>${escapeHtml(x.it.pin.word)}</b>
                    <span>${escapeHtml(IMAGE_DATA[x.it.station].title)}</span>
                    <span class="tag ${x.r.status}">${x.r.status === 'ok'
                        ? `got it in ${x.r.attempts}` : 'shown'}</span></div>`).join('') +
              `</div>`
            : `<p class="summary-perfect">Clean run &mdash; every pin first try.</p>`) +
        `<div class="summary-actions">
            ${missed.length ? `<button class="action-btn submit-btn" onclick="drillMissed()">Drill these ${missed.length} again</button>` : ''}
            <button class="action-btn data-btn" onclick="restartDeck()">Restart this deck</button>
         </div>`;

    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('progress-text').textContent = `${deck.length} / ${deck.length}`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function drillMissed() {
    const missed = deck.filter(it => results[it.key] && results[it.key].status !== 'first');
    if (!missed.length) return;
    deck = missed;
    deckPos = 0;
    document.getElementById('summary').style.display = 'none';
    loadQuestion();
}

function renderCredits() {
    const host = document.getElementById('credits-list');
    if (!host || typeof CREDITS === 'undefined') return;
    host.innerHTML = CREDITS.map(c => {
        const lic = c.lic ? `<span class="lic">${c.lic}</span>` : '';
        const src = c.url
            ? `<a href="${c.url}" target="_blank" rel="noopener noreferrer">${c.src}</a>`
            : c.src;
        return `<p class="credit"><b>${c.what}</b><br>${src} ${lic}</p>`;
    }).join('');
}

function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.innerHTML = msg;
    toast.className = 'toast ' + (type || '') + ' show';
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================================
// Zoom & pan
// ============================================================

function applyZoom() {
    const container = document.getElementById('image-container');
    container.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    document.getElementById('zoom-level').textContent = Math.round(zoomLevel * 100) + '%';
    document.getElementById('image-viewport').classList.toggle('zoomed', zoomLevel > 1.05);
}

function contentBox() {
    const viewport = document.getElementById('image-viewport');
    const container = document.getElementById('image-container');
    return {
        vw: viewport.clientWidth,
        vh: viewport.clientHeight,
        cw: container.offsetWidth,
        ch: container.offsetHeight,
        ox: container.offsetLeft,
        oy: container.offsetTop
    };
}

// The container is already centred by its own margin and the viewport grows to
// the image's height, so "fits" means pan 0 -- computing a centring offset here
// leaves a stale translate behind once a taller image loads.
function clampPan() {
    const b = contentBox();
    const w = b.cw * zoomLevel, h = b.ch * zoomLevel;
    panX = (w <= b.vw) ? 0 : Math.max(b.vw - w - b.ox, Math.min(-b.ox, panX));
    panY = (h <= b.vh) ? 0 : Math.max(b.vh - h - b.oy, Math.min(-b.oy, panY));
}

function zoomAt(newZoom, clientX, clientY) {
    const viewport = document.getElementById('image-viewport');
    const r = viewport.getBoundingClientRect();
    const b = contentBox();
    const fx = (clientX !== undefined) ? clientX - r.left : b.vw / 2;
    const fy = (clientY !== undefined) ? clientY - r.top  : b.vh / 2;
    // Keep the point under the cursor fixed.
    const localX = (fx - b.ox - panX) / zoomLevel;
    const localY = (fy - b.oy - panY) / zoomLevel;
    zoomLevel = newZoom;
    panX = fx - b.ox - localX * zoomLevel;
    panY = fy - b.oy - localY * zoomLevel;
    clampPan();
    applyZoom();
}

function zoomIn()  { zoomAt(Math.min(zoomLevel * 1.3, 6)); }
function zoomOut() { zoomAt(Math.max(zoomLevel / 1.3, 1)); }

function zoomReset() {
    zoomLevel = 1; panX = 0; panY = 0;
    clampPan();
    applyZoom();
}

// Histology pins are tiny; this parks the pin in the middle of the viewport.
function zoomToPin() {
    if (!q) return;
    const b = contentBox();
    zoomLevel = Math.min(3, Math.max(2, zoomLevel < 1.5 ? 2.5 : zoomLevel));
    const px = (q.item.pin.x / 100) * b.cw;
    const py = (q.item.pin.y / 100) * b.ch;
    panX = b.vw / 2 - b.ox - px * zoomLevel;
    panY = b.vh / 2 - b.oy - py * zoomLevel;
    clampPan();
    applyZoom();
}

function setupZoomPan() {
    const viewport = document.getElementById('image-viewport');

    viewport.addEventListener('wheel', e => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        zoomAt(Math.min(6, Math.max(1, zoomLevel * factor)), e.clientX, e.clientY);
    }, { passive: false });

    viewport.addEventListener('pointerdown', e => {
        if (zoomLevel <= 1.05 || e.pointerType === 'touch') return;
        isPanning = true;
        panStart = { x: e.clientX - panX, y: e.clientY - panY };
        viewport.classList.add('panning');
        viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', e => {
        if (!isPanning) return;
        panX = e.clientX - panStart.x;
        panY = e.clientY - panStart.y;
        clampPan();
        applyZoom();
    });
    ['pointerup', 'pointercancel'].forEach(evt =>
        viewport.addEventListener(evt, () => { isPanning = false; viewport.classList.remove('panning'); }));

    // Touch: one finger pans (when zoomed), two fingers pinch.
    let touchStart = null;
    viewport.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            pinchStartDist = touchDist(e.touches);
            pinchStartZoom = zoomLevel;
            touchStart = null;
        } else if (e.touches.length === 1 && zoomLevel > 1.05) {
            touchStart = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
        }
    }, { passive: true });

    viewport.addEventListener('touchmove', e => {
        if (e.touches.length === 2 && pinchStartDist) {
            e.preventDefault();
            const scale = touchDist(e.touches) / pinchStartDist;
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            zoomAt(Math.min(6, Math.max(1, pinchStartZoom * scale)), mx, my);
        } else if (e.touches.length === 1 && touchStart) {
            e.preventDefault();
            panX = e.touches[0].clientX - touchStart.x;
            panY = e.touches[0].clientY - touchStart.y;
            clampPan();
            applyZoom();
        }
    }, { passive: false });

    viewport.addEventListener('touchend', e => {
        if (e.touches.length < 2) pinchStartDist = 0;
        if (e.touches.length === 0) touchStart = null;
    });

    window.addEventListener('resize', () => { clampPan(); applyZoom(); });
}

function touchDist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}

// ============================================================
// Setup
// ============================================================

function setupScopeSelect() {
    const sel = document.getElementById('scope-select');
    const opts = [`<option value="all">All ${allPins.length} pins &mdash; whole practical</option>`,
                  `<option value="misses">Review my misses</option>`];
    IMAGE_ORDER.forEach(k => {
        opts.push(`<option value="${k}">${escapeHtml(IMAGE_DATA[k].title)} (${ANSWER_KEYS[k].length})</option>`);
    });
    sel.innerHTML = opts.join('');
    sel.value = settings.scope;
    if (sel.value !== settings.scope) { settings.scope = 'all'; sel.value = 'all'; }

    sel.addEventListener('change', () => {
        if (isTeacher() && teacher.dirty &&
            !confirm('This station has unsaved pin edits. Leave without saving?')) {
            sel.value = settings.scope;
            return;
        }
        settings.scope = sel.value;
        deckPos = 0;
        saveSettings();
        if (settings.mode === 'test')    { startTest(); return; }
        if (settings.mode === 'teacher') { startTeacher(); return; }
        buildDeck(false);
        document.getElementById('summary').style.display = 'none';
        loadQuestion();
    });

    const shuffle = document.getElementById('shuffle-toggle');
    shuffle.checked = !!settings.shuffle;
    shuffle.addEventListener('change', () => {
        settings.shuffle = shuffle.checked;
        deckPos = 0;
        saveSettings();
        if (settings.mode === 'test') { startTest(); return; }
        buildDeck(false);
        loadQuestion();
    });

    const mins = document.getElementById('minutes-select');
    mins.value = String(settings.minutes);
    mins.addEventListener('change', () => {
        settings.minutes = parseInt(mins.value, 10) || 2;
        saveSettings();
        if (settings.mode === 'test') startTest();
    });
}

function init() {
    loadState();
    loadKeys();
    setupScopeSelect();
    buildDeck(false);
    if (!settings.shuffle && settings.pos > 0 && settings.pos < deck.length) {
        deckPos = settings.pos;
    }
    const startMode = settings.mode;
    settings.mode = 'practice';   // so setDrillMode() sees a real change
    setupZoomPan();
    renderCredits();

    document.getElementById('answer-form').addEventListener('submit', submitAnswer);
    window.addEventListener('beforeunload', e => {
        if (isTeacher() && teacher.dirty) { e.preventDefault(); e.returnValue = ''; }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && q && (q.solved || q.revealed)) {
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag !== 'BUTTON' && tag !== 'SELECT') { e.preventDefault(); nextPin(); }
        }
    });

    setupTeacherDrag();
    if (startMode === 'test' || startMode === 'teacher') setDrillMode(startMode);
    else loadQuestion();
}

window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.zoomReset = zoomReset;
window.zoomToPin = zoomToPin;
window.giveHint = giveHint;
window.revealAnswer = revealAnswer;
window.nextPin = nextPin;
window.restartDeck = restartDeck;
window.clearProgress = clearProgress;
window.drillMissed = drillMissed;
window.setDrillMode = setDrillMode;
window.prevPin = prevPin;
window.finishStation = finishStation;
window.nextStation = nextStation;
window.startTest = startTest;
window.drillTestMisses = drillTestMisses;
window.saveTeacherKey = saveTeacherKey;
window.revertTeacherEdits = revertTeacherEdits;
window.restoreTeacherPreset = restoreTeacherPreset;

document.addEventListener('DOMContentLoaded', init);
