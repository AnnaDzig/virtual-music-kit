"use strict";

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

const app = el("div", "app");

app.setAttribute("tabindex", "-1")


 
const header = el("div", "header");
const title = el("div", "title", "Virtual Music Kit — Piano");

const meta = el("div", "meta");
if (typeof meta !== "undefined") {
  meta.setAttribute("role", "status");
  meta.setAttribute("aria-live", "polite");
  meta.setAttribute("aria-atomic", "true");
}

header.append(title, meta);

const board = el("div", "board");

const controls = el("div", "controls");
const controlsLeft = el("div", "controls__left");

const seqLabel = el("div", "label", "Sequence");

const seqGroup = el("div", "seq");

const seqInput = document.createElement("input");
seqInput.className = "input";
seqInput.type = "text";
seqInput.placeholder = "Example: ASDFG";

const playBtn = el("button", "btn", "Play sequence");

seqGroup.append(seqInput, playBtn);
controlsLeft.append(seqLabel, seqGroup);
controls.append(controlsLeft);

// Footer
const footer = el("div", "footer");
const footerNote = el("div", "footer__note", "© Virtual Music Kit");
footer.append(footerNote);

app.append(header, board, controls, footer);

document.body.appendChild(app);

// Sound model: notes, files, default key mapping
const SOUND_DEFS = Object.freeze([
  { id: "C4", file: "./assets/sounds/C4vL.wav" }, 
  { id: "D4", file: "./assets/sounds/D4vH.wav" },
  { id: "F4", file: "./assets/sounds/F4vH.wav" },
  { id: "A4", file: "./assets/sounds/A4vH.wav" },
  { id: "B4", file: "./assets/sounds/B4vH.wav" },
  { id: "C5", file: "./assets/sounds/C5vH.wav" },
  { id: "C6", file: "./assets/sounds/C6vH.wav" },
]);

const DEFAULT_KEYS = Object.freeze(["A", "S", "D", "F", "G", "H", "J"]);

function normalizeKey(key) {
  if (typeof key !== "string") return "";
  const k = key.trim().toUpperCase();
  return /^[A-Z]$/.test(k) ? k : "";
}
function getLetterFromEvent(e) {
  if (typeof e.code === "string" && /^Key[A-Z]$/.test(e.code)) {
    return e.code.slice(3);
  }
    return normalizeKey(e.key);
  }


function createAudio(src) {
  const audio = new Audio(src);
  audio.preload = "auto";     
  audio.crossOrigin = "anonymous"; 
  return audio;
}

const sounds = SOUND_DEFS.map((def, idx) => {
  const key = normalizeKey(DEFAULT_KEYS[idx]);
  return {
    id: def.id,
    file: def.file,
    key,
    audio: createAudio(def.file),
  };
});

function refreshMetaMapping() {
  const keysStr = sounds.map(s => s.key).join(" ");
  const notesStr = sounds.map(s => s.id).join(" ");
  if (typeof meta !== "undefined") {
    meta.textContent = `Keys: ${keysStr} → ${notesStr}`;
  }
}

function createKeyEl(sound) {
  // Root element for a playable key
  const keyEl = el("div", "key");
  keyEl.setAttribute("role", "button");   
  keyEl.setAttribute("tabindex", "0");    
  keyEl.dataset.note = sound.id;          
  keyEl.dataset.key = sound.key;  
  const noteEl = el("div", "key__note", sound.id); 
  const kbdEl  = el("div", "key__kbd",  sound.key); 

  const editBtn = el("button", "key__edit", "Edit");

  keyEl.append(noteEl, kbdEl, editBtn);
  return keyEl;
}

function updateKeyVisual(keyEl, newLetter) {
  keyEl.dataset.key = newLetter;
  const kbd = keyEl.querySelector(".key__kbd");
  if (kbd) kbd.textContent = newLetter;
}


board.textContent = "";
const frag = document.createDocumentFragment();
sounds.forEach((s) => {
  const keyEl = createKeyEl(s);
  frag.appendChild(keyEl);
});
board.appendChild(frag);

console.log("Rendered keys:", board.children.length);

// Mouse playback

function playOneShot(sound) {
  const a = sound.audio;
  try { a.currentTime = 0; } catch (_) {}
  a.play().catch(() => {});
}

const mousePressed = new WeakMap();

//  Bind mouse interactions for one key element.
function bindMouseForKey(keyEl, sound) {
  const onDown = () => {
    if (mousePressed.get(keyEl)) return; // already held → do nothing
    mousePressed.set(keyEl, true);
    keyEl.classList.add("is-active");
    playOneShot(sound);
  };

  const onUp = () => {
    mousePressed.set(keyEl, false);
    keyEl.classList.remove("is-active");
  };

  keyEl.addEventListener("mousedown", onDown);
  keyEl.addEventListener("mouseup", onUp);
  keyEl.addEventListener("mouseleave", onUp);
}

Array.from(board.querySelectorAll(".key")).forEach((keyEl, idx) => {
  const sound = sounds[idx];
  bindMouseForKey(keyEl, sound);
});

//Keyboard playback

const keyPressed = new Set()
function getSoundByKey(letter) {
  return sounds.find((s) => s.key === letter);
}

// Find the key DOM element by its dataset.key
function getKeyElement(letter) {
  return board.querySelector(`.key[data-key="${letter}"]`);
}

// Handle keyboard press
function handleKeyDown(e) {
   if (isPlayingSequence) return;
  const letter = getLetterFromEvent(e);
  if (!letter || keyPressed.has(letter)) return; // invalid or already pressed

  const sound = getSoundByKey(letter);
  if (!sound) return; // ignore keys not assigned to sounds

  keyPressed.add(letter);
  const keyEl = getKeyElement(letter);
  if (keyEl) keyEl.classList.add("is-active");
  playOneShot(sound);
}

// Handle keyboard release
function handleKeyUp(e) {
  const letter = getLetterFromEvent(e);
  if (!letter) return;
  keyPressed.delete(letter);
  const keyEl = getKeyElement(letter);
  if (keyEl) keyEl.classList.remove("is-active");
}

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);

// Sequence input validation 

function getAllowedLetters() {
  return new Set(sounds.map(s => s.key)); 
}

// Max length rule: twice the number of sounds
function getMaxSeqLength() {
  return sounds.length * 2;
}

function normalizeSequence(raw) {
  const allowed = getAllowedLetters();
  const maxLen = getMaxSeqLength();
  let out = "";

  for (const ch of String(raw)) {
    const k = normalizeKey(ch); 
    if (k && allowed.has(k)) {
      out += k;
      if (out.length >= maxLen) break; 
    }
  }
  return out;
}

function refreshSequenceRules() {
  seqInput.maxLength = getMaxSeqLength(); // still 2×sounds
}

function updatePlayUiState() {
  const hasContent = seqInput.value.length > 0;
  playBtn.disabled = !hasContent;
}
updatePlayUiState();

seqInput.addEventListener("input", () => {
  const filtered = normalizeSequence(seqInput.value);
  if (seqInput.value !== filtered) {
    const pos = seqInput.selectionStart; 
    seqInput.value = filtered;
    seqInput.setSelectionRange(Math.min(pos, filtered.length), Math.min(pos, filtered.length));
  }
  updatePlayUiState();
});

seqInput.addEventListener("beforeinput", (e) => {
  if (e.inputType !== "insertText") return;
  const allowed = getAllowedLetters();
  const k = normalizeKey(e.data);
  const willBe = (seqInput.value || "") + (k || "");
  if (!k || !allowed.has(k) || willBe.length > getMaxSeqLength()) {
    e.preventDefault();
  }
});

//  Global playback state
let isPlayingSequence = false;

const STEP_MS = 350; 
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setUiBusy(isBusy) {
  seqInput.disabled = isBusy;
  playBtn.disabled = isBusy || seqInput.value.length === 0;

  if (isBusy) {
    app.classList.add("is-busy");
  } else {
    app.classList.remove("is-busy");
  }
}

(function rebindMouseGuards() {
  Array.from(board.querySelectorAll(".key")).forEach((keyEl, idx) => {
    const sound = sounds[idx];
    const clone = keyEl.cloneNode(true);
    keyEl.replaceWith(clone);

    const onDown = () => {
      if (isPlayingSequence) return;
      if (mousePressed.get(clone)) return;
      mousePressed.set(clone, true);
      clone.classList.add("is-active");
      playOneShot(sound);
    };
    const onUp = () => {
      mousePressed.set(clone, false);
      clone.classList.remove("is-active");
    };
    clone.addEventListener("mousedown", onDown);
    clone.addEventListener("mouseup", onUp);
    clone.addEventListener("mouseleave", onUp);
  });
})();

async function playStep(letter) {
  const sound = getSoundByKey(letter);
  if (!sound) return;

  const keyEl = getKeyElement(letter);
  if (keyEl) keyEl.classList.add("is-active");

  try { sound.audio.currentTime = 0; } catch (_) {}
  await sound.audio.play().catch(() => {});

  await sleep(STEP_MS);

  try { sound.audio.pause(); } catch (_) {}
  try { sound.audio.currentTime = 0; } catch (_) {}

  if (keyEl) keyEl.classList.remove("is-active");
}

//  Sequence runner
async function playSequenceFromInput() {
  const seq = seqInput.value; 
  if (!seq || isPlayingSequence) return;

  isPlayingSequence = true;
  setUiBusy(true);

  try {
    for (const letter of seq) {
      await playStep(letter);
    }
  } finally {
    isPlayingSequence = false;
    setUiBusy(false);
  }
}

playBtn.addEventListener("click", (e) => {
  e.preventDefault();
  playSequenceFromInput();
});

// Editor bar (hidden by default). 
const editor = el("div", "editor");
const editorLabel = el("div", "editor__label", "Change key for:");
const editorInput = document.createElement("input");
editorInput.className = "editor__input";
editorInput.type = "text";
editorInput.placeholder = "Press a letter (A–Z), Enter to confirm";
editorInput.maxLength = 1;                 
editorInput.autocomplete = "off";         
editorInput.spellcheck = false;            
editorInput.inputMode = "text";            
const editorHint = el("div", "editor__hint", "Enter to confirm · Esc to cancel");
editor.append(editorLabel, editorInput, editorHint);
app.insertBefore(editor, board);

let editTarget = null; // { sound, keyEl } or null

function openEditor(sound, keyEl) {
  if (isPlayingSequence) return; 

  editTarget = { sound, keyEl };
  editorLabel.textContent = `Change key for: ${sound.id}`;
  editor.classList.remove("editor--error");
  editor.classList.add("is-open");
  editorInput.value = sound.key;
  editorInput.select();
  editorInput.focus();
}

function closeEditor() {
  editTarget = null;
  editor.classList.remove("is-open", "editor--error");
  editorInput.value = "";
  editorInput.blur();
  setTimeout(() => app.focus(), 0);
}

function isDuplicateKey(letter, excludeSound) {
  return sounds.some(s => s !== excludeSound && s.key === letter);
}

function pulseEditorError() {
  editor.classList.add("editor--error");
  // re-trigger animation if same class is already present
  const el = editorInput;
  el.style.animation = "none";
  el.offsetHeight;
  el.style.animation = null; 
}

function tryApplyNewKey() {
  if (!editTarget) return;
  const raw = editorInput.value;
  const normalized = normalizeKey(raw);

  if (!normalized || isDuplicateKey(normalized, editTarget.sound)) {
    pulseEditorError();          
    return;
  }

  editTarget.sound.key = normalized;
  updateKeyVisual(editTarget.keyEl, normalized);
  keyPressed.clear();
  refreshMetaMapping();
  refreshSequenceRules();
  closeEditor();
}

editorInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    tryApplyNewKey();
  } else if (e.key === "Escape") {
    e.preventDefault();
    closeEditor();
  } else {
    if (editor.classList.contains("editor--error")) {
      editor.classList.remove("editor--error");
    }
  }
});

editorInput.addEventListener("input", () => {
  if (editor.classList.contains("editor--error")) {
    editor.classList.remove("editor--error");
  }
  editorInput.value = editorInput.value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 1);
});

document.addEventListener("mousedown", (e) => {
  if (!editor.classList.contains("is-open")) return;
  const clickInside = editor.contains(e.target);
  const clickedEditBtn = e.target && e.target.classList && e.target.classList.contains("key__edit");
  if (!clickInside && !clickedEditBtn) {
    closeEditor();
  }
});
Array.from(board.querySelectorAll(".key")).forEach((keyEl, idx) => {
  const sound = sounds[idx];
  const editBtn = keyEl.querySelector(".key__edit");
  if (!editBtn) return;
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openEditor(sound, keyEl);
  });
});


function announceMappingChange(noteId, newKey) {
  if (typeof meta !== "undefined") {
    meta.textContent = `Key for ${noteId} changed to ${newKey}.`;
    setTimeout(() => refreshMetaMapping(), 10);
  }
}




