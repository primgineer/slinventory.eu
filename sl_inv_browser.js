
// ============================================================
// LLSD Binary Parser (JS port)
// ============================================================
class LLSDBinaryParser {
// Valid LLSD type marker bytes
static MARKERS = new Set([
  0x7B, // {  map
  0x5B, // [  array
  0x6B, // k  key
  0x75, // u  uuid
  0x73, // s  string
  0x69, // i  integer
  0x72, // r  real
  0x64, // d  date
  0x62, // b  binary
  0x6C, // l  uri
  0x31, // 1  true
  0x30, // 0  false
  0x21, // !  null/undef
]);

constructor(buf) {
  this.buf = new Uint8Array(buf);
  this.view = new DataView(buf);
  this.pos = 0;
  this._skipHeader();
}

_skipHeader() {
  // SL viewer prepends a 4-byte big-endian integer (version/format tag)
  // before the root LLSD value. Scan forward up to 16 bytes to find the
  // first valid LLSD type marker byte.
  let skipped = 0;
  while (this.pos < Math.min(16, this.buf.length)) {
    if (LLSDBinaryParser.MARKERS.has(this.buf[this.pos])) break;
    this.pos++;
    skipped++;
  }
  if (skipped > 0) console.log(`[LLSD] Skipped ${skipped} header byte(s), starting at offset ${this.pos}`);
}

parse() { return this.readValue(); }

readValue() {
  const m = String.fromCharCode(this.buf[this.pos++]);
  switch (m) {
    case '{': return this.readMap();
    case '[': return this.readArray();
    case 'u': return this.readUUID();
    case 's': return this.readString();
    case 'i': return this.readInt32();
    case 'r': return this.readDouble();
    case 'd': return this.readDate();
    case 'b': return this.readBinary();
    case 'l': return this.readURI();
    case '1': return true;
    case '0': return false;
    case '!': return null;
    default:
      throw new Error(`Unknown LLSD marker 0x${m.charCodeAt(0).toString(16)} at offset ${this.pos - 1}`);
  }
}

readMap() {
  const count = this.readUint32();
  const obj = {};
  for (let i = 0; i < count; i++) {
    const key = this.readKey();
    obj[key] = this.readValue();
  }
  // Consume closing '}' marker
  const closing = String.fromCharCode(this.buf[this.pos++]);
  if (closing !== '}') throw new Error(`Expected '}' to close map, got 0x${closing.charCodeAt(0).toString(16)} at offset ${this.pos - 1}`);
  return obj;
}

readArray() {
  const count = this.readUint32();
  const arr = [];
  for (let i = 0; i < count; i++) arr.push(this.readValue());
  // Consume closing ']' marker
  const closing = String.fromCharCode(this.buf[this.pos++]);
  if (closing !== ']') throw new Error(`Expected ']' to close array, got 0x${closing.charCodeAt(0).toString(16)} at offset ${this.pos - 1}`);
  return arr;
}

readKey() {
  const m = String.fromCharCode(this.buf[this.pos++]);
  if (m !== 'k') throw new Error(`Expected 'k' at ${this.pos - 1}, got ${m}`);
  const len = this.readUint32();
  const s = new TextDecoder().decode(this.buf.slice(this.pos, this.pos + len));
  this.pos += len;
  return s;
}

readUUID() {
  const b = this.buf.slice(this.pos, this.pos + 16); this.pos += 16;
  const h = (n, l) => Array.from(b.slice(n, n+l)).map(x => x.toString(16).padStart(2,'0')).join('');
  return `${h(0,4)}-${h(4,2)}-${h(6,2)}-${h(8,2)}-${h(10,6)}`;
}

readString() {
  const len = this.readUint32();
  const s = new TextDecoder().decode(this.buf.slice(this.pos, this.pos + len));
  this.pos += len;
  return s;
}

readInt32() {
  const v = this.view.getInt32(this.pos, false); this.pos += 4; return v;
}

readDouble() {
  const v = this.view.getFloat64(this.pos, false); this.pos += 8; return v;
}

readDate() {
  const v = this.view.getFloat64(this.pos, false); this.pos += 8;
  return v; // seconds since epoch
}

readBinary() {
  const len = this.readUint32();
  const raw = this.buf.slice(this.pos, this.pos + len); this.pos += len;
  // Return as base64 string
  return btoa(String.fromCharCode(...raw));
}

readURI() {
  const len = this.readUint32();
  const s = new TextDecoder().decode(this.buf.slice(this.pos, this.pos + len));
  this.pos += len;
  return s;
}

readUint32() {
  const v = this.view.getUint32(this.pos, false); this.pos += 4; return v;
}
}

// ============================================================
// Type tables
// ============================================================
// Asset type display names — from llassettype.h EType enum
const ASSET_TYPE = {
'-1':'Unknown',
0:'Texture', 1:'Sound', 2:'Calling Card', 3:'Landmark',
4:'Script', 5:'Clothing', 6:'Object', 7:'Notecard',
8:'Folder', 9:'Root Folder',
10:'LSL Text', 11:'LSL Bytecode', 12:'Texture (TGA)', 13:'Body Part',
17:'Sound (WAV)', 18:'Image (TGA)', 19:'Image (JPEG)',
20:'Animation', 21:'Gesture', 22:'Simstate',
24:'Link', 25:'Folder Link', 26:'Marketplace Folder',
49:'Mesh',
56:'Settings', 57:'Material', 58:'GLTF', 59:'GLTF Binary',
255:'Unknown',
};

const FOLDER_TYPE = {
'-1':'Folder', 0:'Textures', 1:'Sounds', 2:'Calling Cards', 3:'Landmarks',
5:'Clothing', 6:'Objects', 7:'Notecards', 8:'Folder', 9:'My Inventory',
10:'Scripts', 13:'Body Parts', 14:'Trash', 15:'Snapshots',
16:'Lost & Found', 20:'Animations', 21:'Gestures', 45:'Links',
46:'Folder Links', 49:'Meshes', 50:'Meshes', 56:'Settings', 57:'Materials',
};

// ============================================================
// Icon SVGs (inline, minimal)
// ============================================================
const ICONS = {
folder:       `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 4a1 1 0 0 1 1-1h4l1.5 1.5H14a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" fill="#4a9eff" opacity=".85"/></svg>`,
folder_open:  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 4a1 1 0 0 1 1-1h4l1.5 1.5H14a1 1 0 0 1 1 1v.5H2.5L1 8V4z" fill="#4a9eff" opacity=".6"/><path d="M.5 7.5l1.8 4.8A1 1 0 0 0 3.24 13h10.5a1 1 0 0 0 .95-.68L16.5 7.5H.5z" fill="#4a9eff" opacity=".9"/></svg>`,
texture:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" fill="#9b6dff" opacity=".2" stroke="#9b6dff" stroke-width="1.2"/><circle cx="5.5" cy="5.5" r="1.5" fill="#9b6dff"/><path d="M2 10l3-3 2.5 2.5L10 7l4 5H2z" fill="#9b6dff" opacity=".7"/></svg>`,
sound:        `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6h2l3-3v10l-3-3H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" fill="#e8a630" opacity=".85"/><path d="M11 5a4 4 0 0 1 0 6M12.5 3.5a6.5 6.5 0 0 1 0 9" stroke="#e8a630" stroke-width="1.2" stroke-linecap="round"/></svg>`,
object:       `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L14 5v6l-6 3.5L2 11V5l6-3.5z" fill="#3dba7f" opacity=".2" stroke="#3dba7f" stroke-width="1.2"/><path d="M8 1.5v11M2 5l6 3.5M14 5l-6 3.5" stroke="#3dba7f" stroke-width="1" opacity=".6"/></svg>`,
notecard:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="1" fill="#2dbdba" opacity=".15" stroke="#2dbdba" stroke-width="1.2"/><line x1="5.5" y1="5.5" x2="10.5" y2="5.5" stroke="#2dbdba" stroke-width="1" stroke-linecap="round"/><line x1="5.5" y1="7.5" x2="10.5" y2="7.5" stroke="#2dbdba" stroke-width="1" stroke-linecap="round" opacity=".6"/><line x1="5.5" y1="9.5" x2="8.5" y2="9.5" stroke="#2dbdba" stroke-width="1" stroke-linecap="round" opacity=".4"/></svg>`,
script:       `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2" width="11" height="12" rx="1" fill="#e85555" opacity=".1" stroke="#e85555" stroke-width="1.2"/><path d="M5 6l2 2-2 2M9 10h2" stroke="#e85555" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
landmark:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5C3.5 9.5 8 14.5 8 14.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5z" fill="#e85555" opacity=".2" stroke="#e85555" stroke-width="1.2"/><circle cx="8" cy="6" r="1.5" fill="#e85555" opacity=".8"/></svg>`,
clothing:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 2l-3 3 2 1v7h8V6l2-1-3-3-2 1.5L8 5.5 7 3.5 5 2z" fill="#4a9eff" opacity=".2" stroke="#4a9eff" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
bodypart:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="4.5" r="2" fill="#9b6dff" opacity=".8"/><path d="M4 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#9b6dff" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>`,
animation:    `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="3" r="1.5" fill="#e8a630" opacity=".8"/><path d="M5 5v4M5 9l-2 3M5 9l2 3M3 7h4" stroke="#e8a630" stroke-width="1.2" stroke-linecap="round"/><path d="M11 2l3 3-3 3M8 5h3" stroke="#e8a630" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/></svg>`,
gesture:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7 3.5V9M9 4.5V9M11 5.5V9M5 6.5V9M5 9c0 2.5 1.5 4.5 6 4.5S13 11 13 9" stroke="#3dba7f" stroke-width="1.2" stroke-linecap="round"/></svg>`,
mesh:         `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l5 3v6l-5 3-5-3V5l5-3z" fill="none" stroke="#2dbdba" stroke-width="1.2"/><path d="M3 5l5 3m0 0l5-3m-5 3v6" stroke="#2dbdba" stroke-width="1" opacity=".5"/></svg>`,
settings:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="#4a9eff" stroke-width="1.2"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1" stroke="#4a9eff" stroke-width="1.2" stroke-linecap="round" opacity=".6"/></svg>`,
material:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="5" width="9" height="9" rx="1" fill="#e8a630" opacity=".15" stroke="#e8a630" stroke-width="1.2"/><rect x="5" y="2" width="9" height="9" rx="1" fill="#e8a630" opacity=".08" stroke="#e8a630" stroke-width="1.2" stroke-dasharray="2 1.5"/><circle cx="6.5" cy="9.5" r="1.5" fill="#e8a630" opacity=".7"/></svg>`,
gltf:         `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12v8H2z" fill="#3dba7f" opacity=".08" stroke="#3dba7f" stroke-width="1.2" rx="1"/><text x="8" y="10.5" text-anchor="middle" font-family="monospace" font-size="6" fill="#3dba7f" font-weight="bold">glTF</text></svg>`,
trash:        `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.5 8h5l.5-8" stroke="#e85555" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/></svg>`,
calling_card: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1.5" fill="#9b6dff" opacity=".12" stroke="#9b6dff" stroke-width="1.2"/><circle cx="5.5" cy="7" r="1.2" fill="#9b6dff" opacity=".7"/><line x1="8" y1="6.5" x2="12" y2="6.5" stroke="#9b6dff" stroke-width="1" stroke-linecap="round" opacity=".5"/><line x1="8" y1="8.5" x2="10.5" y2="8.5" stroke="#9b6dff" stroke-width="1" stroke-linecap="round" opacity=".4"/></svg>`,
lost_found:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" fill="#e8a630" opacity=".1" stroke="#e8a630" stroke-width="1.2"/><text x="8" y="11.5" text-anchor="middle" font-family="monospace" font-size="8" fill="#e8a630" font-weight="bold">?</text></svg>`,
snapshot:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="9" rx="1.2" fill="none" stroke="#3dba7f" stroke-width="1.2"/><circle cx="8" cy="8.5" r="2" stroke="#3dba7f" stroke-width="1.2"/><path d="M5.5 4l.8-1.5h3.4L10.5 4" stroke="#3dba7f" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
heart:        `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13.5C8 13.5 2 9.5 2 5.5A3.5 3.5 0 0 1 8 4.2 3.5 3.5 0 0 1 14 5.5C14 9.5 8 13.5 8 13.5Z" fill="#e85585" opacity=".85" stroke="#e85585" stroke-width=".6" stroke-linejoin="round"/></svg>`,
link:         `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5a3 3 0 0 0 4.2.1l1.8-1.8a3 3 0 0 0-4.2-4.2L7.2 4.7" stroke="#4a9eff" stroke-width="1.3" stroke-linecap="round" opacity=".7"/><path d="M9.5 6.5a3 3 0 0 0-4.2-.1L3.5 8.2a3 3 0 0 0 4.2 4.2l1.1-1.1" stroke="#4a9eff" stroke-width="1.3" stroke-linecap="round"/></svg>`,
unknown:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="#5a6a80" stroke-width="1.2"/><text x="8" y="11" text-anchor="middle" font-family="monospace" font-size="8" fill="#5a6a80">?</text></svg>`,
};

// String preferred_type → icon key
// FIX: SL uses "animatn" as preferred_type for Animation folders.
// Map it to canonical "animation" so correct icon/behavior is applied.
const FOLDER_TYPE_STR_MAP = {
  'texture':'texture',     'textures':'texture',
  'sound':'sound',         'sounds':'sound',
  'calling_card':'calling_card', 'callcard':'calling_card',
  'landmark':'landmark',   'landmarks':'landmark',
  'clothing':'clothing',
  'object':'object',       'objects':'object',
  'notecard':'notecard',   'notecards':'notecard',
  'lsltext':'script',      'script':'script',      'scripts':'script',
  'bodypart':'bodypart',   'body_part':'bodypart',
  'trash':'trash',
  'snapshot':'snapshot',   'snapshots':'snapshot',
  'lstndfnd':'lost_found', 'lost_and_found':'lost_found',
  'animation':'animation', 'animations':'animation', 'animatn':'animation', 
  'gesture':'gesture',     'gestures':'gesture',
  'link':'link',
  'mesh':'mesh',           'meshes':'mesh',
  'settings':'settings',   'material':'material',   'gltf':'gltf',
  'inbox':'notecard',
  'favorite':'heart',   'favorites':'heart',
  'my_otfts':'clothing',   'current':'clothing',
};

function getIconForCategory(folderType) {
  // Handle string preferred_type (e.g. "texture", "clothing", "lsltext")
  if (typeof folderType === 'string' && isNaN(parseInt(folderType))) {
    const key = FOLDER_TYPE_STR_MAP[folderType.toLowerCase()];
    return ICONS[key || 'folder'];
  }
  const t = parseInt(folderType);
  const map = {
    0:'texture', 1:'sound', 2:'calling_card', 3:'landmark',
    5:'clothing', 6:'object', 7:'notecard', 10:'script',
    13:'bodypart', 14:'trash', 15:'snapshot', 16:'lost_found',
    20:'animation', 21:'gesture', 45:'link', 46:'link',
    49:'mesh', 56:'settings', 57:'material', 58:'gltf', 59:'gltf',
  };
  return ICONS[map[t] || 'folder'];
}

// getIconForItem now accepts a canonical _typeKey string (resolved at index time).
// No more raw field parsing needed here.
function getIconForItem(typeKey) {
  return ICONS[typeKey] || ICONS.unknown;
}

function getFolderTypeName(ft) {
return FOLDER_TYPE[ft] || FOLDER_TYPE[-1];
}

function getAssetTypeName(at) {
return ASSET_TYPE[at] || `Type ${at}`;
}

// Human-readable display name from a canonical _typeKey.
const TYPE_KEY_NAMES = {
  texture:'Texture', sound:'Sound', calling_card:'Calling Card',
  landmark:'Landmark', clothing:'Clothing', object:'Object',
  notecard:'Notecard', script:'Script', bodypart:'Body Part',
  trash:'Trash', snapshot:'Snapshot', lost_found:'Lost & Found',
  animation:'Animation', gesture:'Gesture', link:'Link',
  mesh:'Mesh', settings:'Settings', material:'Material', gltf:'GLTF',
  folder:'Folder', unknown:'Unknown',
};
function getTypeKeyName(typeKey) {
  return TYPE_KEY_NAMES[typeKey] || typeKey || 'Unknown';
}

// ============================================================
// Inventory data model
// ============================================================
let invData = null;         // raw parsed JSON {categories:[], items:[]}
let catMap = {};            // cat_id → category obj
let catChildren = {};       // cat_id → [cat_id,...]
let catItems = {};          // cat_id → [item obj,...]
let rootCatId = null;
let currentCatId = null;
let selectedItem = null;
let selectedIsFolder = false;
let selectedIndex = -1;      // index into getSortedContents() for keyboard nav
let navStack = [];          // breadcrumb stack [{id,name}]
let sortKey = 'name';
let sortAsc = true;
let searchQuery = '';
let expandedNodes = new Set();
// DEFAULT_VIEW: change 'icons' to 'list' to flip the default
const DEFAULT_VIEW = 'icons';
let viewMode = DEFAULT_VIEW;
let iconSize = 100;
// activeTypeFilter: Set of canonical type keys (strings like 'texture','sound',…,'folder')
// Empty set = no filter = show all
let activeTypeFilter = new Set();
let regexMode = false;  // toggled by the .* button

// Cached matcher — rebuilt only when searchQuery or regexMode changes
let _matcherCache = { query: null, mode: null, fn: null };
function getCachedMatcher() {
  if (_matcherCache.query !== searchQuery || _matcherCache.mode !== regexMode) {
    _matcherCache = { query: searchQuery, mode: regexMode, fn: buildMatcher(searchQuery) };
  }
  return _matcherCache.fn;
}

// Search result cache — invalidated whenever anything that affects results changes.
// Key encodes query + regexMode + sortKey + sortAsc + active type filters.
let _searchCache = { key: null, result: null };
let _searchDebounceTimer = null;
function _searchCacheKey() {
  return searchQuery + '|' + regexMode + '|' + sortKey + '|' + sortAsc + '|' + [...activeTypeFilter].sort().join(',');
}

// Memoization cache for countDescendantItems — invalidated on buildIndex()
let _descendantCountCache = {};

// Flat search index — built once in buildIndex(), avoids re-iterating catMap/catItems on every keystroke.
// Each entry stores only what the matcher needs (nameLower) plus a ref to the original object.
let _searchFolders = []; // [{id, nameLower}]
let _searchItems   = []; // [{item, nameLower}]

// Thumbnail cache: assetId → 'loading' | 'ok' | 'error'
const thumbCache = {};

function applyIconSize(sz) {
iconSize = sz;
// Drive all size-dependent layout via one CSS variable on the grid
document.documentElement.style.setProperty('--icon-sz', sz + 'px');
// folder-icon-wrap and thumb-box scale with it
const ratio = 0.8; // height:width ratio for folder shape
document.documentElement.style.setProperty('--icon-sz-h', Math.round(sz * ratio) + 'px');
}

function buildIndex(data) {
catMap = {}; catChildren = {}; catItems = {};
rootCatId = null;
_descendantCountCache = {};

for (const cat of (data.categories || [])) {
  const id = cat.cat_id || cat.category_id || cat.id;
  if (!id) continue;
  cat._id = id;
  catMap[id] = cat;
  catChildren[id] = [];
  catItems[id] = [];
}

for (const cat of (data.categories || [])) {
  const id = cat._id;
  const pid = cat.parent_id;
  if (!pid || pid === '00000000-0000-0000-0000-000000000000' || !catMap[pid]) {
    if (!rootCatId) rootCatId = id;
  } else {
    (catChildren[pid] = catChildren[pid] || []).push(id);
  }
}

for (const item of (data.items || [])) {
  item._typeKey = resolveTypeKey(item); // canonical, resolved once
  const pid = item.parent_id;
  if (pid && catItems[pid]) catItems[pid].push(item);
}

// Sort children alphabetically by name
for (const id in catChildren) {
  catChildren[id].sort((a, b) => {
    const na = (catMap[a]?.name || '').toLowerCase();
    const nb = (catMap[b]?.name || '').toLowerCase();
    return na < nb ? -1 : na > nb ? 1 : 0;
  });
}

// Build flat search index — one pass, done once
_searchFolders = Object.keys(catMap).map(id => ({ id, nameLower: (catMap[id].name || '').toLowerCase() }));
_searchItems   = [];
for (const items of Object.values(catItems)) {
  for (const item of items) {
    _searchItems.push({ item, nameLower: (item.name || '').toLowerCase() });
  }
}
}

function countDescendantItems(catId) {
if (_descendantCountCache[catId] !== undefined) return _descendantCountCache[catId];
let count = (catItems[catId] || []).length;
for (const cid of (catChildren[catId] || []))
  count += countDescendantItems(cid);
_descendantCountCache[catId] = count;
return count;
}

// ============================================================
// Tree rendering
// ============================================================
function renderTree() {
const scroll = document.getElementById('tree-scroll');
scroll.innerHTML = '';
if (!rootCatId) return;

const frag = document.createDocumentFragment();
renderTreeNode(rootCatId, frag, 0);
scroll.appendChild(frag);

const total = Object.keys(catMap).length;
document.getElementById('tree-count').textContent = total.toLocaleString() + ' folders';
}

function renderTreeNode(catId, parent, depth) {
const cat = catMap[catId];
if (!cat) return;

const children = catChildren[catId] || [];
const hasChildren = children.length > 0;
const isExpanded = expandedNodes.has(catId);
const isSelected = catId === currentCatId;
const ft = cat.preferred_type ?? cat.type_default ?? -1;

const node = document.createElement('div');
node.className = 'tree-node';

const row = document.createElement('div');
row.className = 'tree-node-row' + (isSelected ? ' selected' : '');
row.style.paddingLeft = (4 + depth * 14) + 'px';

const expander = document.createElement('div');
expander.className = 'tree-expand';
expander.innerHTML = hasChildren ? (isExpanded ? '▾' : '▸') : '';
expander.addEventListener('click', e => { e.stopPropagation(); toggleExpand(catId); });

const icon = document.createElement('div');
icon.className = 'icon';
const typedIcon = getIconForCategory(ft);
icon.innerHTML = (isExpanded && typedIcon === ICONS.folder) ? ICONS.folder_open : typedIcon;

const label = document.createElement('div');
label.className = 'tree-node-label';
label.textContent = cat.name || '(unnamed)';

const cnt = document.createElement('div');
cnt.className = 'tree-node-count';
const childCount = children.length + (catItems[catId]||[]).length;
if (childCount > 0) cnt.textContent = childCount;

row.append(expander, icon, label, cnt);
row.addEventListener('click', () => navigateTo(catId));
row.addEventListener('dblclick', () => { toggleExpand(catId); navigateTo(catId); });
node.appendChild(row);

if (isExpanded && hasChildren) {
  const childContainer = document.createElement('div');
  childContainer.className = 'tree-children';
  for (const cid of children) renderTreeNode(cid, childContainer, depth + 1);
  node.appendChild(childContainer);
}

parent.appendChild(node);
}

function toggleExpand(catId) {
if (expandedNodes.has(catId)) expandedNodes.delete(catId);
else expandedNodes.add(catId);
renderTree();
}

// ============================================================
// Detail panel (content list)
// ============================================================
function navigateTo(catId, pushHistory = true) {
const cat = catMap[catId];
if (!cat) return;
currentCatId = catId;
selectedItem = null;
selectedIsFolder = false;
selectedIndex = -1;

// Always clear search when navigating into a folder so the contents are visible
if (searchQuery) {
  searchQuery = '';
  _searchCache = { key: null, result: null };
  clearTimeout(_searchDebounceTimer);
  const searchEl = document.getElementById('search');
  if (searchEl) searchEl.value = '';
  document.getElementById('status-filter').textContent = '';
}

if (pushHistory) {
  navStack = buildBreadcrumb(catId);
}

renderTree();
renderBreadcrumb();
renderContentList();
updateDetailSide(null);
updateStatus();

setTimeout(() => {
  const sel = document.querySelector('.tree-node-row.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}, 0);
}

function buildBreadcrumb(catId) {
const stack = [];
let id = catId;
while (id && catMap[id]) {
  stack.unshift({ id, name: catMap[id].name || '(unnamed)' });
  const pid = catMap[id].parent_id;
  if (!pid || pid === '00000000-0000-0000-0000-000000000000' || !catMap[pid]) break;
  id = pid;
}
return stack;
}

// Breadcrumb collapse menu — single element reused across renders to avoid leaking
// a new <div> and dismiss listener on every navigation.
let _bcExpandMenu = null;
let _bcExpandMenuDismiss = null;
function getBcExpandMenu() {
  if (!_bcExpandMenu) {
    _bcExpandMenu = document.createElement('div');
    _bcExpandMenu.className = 'bc-expand-menu hidden';
    document.body.appendChild(_bcExpandMenu);
  }
  return _bcExpandMenu;
}

function renderBreadcrumb() {
const bc = document.getElementById('breadcrumb');
bc.innerHTML = '';
if (!navStack.length) return;

const MAX_VISIBLE = 7; // show at most this many segments before collapsing
const stack = navStack;
const last = stack.length - 1;

// Determine which indices to show
let indices;
if (stack.length <= MAX_VISIBLE + 1) {
  indices = stack.map((_, i) => i);
} else {
  // Always show first, last two, collapse the middle
  indices = null; // signal to use collapsed mode
}

if (indices) {
  // All fit — render normally
  indices.forEach(i => {
    if (i > 0) { const s = document.createElement('span'); s.className='bc-sep'; s.textContent='›'; bc.appendChild(s); }
    const el = document.createElement('span');
    el.className = 'bc-item' + (i === last ? ' current' : '');
    el.textContent = stack[i].name;
    if (i < last) el.addEventListener('click', () => navigateTo(stack[i].id));
    bc.appendChild(el);
  });
} else {
  // Collapsed: first › ›› › second-to-last › last
  const renderItem = (i) => {
    const el = document.createElement('span');
    el.className = 'bc-item' + (i === last ? ' current' : '');
    el.textContent = stack[i].name;
    if (i < last) el.addEventListener('click', () => navigateTo(stack[i].id));
    return el;
  };
  const sep = () => { const s = document.createElement('span'); s.className='bc-sep'; s.textContent='›'; return s; };

  bc.appendChild(renderItem(0));
  bc.appendChild(sep());

  // Collapsed middle button — shows dropdown of hidden path segments
  const collapse = document.createElement('span');
  collapse.className = 'bc-collapse';
  collapse.textContent = '••••';
  const hiddenPath = stack.slice(1, last - 1).map(s => s.name).join(' › ');
  collapse.title = hiddenPath;

  const expandMenu = getBcExpandMenu();
  expandMenu.innerHTML = '';
  expandMenu.classList.add('hidden');
  if (_bcExpandMenuDismiss) {
    document.removeEventListener('click', _bcExpandMenuDismiss, { capture: true });
  }
  stack.slice(1, last).forEach((item) => {
    const opt = document.createElement('div');
    opt.className = 'bc-expand-opt';
    opt.textContent = item.name;
    opt.addEventListener('click', e => { e.stopPropagation(); expandMenu.classList.add('hidden'); navigateTo(item.id); });
    expandMenu.appendChild(opt);
  });
  collapse.addEventListener('click', e => {
    e.stopPropagation();
    const r = collapse.getBoundingClientRect();
    expandMenu.style.top  = (r.bottom + 4) + 'px';
    expandMenu.style.left = r.left + 'px';
    expandMenu.classList.toggle('hidden');
  });
  _bcExpandMenuDismiss = () => expandMenu.classList.add('hidden');
  document.addEventListener('click', _bcExpandMenuDismiss, { capture: true });
  bc.appendChild(collapse);

  bc.appendChild(sep());
  bc.appendChild(renderItem(last - 1));
  bc.appendChild(sep());
  bc.appendChild(renderItem(last));
}
}

// ============================================================
// Canonical item type resolution
// ============================================================
// ── Inventory type → canonical key (inv_type field) ──────────
// SL uses two independent type systems. This map covers the inv_type field
// which is what distinguishes texture vs snapshot, script vs lsl_bytecode, etc.
const INV_TYPE_MAP = {
  // String values (JSON exports)
  'texture':'texture',       'snapshot':'snapshot',
  'sound':'sound',           'object':'object',
  'notecard':'notecard',     'script':'script',       'lsltext':'script',
  'landmark':'landmark',     'clothing':'clothing',   'wearable':'clothing',
  'bodypart':'bodypart',     'body_part':'bodypart',
  'animation':'animation',   'animatn':'animation',
  'gesture':'gesture',
  'calling_card':'calling_card', 'callcard':'calling_card',
  'link':'link',             'link_folder':'link',
  'mesh':'mesh',
  'settings':'settings',     'material':'material',
  'gltf':'gltf',             'gltf_bin':'gltf',
  'lost_and_found':'lost_found',
  // Integer values (binary LLSD — LLInventoryType enum, separate from asset types)
  '0':'texture',   '1':'sound',     '2':'calling_card', '3':'landmark',
  '5':'object',    '6':'notecard',  '9':'script',       '10':'clothing',
  '13':'animation','14':'gesture',  '15':'snapshot',    '17':'bodypart',
  '18':'mesh',     '25':'settings', '26':'material',
};

// ── Asset type → canonical key (type field) ───────────────────
// Fallback when inv_type is absent (older binary LLSD, partial data).
// Does NOT distinguish texture vs snapshot — use inv_type for that.
// Integer codes from llassettype.h EType enum.
const ASSET_TYPE_MAP = {
  // String values (JSON exports)
  'texture':'texture',  'image_tga':'texture', 'image_jpeg':'texture', 'texture_tga':'texture',
  'sound':'sound',
  'calling_card':'calling_card', 'callcard':'calling_card',
  'landmark':'landmark',
  'clothing':'clothing',
  'object':'object',
  'notecard':'notecard',
  'lsl_text':'script',  'lsltext':'script',  'lsl_bytecode':'script',
  'bodypart':'bodypart','body_part':'bodypart',
  'animatn':'animation','animation':'animation',
  'gesture':'gesture',
  'link':'link',        'link_folder':'link',
  'mesh':'mesh',
  'settings':'settings','material':'material',
  'gltf':'gltf',        'gltf_bin':'gltf',
  // Integer values — llassettype.h EType
  '0':'texture',   '1':'sound',    '2':'calling_card', '3':'landmark',
  '4':'script',    '5':'clothing', '6':'object',       '7':'notecard',
  '10':'script',   '11':'script',  '12':'texture',
  '13':'bodypart', '17':'sound',
  '18':'texture',  '19':'texture',
  '20':'animation','21':'gesture', '22':'unknown',
  '24':'link',     '25':'link',    '26':'unknown',
  '49':'mesh',
  '56':'settings', '57':'material','58':'gltf',        '59':'gltf',
};

function resolveTypeKey(item) {
  // inv_type is authoritative — it distinguishes texture vs snapshot, etc.
  if (item.inv_type != null) {
    const k = INV_TYPE_MAP[String(item.inv_type).toLowerCase()];
    if (k) return k;
  }
  // Fallback to asset type when inv_type is absent (binary LLSD without inv_type)
  if (item.type != null) {
    const k = ASSET_TYPE_MAP[String(item.type).toLowerCase()];
    if (k) return k;
  }
  return 'unknown';
}

// Canonical type key for an item — resolved once at index time, read here.
function itemTypeKey(item) {
  return item._typeKey || 'unknown';
}

function passesTypeFilter(entry) {
if (activeTypeFilter.size === 0) return true;
if (entry._isFolder) return activeTypeFilter.has('folder');
return activeTypeFilter.has(itemTypeKey(entry));
}

function getSortedContents(catId) {
// In browse mode (no search) the result depends on catId — don't cache across folders.
// In search mode the result is global and expensive — cache it.
if (searchQuery) {
  const cacheKey = _searchCacheKey();
  if (_searchCache.key === cacheKey) return _searchCache.result;
}

const matcher = getCachedMatcher();

let folders, its;

if (searchQuery) {
  // Use pre-built flat index — avoids Object.entries/Object.values on every keystroke
  const matchedFolderIds = new Set();
  const matchedItems = [];
  for (const { id, nameLower } of _searchFolders) {
    if (matcher(nameLower)) matchedFolderIds.add(id);
  }
  for (const { item, nameLower } of _searchItems) {
    if (matcher(nameLower)) matchedItems.push(item);
  }
  folders = [...matchedFolderIds].map(id => ({ _isFolder: true, _id: id, ...catMap[id] }));
  its = matchedItems;
} else {
  folders = (catChildren[catId] || []).map(id => ({ _isFolder: true, _id: id, ...catMap[id] }));
  its = catItems[catId] || [];
}

// Apply type filter
if (activeTypeFilter.size > 0) {
  folders = folders.filter(passesTypeFilter);
  its     = its.filter(passesTypeFilter);
}

// Early exit — skip sort allocation if nothing matched
if (folders.length === 0 && its.length === 0) {
  if (searchQuery) _searchCache = { key: _searchCacheKey(), result: [] };
  return [];
}

const sortFn = (a, b) => {
  let va, vb;
  if (sortKey === 'name') { va = (a.name||'').toLowerCase(); vb = (b.name||'').toLowerCase(); }
  else if (sortKey === 'type') {
    va = a._isFolder ? 'folder' : getTypeKeyName(a._typeKey || 'unknown');
    vb = b._isFolder ? 'folder' : getTypeKeyName(b._typeKey || 'unknown');
  }
  else if (sortKey === 'date') {
    va = a.creation_date || 0;
    vb = b.creation_date || 0;
  }
  else if (sortKey === 'count') {
    va = a._isFolder ? countDescendantItems(a._id) : 0;
    vb = b._isFolder ? countDescendantItems(b._id) : 0;
  }
  if (va < vb) return sortAsc ? -1 : 1;
  if (va > vb) return sortAsc ? 1 : -1;
  return 0;
};

folders.sort(sortFn);
its.sort(sortFn);
const result = [...folders, ...its];

if (searchQuery) _searchCache = { key: _searchCacheKey(), result: result };
return result;
}

// ============================================================
// Search matching
// ============================================================
function buildMatcher(raw) {
if (!raw) return () => true;

// Regex mode (enabled by .* toggle button)
if (regexMode) {
  try {
    const re = new RegExp(raw, 'i');
    return name => re.test(name);
  } catch {
    // Invalid regex — fall back to plain substring so nothing breaks
    const q = raw.toLowerCase();
    return name => name.toLowerCase().includes(q);
  }
}

// Multi-word AND mode: terms separated by +
if (raw.includes('+')) {
  const terms = raw.split('+').map(t => t.trim().toLowerCase()).filter(Boolean);
  return name => {
    const lower = name.toLowerCase();
    return terms.every(t => lower.includes(t));
  };
}

// Plain substring (case-insensitive)
const q = raw.toLowerCase();
return name => name.toLowerCase().includes(q);
}

function highlightMatch(text, raw) {
if (!raw) return escHtml(text);

if (regexMode) {
  try {
    const re = new RegExp(raw, 'gi');
    // Run on raw text first, then escape each segment to avoid matching HTML entities
    let result = '';
    let last = 0;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      result += escHtml(text.slice(last, m.index));
      result += `<span class="hl">${escHtml(m[0])}</span>`;
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    result += escHtml(text.slice(last));
    return result;
  } catch { return escHtml(text); }
}

// Multi-word AND: highlight each term separately
// FIX: Multi-term (+) highlighting was corrupting HTML.
// Previous implementation ran successive .replace() calls on already-generated HTML,
// causing matches inside <span> tags (e.g. matching "s" in "<span>").
// This resulted in broken markup like "<span class="hl">gunspan>".
//
// Solution: Build a single combined regex and process the original text once,
// inserting highlights without ever modifying existing HTML.
/*
if (raw.includes('+')) {
  const terms = raw.split('+').map(t => t.trim()).filter(Boolean);
  let result = escHtml(text);
  for (const term of terms) {
    if (!term) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), m => `<span class="hl">${m}</span>`);
  }
  return result;
}
*/
if (raw.includes('+')) {
  const terms = raw.split('+').map(t => t.trim()).filter(Boolean);
  if (terms.length === 0) return escHtml(text);

  const pattern = terms
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const re = new RegExp(pattern, 'gi');

  let result = '';
  let last = 0;
  let m;

  while ((m = re.exec(text)) !== null) {
    result += escHtml(text.slice(last, m.index));
    result += `<span class="hl">${escHtml(m[0])}</span>`;
    last = m.index + m[0].length;

    if (m[0].length === 0) re.lastIndex++;
  }

  result += escHtml(text.slice(last));
  return result;
}

// Plain substring highlight
const q = raw.toLowerCase();
const t = text.toLowerCase();
const idx = t.indexOf(q);
if (idx === -1) return escHtml(text);
return escHtml(text.slice(0, idx))
  + `<span class="hl">${escHtml(text.slice(idx, idx + raw.length))}</span>`
  + escHtml(text.slice(idx + raw.length));
}

function escHtml(s) {
return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildEmptyState() {
  const hasSearch = searchQuery.length > 0;
  const hasFilter = activeTypeFilter.size > 0;
  // Check if there IS content before filtering — to distinguish "truly empty" from "filtered out"
  const rawFolders = catChildren[currentCatId] || [];
  const rawItems   = catItems[currentCatId] || [];
  const hasSomeContent = rawFolders.length > 0 || rawItems.length > 0;

  if (hasSearch && hasFilter)
    return `<div class="empty-state"><div class="es-icon">🔍</div><div class="es-text">No results for <strong>"${escHtml(searchQuery)}"</strong><br><span style="font-size:11px;opacity:.7">Try clearing the type filter</span></div></div>`;
  if (hasSearch)
    return `<div class="empty-state"><div class="es-icon">🔍</div><div class="es-text">No results for <strong>"${escHtml(searchQuery)}"</strong></div></div>`;
  if (hasFilter && hasSomeContent)
    return `<div class="empty-state"><div class="es-icon">📭</div><div class="es-text">No items match the active filter</div></div>`;
  return `<div class="empty-state"><div class="es-icon">📭</div><div class="es-text">This folder is empty</div></div>`;
}

function renderContentList() {
const list = document.getElementById('content-list');
const colHeader = document.getElementById('col-header');
if (!currentCatId) return;

// Disconnect observer from previous view's cells before replacing DOM
thumbObserver.disconnect();

const contents = getSortedContents(currentCatId);

if (viewMode === 'icons') {
  colHeader.style.display = 'none';
  list.innerHTML = '';
  if (contents.length === 0) { list.innerHTML = buildEmptyState(); return; }
  renderIconGrid(list, contents);
} else {
  colHeader.style.display = '';
  list.innerHTML = '';
  if (contents.length === 0) { list.innerHTML = buildEmptyState(); return; }
  renderListRows(list, contents);
}
}

function renderListRows(list, contents) {
const frag = document.createDocumentFragment();
for (const entry of contents) {
  const row = document.createElement('div');
  row.className = 'list-row' + (isSelectedEntry(entry) ? ' selected' : '');

  const ft = entry.preferred_type ?? entry.type_default ?? -1;
  const tk = entry._typeKey || 'unknown';
  const iconSvg = entry._isFolder ? getIconForCategory(ft) : getIconForItem(tk);
  const typeName = entry._isFolder ? getFolderTypeName(ft) : getTypeKeyName(tk);
  const date = entry.creation_date ? formatDate(entry.creation_date) : '—';
  const countVal = entry._isFolder
    ? (() => { const c = countDescendantItems(entry._id); return c > 0 ? c.toLocaleString() : ''; })()
    : '';

  row.innerHTML = `
    <div class="name-cell">
      <div class="icon">${iconSvg}</div>
      <span>${highlightMatch(entry.name || '(unnamed)', searchQuery)}</span>
    </div>
    <div class="type-cell">${escHtml(typeName)}</div>
    <div class="date-cell">${date}</div>
    <div class="count-cell">${countVal}</div>
  `;

  row.addEventListener('mousedown', () => {
    const prev = list.querySelector('.list-row.selected');
    if (prev && prev !== row) prev.classList.remove('selected');
    row.classList.add('selected');
    selectedItem = entry;
    selectedIsFolder = !!entry._isFolder;
    const contents = getSortedContents(currentCatId);
    selectedIndex = contents.findIndex(e => isSelectedEntry(e));
    updateDetailSide(entry);
    updateStatus();
  });
  row.addEventListener('dblclick', () => { if (entry._isFolder) navigateTo(entry._id); });
  frag.appendChild(row);
}
list.appendChild(frag);

}

// ── Texture detection ──────────────────────────────────────────
// Uses _typeKey stamped at index time — single source of truth.
// Snapshots are included: they are stored as texture assets and the
// picture-service URL works for them when an asset_id is available.
function isTextureType(itemOrKey) {
  // Accept either a full item object or a bare _typeKey string
  const key = (typeof itemOrKey === 'string') ? itemOrKey : (itemOrKey?._typeKey);
  return key === 'texture' || key === 'snapshot';
}

function itemHasAssetId(item) {
// asset_id present and not null-uuid
const id = item.asset_id;
return id && id !== '00000000-0000-0000-0000-000000000000';
}

// Priority for folder thumbnail:
// 1. folder.thumbnail.asset_id  (explicit thumbnail set by user in viewer)
// 2. first texture item found recursively inside
function getFolderThumbAssetId(catId) {
const cat = catMap[catId];
if (cat?.thumbnail?.asset_id && cat.thumbnail.asset_id !== '00000000-0000-0000-0000-000000000000') {
  return cat.thumbnail.asset_id;
}
return getFirstTextureInFolder(catId);
}

function getFirstTextureInFolder(catId) {
for (const item of (catItems[catId] || [])) {
  if (isTextureType(item) && itemHasAssetId(item)) return item.asset_id;
}
for (const cid of (catChildren[catId] || [])) {
  const found = getFirstTextureInFolder(cid);
  if (found) return found;
}
return null;
}

// Lightbox state — tracks the list of textures in the current view for prev/next
let lbTextureList  = [];  // [{assetId, name}, ...]
let lbCurrentIndex = -1;

function buildLightboxList() {
  // Build ordered list of texture items from current view contents
  const contents = getSortedContents(currentCatId);
  lbTextureList = contents
    .filter(e => !e._isFolder && isTextureType(e) && itemHasAssetId(e))
    .map(e => ({ assetId: e.asset_id, name: e.name || '' }));
}

function openLightbox(assetId, name) {
  buildLightboxList();
  lbCurrentIndex = lbTextureList.findIndex(t => t.assetId === assetId);
  // If not found in list (e.g. opened from detail pane), add it temporarily
  if (lbCurrentIndex === -1) {
    lbTextureList = [{ assetId, name }];
    lbCurrentIndex = 0;
  }
  renderLightbox();
  document.getElementById('lightbox').classList.remove('hidden');
}

function renderLightbox() {
  const entry = lbTextureList[lbCurrentIndex];
  if (!entry) return;
  const img   = document.getElementById('lightbox-img');
  const label = document.getElementById('lightbox-name');
  img.src = thumbUrl(entry.assetId).replace('256x192', '512x512');
  img.onerror = () => { img.src = thumbUrl(entry.assetId); img.onerror = null; };
  label.textContent = entry.name || '';
  // Show/hide nav arrows
  const hasPrev = lbCurrentIndex > 0;
  const hasNext = lbCurrentIndex < lbTextureList.length - 1;
  document.getElementById('lb-prev').style.display = hasPrev ? 'flex' : 'none';
  document.getElementById('lb-next').style.display = hasNext ? 'flex' : 'none';
  // Counter
  const counter = document.getElementById('lb-counter');
  if (counter && lbTextureList.length > 1)
    counter.textContent = `${lbCurrentIndex + 1} / ${lbTextureList.length}`;
  else if (counter) counter.textContent = '';
}

function lbNavigate(dir) {
  const next = lbCurrentIndex + dir;
  if (next < 0 || next >= lbTextureList.length) return;
  lbCurrentIndex = next;
  renderLightbox();
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightbox-img').src = '';
  lbTextureList  = [];
  lbCurrentIndex = -1;
}

function thumbUrl(assetId) {
return `https://picture-service.secondlife.com/${assetId}/256x192.jpg`;
}

// ── IntersectionObserver lazy loader ──────────────────────────
// One shared observer for all thumb cells. When a cell scrolls into
// view, the observer reads data attributes and triggers the load.

// Shared load logic — called from both the observer callback and the cache-hit path.
function applyThumb(el, assetId, type) {
  if (type === 'texture') {
    const img      = el.querySelector('img');
    const spinWrap = el.querySelector('.thumb-icon');
    if (!img) return;
    img.src = thumbUrl(assetId);
    img.addEventListener('load', () => {
      img.classList.add('loaded');
      el.classList.add('img-loaded');
      thumbCache[assetId] = 'ok';
      if (spinWrap) spinWrap.style.display = 'none';
    }, { once: true });
    img.addEventListener('error', () => {
      thumbCache[assetId] = 'error';
      img.style.display = 'none';
      if (spinWrap) spinWrap.style.display = 'none';
    }, { once: true });
  } else if (type === 'folder') {
    const svgImg = el.querySelector('image');
    if (!svgImg) return;
    const url = thumbUrl(assetId);
    const testImg = new Image();
    testImg.onload = () => {
      svgImg.setAttribute('href', url);
      svgImg.style.opacity = '1';
      thumbCache[assetId] = 'ok';
    };
    testImg.onerror = () => { thumbCache[assetId] = 'error'; };
    testImg.src = url;
  }
}

const thumbObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target;
    thumbObserver.unobserve(el);
    const assetId = el.dataset.lazyAsset;
    const type    = el.dataset.lazyType;
    if (!assetId) continue;
    applyThumb(el, assetId, type);
  }
}, {
  rootMargin: '200px 0px',
  threshold: 0,
});

function observeThumb(el, assetId, type) {
  if (!assetId) return;
  el.dataset.lazyAsset = assetId;
  el.dataset.lazyType  = type;
  if (thumbCache[assetId] === 'ok') {
    // Already cached — apply immediately in a microtask so el is in the DOM
    Promise.resolve().then(() => applyThumb(el, assetId, type));
    return;
  }
  thumbObserver.observe(el);
}

// Keep loadThumb for lightbox (immediate, non-lazy)
function loadThumb(imgEl, assetId, onLoad) {
if (!assetId) return;
imgEl.src = thumbUrl(assetId);
imgEl.addEventListener('load', () => {
  imgEl.classList.add('loaded');
  thumbCache[assetId] = 'ok';
  if (onLoad) onLoad();
}, { once: true });
imgEl.addEventListener('error', () => {
  thumbCache[assetId] = 'error';
  imgEl.style.display = 'none';
}, { once: true });
}

// ── Folder SVG shape used as visual container for thumbnails ───
function buildFolderThumbCell(entry) {
const wrap = document.createElement('div');
wrap.className = 'folder-icon-wrap';

const ft = entry.preferred_type ?? entry.type_default ?? -1;
const thumbAssetId = getFolderThumbAssetId(entry._id);

// Typed icon SVG for this folder (same as sidebar uses)
const typedIconSvg = getIconForCategory(ft);
// Is it a generic folder icon, or a typed one?
const isTyped = typedIconSvg !== ICONS.folder;

if (thumbAssetId) {
  // SVG folder shape with embedded thumbnail + small typed icon badge in the tab
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 80');
  svg.setAttribute('width', '100');
  svg.setAttribute('height', '80');

  // Defs: clipPath using folder shape
  const defs = document.createElementNS(svgNS, 'defs');
  const clipId = 'fc_' + entry._id.replace(/-/g,'');
  const clip = document.createElementNS(svgNS, 'clipPath');
  clip.setAttribute('id', clipId);
  const tab = document.createElementNS(svgNS, 'path');
  tab.setAttribute('d', 'M4 22 Q4 16 10 16 L34 16 Q38 16 40 20 L46 28 L96 28 Q98 28 98 30 L98 76 Q98 78 96 78 L4 78 Q2 78 2 76 L2 24 Q2 22 4 22 Z');
  clip.appendChild(tab);
  defs.appendChild(clip);
  svg.appendChild(defs);

  // Folder background
  const bg = document.createElementNS(svgNS, 'path');
  bg.setAttribute('d', 'M4 22 Q4 16 10 16 L34 16 Q38 16 40 20 L46 28 L96 28 Q98 28 98 30 L98 76 Q98 78 96 78 L4 78 Q2 78 2 76 L2 24 Q2 22 4 22 Z');
  bg.setAttribute('fill', '#1e2e44');
  bg.setAttribute('stroke', '#4a9eff');
  bg.setAttribute('stroke-width', '1.5');
  bg.setAttribute('opacity', '0.9');
  svg.appendChild(bg);

  // Thumbnail image clipped to folder shape
  const img = document.createElementNS(svgNS, 'image');
  img.setAttribute('href', '');
  img.setAttribute('x', '2'); img.setAttribute('y', '28');
  img.setAttribute('width', '96'); img.setAttribute('height', '50');
  img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  img.setAttribute('clip-path', `url(#${clipId})`);
  img.style.opacity = '0';
  img.style.transition = 'opacity 0.3s';
  svg.appendChild(img);

  // Folder outline on top
  const outline = document.createElementNS(svgNS, 'path');
  outline.setAttribute('d', 'M4 22 Q4 16 10 16 L34 16 Q38 16 40 20 L46 28 L96 28 Q98 28 98 30 L98 76 Q98 78 96 78 L4 78 Q2 78 2 76 L2 24 Q2 22 4 22 Z');
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', '#4a9eff');
  outline.setAttribute('stroke-width', '1.8');
  outline.setAttribute('opacity', '0.85');
  svg.appendChild(outline);

  // Typed icon badge in the folder tab area (top-left), only if not generic folder
  if (isTyped) {
    const fo = document.createElementNS(svgNS, 'foreignObject');
    fo.setAttribute('x', '4');
    fo.setAttribute('y', '16');
    fo.setAttribute('width', '16');
    fo.setAttribute('height', '16');
    fo.innerHTML = typedIconSvg;
    svg.appendChild(fo);
  }

  wrap.appendChild(svg);
  observeThumb(wrap, thumbAssetId, 'folder');

} else {
  // No thumbnail — show the typed icon scaled up inside the folder shape,
  // the same way non-texture items show their icon in a thumb-box.
  if (isTyped) {
    // Typed system folder: big typed icon, folder shape as subtle backdrop
    wrap.innerHTML = `
      <svg viewBox="0 0 100 80" width="100" height="80" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 22 Q4 16 10 16 L34 16 Q38 16 40 20 L46 28 L96 28 Q98 28 98 30 L98 76 Q98 78 96 78 L4 78 Q2 78 2 76 L2 24 Q2 22 4 22 Z"
          fill="#1e2e44" stroke="#4a9eff" stroke-width="1.8" opacity="0.6"/>
        <foreignObject x="29" y="30" width="38" height="38">
          ${typedIconSvg.replace(/width="16" height="16"/, 'width="38" height="38"')}
        </foreignObject>
      </svg>`;
  } else {
    // Generic folder — plain blue shape as before
    wrap.innerHTML = `
      <svg viewBox="0 0 100 80" width="100" height="80" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 22 Q4 16 10 16 L34 16 Q38 16 40 20 L46 28 L96 28 Q98 28 98 30 L98 76 Q98 78 96 78 L4 78 Q2 78 2 76 L2 24 Q2 22 4 22 Z"
          fill="#1e2e44" stroke="#4a9eff" stroke-width="1.8" opacity="0.9"/>
      </svg>`;
  }
}

return wrap;
}

function renderIconGrid(list, contents) {
const grid = document.createElement('div');
grid.className = 'icon-grid';

for (const entry of contents) {
  const cell = document.createElement('div');
  cell.className = 'icon-cell' + (isSelectedEntry(entry) ? ' selected' : '');

  const ft = entry.preferred_type ?? entry.type_default ?? -1;
  const tk = entry._typeKey || 'unknown';
  const typeName = entry._isFolder ? getFolderTypeName(ft) : getTypeKeyName(tk);

  // ── Visual area ────────────────────────────────────────────
  if (entry._isFolder) {
    cell.appendChild(buildFolderThumbCell(entry));

  } else if (isTextureType(entry) && itemHasAssetId(entry)) {
    // Texture item: thumbnail — lazy loaded via IntersectionObserver
    const thumbBox = document.createElement('div');
    thumbBox.className = 'thumb-box';

    const spinWrap = document.createElement('div');
    spinWrap.className = 'thumb-icon';
    spinWrap.innerHTML = `<div class="thumb-spin"></div>`;
    thumbBox.appendChild(spinWrap);

    const img = document.createElement('img');
    img.alt = '';
    thumbBox.appendChild(img);

    // Register for lazy loading — observer sets img.src when visible
    observeThumb(thumbBox, entry.asset_id, 'texture');
    cell.appendChild(thumbBox);

  } else {
    // Other item type: scaled SVG icon in a box
    const thumbBox = document.createElement('div');
    thumbBox.className = 'thumb-box';
    const iconDiv = document.createElement('div');
    iconDiv.className = 'thumb-icon';
    const iconSvg = getIconForItem(tk);
    iconDiv.innerHTML = iconSvg.replace(/width="16" height="16"/, 'width="38" height="38"');
    thumbBox.appendChild(iconDiv);
    cell.appendChild(thumbBox);
  }

  // ── Label ──────────────────────────────────────────────────
  const label = document.createElement('div');
  label.className = 'icon-label';
  label.innerHTML = highlightMatch(entry.name || '(unnamed)', searchQuery);
  cell.appendChild(label);

  const typeEl = document.createElement('div');
  typeEl.className = 'icon-type';
  typeEl.textContent = typeName;
  cell.appendChild(typeEl);

  // Selection on mousedown — instant visual feedback, no re-render needed.
  // Because we never rebuild the DOM on mousedown, the cell element survives
  // long enough for dblclick to fire reliably on both Chrome and Firefox.
  cell.addEventListener('mousedown', () => {
    const prev = grid.querySelector('.icon-cell.selected');
    if (prev && prev !== cell) prev.classList.remove('selected');
    cell.classList.add('selected');
    selectedItem = entry;
    selectedIsFolder = !!entry._isFolder;
    const contents = getSortedContents(currentCatId);
    selectedIndex = contents.findIndex(e => isSelectedEntry(e));
    updateDetailSide(entry);
    updateStatus();
  });

  cell.addEventListener('dblclick', () => {
    if (entry._isFolder) {
      navigateTo(entry._id);
    } else if (isTextureType(entry) && itemHasAssetId(entry)) {
      openLightbox(entry.asset_id, entry.name);
    }
  });

  grid.appendChild(cell);
}

list.appendChild(grid);
}

function isSelectedEntry(entry) {
if (!selectedItem) return false;
if (entry._isFolder && selectedIsFolder) return entry._id === selectedItem._id;
if (!entry._isFolder && !selectedIsFolder) return (entry.item_id || entry.id) === (selectedItem.item_id || selectedItem.id);
return false;
}

function selectEntry(entry, index) {
selectedItem = entry;
selectedIsFolder = !!entry._isFolder;
selectedIndex = (index !== undefined) ? index : (() => {
  const contents = getSortedContents(currentCatId);
  return contents.findIndex(e => isSelectedEntry(e));
})();

// Lightweight selection update: swap .selected class without rebuilding the DOM.
// Full renderContentList() is only needed when contents change (navigation/sort/filter).
const list = document.getElementById('content-list');
if (list) {
  list.querySelectorAll('.list-row.selected, .icon-cell.selected')
      .forEach(el => el.classList.remove('selected'));
  // Find the cell/row at selectedIndex and mark it
  const rows = list.querySelectorAll('.list-row, .icon-cell');
  if (rows[selectedIndex]) rows[selectedIndex].classList.add('selected');
}

updateDetailSide(entry);
updateStatus();
// Scroll selected row/cell into view
setTimeout(() => {
  const el = document.querySelector('.list-row.selected, .icon-cell.selected');
  if (el) el.scrollIntoView({ block: 'nearest' });
}, 0);
}

function selectByIndex(idx) {
const contents = getSortedContents(currentCatId);
if (!contents.length) return;
const clamped = Math.max(0, Math.min(contents.length - 1, idx));
selectEntry(contents[clamped], clamped);
}

// Count columns by inspecting actual rendered cell positions — accurate for
// any auto-fill/1fr grid regardless of icon size, gap, or container width.
function getGridCols(grid) {
if (!grid) return 4;
const cells = grid.querySelectorAll('.icon-cell');
if (cells.length < 2) return cells.length || 1;
const firstTop = cells[0].getBoundingClientRect().top;
let cols = 0;
for (const c of cells) {
  if (c.getBoundingClientRect().top !== firstTop) break;
  cols++;
}
return cols || 1;
}

function formatDate(ts) {
if (!ts || ts === 0) return '—';
try {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
} catch { return '—'; }
}

function decodePermMask(mask) {
if (mask == null) return null;
const m = parseInt(mask);
return {
  copy:     !!(m & 0x00008000),
  transfer: !!(m & 0x00002000),
  modify:   !!(m & 0x00004000),
  move:     !!(m & 0x00080000),
  export:   !!(m & 0x00040000),
};
}

function permTag(label, on) {
return `<span class="perm-tag ${on ? 'on' : ''}">${label}</span>`;
}

function updateDetailSide(entry) {
const side = document.getElementById('detail-side');
const dsIcon = document.getElementById('ds-icon');
const dsName = document.getElementById('ds-name');
const dsType = document.getElementById('ds-type');
const dsBody = document.getElementById('detail-side-body');

if (!entry) {
  // Show folder summary
  if (currentCatId && catMap[currentCatId]) {
    side.classList.remove('hidden');
    const cat = catMap[currentCatId];
    const ft = cat.preferred_type ?? cat.type_default ?? -1;
    dsIcon.innerHTML = `<div style="width:32px;height:32px;">${getIconForCategory(ft)}</div>`;
    dsName.textContent = cat.name || '(unnamed)';
    dsType.textContent = getFolderTypeName(ft) + ' folder';
    const direct = (catChildren[currentCatId]||[]).length + (catItems[currentCatId]||[]).length;
    const total = countDescendantItems(currentCatId);
    dsBody.innerHTML = `
      <div class="detail-group">
        <div class="dg-label">Direct Contents</div>
        <div class="dg-value count">${direct.toLocaleString()}</div>
      </div>
      <div class="detail-group">
        <div class="dg-label">Total Items (recursive)</div>
        <div class="dg-value count">${total.toLocaleString()}</div>
      </div>
      <div class="detail-group">
        <div class="dg-label">Folder ID</div>
        <div class="dg-value uuid">${cat.cat_id || cat.category_id || '—'}</div>
      </div>
      <div class="detail-group">
        <div class="dg-label">Parent ID</div>
        <div class="dg-value uuid">${cat.parent_id || '—'}</div>
      </div>
    `;
  } else {
    side.classList.add('hidden');
  }
  return;
}

side.classList.remove('hidden');

if (entry._isFolder) {
  const ft = entry.preferred_type ?? entry.type_default ?? -1;
  dsIcon.innerHTML = `<div style="width:32px;height:32px;">${getIconForCategory(ft)}</div>`;
  dsName.textContent = entry.name || '(unnamed)';
  dsType.textContent = getFolderTypeName(ft) + ' folder';
  const direct = (catChildren[entry._id]||[]).length + (catItems[entry._id]||[]).length;
  const total = countDescendantItems(entry._id);
  dsBody.innerHTML = `
    <div class="detail-group">
      <div class="dg-label">Direct Contents</div>
      <div class="dg-value count">${direct.toLocaleString()}</div>
    </div>
    <div class="detail-group">
      <div class="dg-label">Total Items (recursive)</div>
      <div class="dg-value count">${total.toLocaleString()}</div>
    </div>
    <div class="detail-group">
      <div class="dg-label">Folder ID</div>
      <div class="dg-value uuid">${entry.cat_id || entry.category_id || '—'}</div>
    </div>
    <div class="detail-group">
      <div class="dg-label">Parent ID</div>
      <div class="dg-value uuid">${entry.parent_id || '—'}</div>
    </div>
  `;
} else {
  const tk = entry._typeKey || 'unknown';
  dsIcon.innerHTML = `<div style="width:32px;height:32px;">${getIconForItem(tk)}</div>`;
  dsName.textContent = entry.name || '(unnamed)';
  dsType.textContent = getTypeKeyName(tk);

  const perm = entry.permissions || {};
  const base = decodePermMask(perm.base_mask);
  const owner = decodePermMask(perm.owner_mask);
  const next = decodePermMask(perm.next_owner_mask);

  const permSection = owner ? `
    <div class="detail-group">
      <div class="dg-label">Your Permissions</div>
      <div class="perm-row">
        ${permTag('Copy', owner.copy)}
        ${permTag('Modify', owner.modify)}
        ${permTag('Transfer', owner.transfer)}
        ${permTag('Move', owner.move)}
      </div>
    </div>
    <div class="detail-group">
      <div class="dg-label">Next Owner</div>
      <div class="perm-row">
        ${permTag('Copy', next?.copy)}
        ${permTag('Modify', next?.modify)}
        ${permTag('Transfer', next?.transfer)}
      </div>
    </div>
  ` : '';

  const dateSection = entry.creation_date ? `
    <div class="detail-group">
      <div class="dg-label">Created</div>
      <div class="dg-value">${formatDate(entry.creation_date)}</div>
    </div>
  ` : '';

  dsBody.innerHTML = `
    ${dateSection}
    <div class="detail-group">
      <div class="dg-label">Item ID</div>
      <div class="dg-value uuid">${entry.item_id || entry.id || '—'}</div>
    </div>
    <div class="detail-group">
      <div class="dg-label">Asset ID</div>
      <div class="dg-value uuid">${entry.asset_id || '—'}</div>
    </div>
    ${permSection}
    ${(() => {
      const pid = entry.parent_id;
      if (!pid || !catMap[pid]) return '';
      const parts = [];
      let id = pid;
      while (id && catMap[id]) {
        parts.unshift(catMap[id].name || '(unnamed)');
        const p = catMap[id].parent_id;
        if (!p || p === '00000000-0000-0000-0000-000000000000' || !catMap[p]) break;
        id = p;
      }
      return `<div class="detail-group">
        <div class="dg-label">Location</div>
        <div class="dg-value" style="font-size:11px;line-height:1.6;color:var(--text-dim);word-break:break-word">${parts.map(p => escHtml(p)).join('<span style="color:var(--text-mute);margin:0 3px">›</span>')}</div>
      </div>`;
    })()}
  `;
}
}

// ============================================================
// Type filter panel
// ============================================================

// Groups for the filter panel UI — derived from the same icon map used by getIconForItem
// Each entry: { key, label, iconName }
const FILTER_GROUPS = [
{ label: 'Content',  types: [
  { key: 'folder',       label: 'Folders',      icon: 'folder'       },
  { key: 'object',       label: 'Objects',      icon: 'object'       },
  { key: 'notecard',     label: 'Notecards',    icon: 'notecard'     },
  { key: 'script',       label: 'Scripts',      icon: 'script'       },
  { key: 'mesh',         label: 'Meshes',       icon: 'mesh'         },
  { key: 'animation',    label: 'Animations',   icon: 'animation'    },
  { key: 'gesture',      label: 'Gestures',     icon: 'gesture'      },
  { key: 'landmark',     label: 'Landmarks',    icon: 'landmark'     },
  { key: 'sound',        label: 'Sounds',       icon: 'sound'        },
  { key: 'settings',     label: 'Settings',     icon: 'settings'     },
  { key: 'material',     label: 'Materials',    icon: 'material'     },
  { key: 'gltf',         label: 'GLTF',         icon: 'gltf'         },
  { key: 'texture',      label: 'Textures',     icon: 'texture'      },
  { key: 'calling_card', label: 'Calling Cards',icon: 'calling_card' },
  { key: 'snapshot',     label: 'Snapshots',    icon: 'snapshot'     },
]},
{ label: 'Wearables', types: [
  { key: 'clothing',     label: 'Clothing',     icon: 'clothing'     },
  { key: 'bodypart',     label: 'Body Parts',   icon: 'bodypart'     },
  { key: 'link',         label: 'Links',        icon: 'link'         },
  // lost_found is a system folder concept, not an item type — no items have this _typeKey
  // { key: 'lost_found',   label: 'Lost & Found', icon: 'lost_found'   },
]},
];

function buildFilterPanel() {
const inner = document.getElementById('filter-inner');
inner.innerHTML = '';

for (const group of FILTER_GROUPS) {
  const row = document.createElement('div');
  row.className = 'filter-row';

  const lbl = document.createElement('div');
  lbl.className = 'filter-row-label';
  lbl.textContent = group.label;
  row.appendChild(lbl);

  for (const t of group.types) {
    const chip = document.createElement('div');
    chip.className = 'fchip' + (activeTypeFilter.has(t.key) ? ' on' : '');
    chip.dataset.key = t.key;

    const iconWrap = document.createElement('div');
    iconWrap.className = 'fchip-icon';
    iconWrap.innerHTML = (ICONS[t.icon] || ICONS.unknown)
      .replace(/width="16" height="16"/, 'width="13" height="13"');
    chip.appendChild(iconWrap);

    chip.appendChild(document.createTextNode(t.label));

    chip.addEventListener('click', () => {
      if (activeTypeFilter.has(t.key)) {
        activeTypeFilter.delete(t.key);
        chip.classList.remove('on');
      } else {
        activeTypeFilter.add(t.key);
        chip.classList.add('on');
      }
      updateFilterBtn();
      renderContentList();
      updateStatus();
    });

    row.appendChild(chip);
  }

  inner.appendChild(row);
}

// Footer actions
const footer = document.createElement('div');
footer.className = 'filter-footer';

const clearLink = document.createElement('span');
clearLink.className = 'filter-link';
clearLink.textContent = 'Clear all';
clearLink.addEventListener('click', () => {
  activeTypeFilter.clear();
  inner.querySelectorAll('.fchip.on').forEach(c => c.classList.remove('on'));
  updateFilterBtn();
  renderContentList();
  updateStatus();
});

const allLink = document.createElement('span');
allLink.className = 'filter-link';
allLink.textContent = 'Select all';
allLink.addEventListener('click', () => {
  FILTER_GROUPS.forEach(g => g.types.forEach(t => activeTypeFilter.add(t.key)));
  inner.querySelectorAll('.fchip').forEach(c => c.classList.add('on'));
  updateFilterBtn();
  renderContentList();
  updateStatus();
});

footer.appendChild(clearLink);
footer.appendChild(allLink);
inner.appendChild(footer);
}

function updateFilterBtn() {
const btn = document.getElementById('btn-filter');
if (activeTypeFilter.size > 0) {
  btn.classList.add('has-filter');
  btn.title = `Filter: ${activeTypeFilter.size} type(s) selected`;
} else {
  btn.classList.remove('has-filter');
  btn.title = 'Filter by type';
}
}

// ============================================================
// Status bar
// ============================================================
function updateStatus() {
const cats = Object.keys(catMap).length;
const items = Object.values(catItems).reduce((a, b) => a + b.length, 0);
document.getElementById('status-cats').textContent = `${cats.toLocaleString()} folders`;
document.getElementById('status-items').textContent = `${items.toLocaleString()} items`;
if (selectedItem) {
  document.getElementById('status-sel').textContent = `Selected: ${selectedItem.name || '—'}`;
} else {
  document.getElementById('status-sel').textContent = '';
}
if (searchQuery) {
  document.getElementById('status-filter').textContent = `Filter: "${searchQuery}"`;
} else {
  document.getElementById('status-filter').textContent = '';
}
}

// ============================================================
// Parse filter modal
// ============================================================
const PARSE_FILTER_GROUPS = [
{ id: 'structure', label: 'Structure', types: [
  { key: 'category', label: 'Folders', icon: 'folder' },
]},
{ id: 'content', label: 'Content', types: [
  { key: 'object',       label: 'Objects',      icon: 'object'       },
  { key: 'notecard',     label: 'Notecards',    icon: 'notecard'     },
  { key: 'script',       label: 'Scripts',      icon: 'script'       },
  { key: 'mesh',         label: 'Meshes',       icon: 'mesh'         },
  { key: 'animation',    label: 'Animations',   icon: 'animation'    },
  { key: 'gesture',      label: 'Gestures',     icon: 'gesture'      },
  { key: 'landmark',     label: 'Landmarks',    icon: 'landmark'     },
  { key: 'sound',        label: 'Sounds',       icon: 'sound'        },
  { key: 'settings',     label: 'Settings',     icon: 'settings'     },
  { key: 'material',     label: 'Materials',    icon: 'material'     },
  { key: 'gltf',         label: 'GLTF',         icon: 'gltf'         },
  { key: 'texture',      label: 'Textures',     icon: 'texture'      },
  { key: 'calling_card', label: 'Calling Cards',icon: 'calling_card' },
  { key: 'snapshot',     label: 'Snapshots',    icon: 'snapshot'     },
]},
{ id: 'wearables', label: 'Wearables', types: [
  { key: 'clothing',     label: 'Clothing',     icon: 'clothing'     },
  { key: 'bodypart',     label: 'Body Parts',   icon: 'bodypart'     },
  { key: 'link',         label: 'Links',        icon: 'link'         },
]},
];

let pendingFile = null;          // file waiting for modal confirm
let parseFilterKeys = new Set(); // keys selected in modal; empty = load all
let excludeSystemFolders = false;

// preferred_type values that identify system/library folders to exclude
const SYSTEM_FOLDER_TYPES = new Set([
  'bodypart', 'callcard', 'clothing', 'current', 'favorite',
  'my_otfts', 'gesture', 'landmark', 'lstndfnd',
  'notecard', 'snapshot', 'inbox', 'lsltext', 'settings',
  'sound', 'texture', 'trash', 'animatn', 'object',
]);

function buildParseModal() {
for (const group of PARSE_FILTER_GROUPS) {
  const container = document.getElementById(`pm-chips-${group.id}`);
  if (!container) continue;
  container.innerHTML = '';
  for (const t of group.types) {
    const chip = document.createElement('div');
    chip.className = 'fchip on'; // default all selected
    chip.dataset.key = t.key;
    parseFilterKeys.add(t.key);

    const iconWrap = document.createElement('div');
    iconWrap.className = 'fchip-icon';
    iconWrap.innerHTML = (ICONS[t.icon] || ICONS.unknown)
      .replace(/width="16" height="16"/, 'width="13" height="13"');
    chip.appendChild(iconWrap);
    chip.appendChild(document.createTextNode(t.label));

    chip.addEventListener('click', () => {
      if (parseFilterKeys.has(t.key)) {
        parseFilterKeys.delete(t.key);
        chip.classList.remove('on');
      } else {
        parseFilterKeys.add(t.key);
        chip.classList.add('on');
      }
    });
    container.appendChild(chip);
  }
}
}

function showParseModal(file) {
pendingFile = file;
// Reset advanced section to collapsed on each show
const adv = document.getElementById('pm-advanced');
if (adv) adv.classList.add('hidden');
const tog = document.getElementById('pm-advanced-toggle');
if (tog) tog.classList.remove('open');
document.getElementById('parse-modal').classList.remove('hidden');
}

function hideParseModal() {
document.getElementById('parse-modal').classList.add('hidden');
}

// Filter parsed data: remove items/categories whose type is not in the selected keys
function applyParseFilter(data) {
  if (parseFilterKeys.size === 0 && !excludeSystemFolders) return data;

  let categories = data.categories || [];
  let items = data.items || [];

  // ── Step 1: exclude system folders and all their descendants ──
  if (excludeSystemFolders) {
    // Build a temporary parent→children map from the raw data
    const tempChildren = {};
    const tempCatById = {};
    for (const cat of categories) {
      const id = cat.cat_id || cat.category_id || cat.id;
      if (!id) continue;
      tempCatById[id] = cat;
      tempChildren[id] = [];
    }
    for (const cat of categories) {
      const id = cat.cat_id || cat.category_id || cat.id;
      const pid = cat.parent_id;
      if (pid && tempChildren[pid]) tempChildren[pid].push(id);
    }

    // Collect all IDs to exclude (system folders + all descendants)
    const excludedIds = new Set();

    function markExcluded(catId) {
      excludedIds.add(catId);
      for (const cid of (tempChildren[catId] || [])) markExcluded(cid);
    }

    for (const cat of categories) {
      const id = cat.cat_id || cat.category_id || cat.id;
      const pt = String(cat.preferred_type ?? '').toLowerCase();
      if (SYSTEM_FOLDER_TYPES.has(pt)) markExcluded(id);
    }

    categories = categories.filter(cat => {
      const id = cat.cat_id || cat.category_id || cat.id;
      return !excludedIds.has(id);
    });
    items = items.filter(item => !excludedIds.has(item.parent_id));
  }

  // ── Step 2: type filter ────────────────────────────────────
  if (parseFilterKeys.size > 0) {
    const keepCategories = parseFilterKeys.has('category');
    categories = keepCategories ? categories : [];
    // resolveTypeKey gives the same canonical key that parseFilterKeys uses —
    // no need for the multi-value PARSE_KEY_TO_TYPES expansion anymore.
    items = items.filter(item => parseFilterKeys.has(resolveTypeKey(item)));
  }

  return { ...data, categories, items };
}

// ============================================================
// Session persistence — IndexedDB
// ============================================================
const SessionDB = (() => {
  const DB_NAME    = 'sl_inv_browser';
  const DB_VERSION = 1;
  const STORE      = 'session';
  const KEY        = 'last';

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(STORE);
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function save(filename, arrayBuffer, parseFilterSnapshot, excludeSystem) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req   = store.put({
        filename,
        buffer:        arrayBuffer,
        savedAt:       Date.now(),
        parseFilter:   [...parseFilterSnapshot],
        excludeSystem,
      }, KEY);
      req.onsuccess = () => resolve();
      req.onerror   = e  => reject(e.target.error);
    });
  }

  async function load() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req   = store.get(KEY);
      req.onsuccess = e => resolve(e.target.result || null);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function clear() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req   = store.delete(KEY);
      req.onsuccess = () => resolve();
      req.onerror   = e  => reject(e.target.error);
    });
  }

  return { save, load, clear };
})();

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

async function checkResumeBanner() {
  try {
    const session = await SessionDB.load();
    if (!session) return;

    const banner = document.getElementById('resume-banner');
    const label  = document.getElementById('resume-label');
    const mb     = (session.buffer.byteLength / 1024 / 1024).toFixed(1);
    label.textContent =
      `Resume: ${session.filename}  (${mb} MB · saved ${formatTimeAgo(session.savedAt)})`;
    banner.classList.remove('hidden');
  } catch (err) {
    console.warn('SessionDB read error:', err);
  }
}

async function resumeSession() {
  try {
    const session = await SessionDB.load();
    if (!session) return;

    document.getElementById('resume-banner').classList.add('hidden');

    // Restore parse filter state from the saved snapshot.
    // Merge with current defaults so type keys added after the session was saved
    // (e.g. 'material') are automatically included rather than silently dropped.
    const savedKeys = new Set(session.parseFilter || []);
    // If the saved set is empty it means "load all" — preserve that
    if (savedKeys.size > 0) {
      PARSE_FILTER_GROUPS.forEach(g => g.types.forEach(t => savedKeys.add(t.key)));
    }
    parseFilterKeys      = savedKeys;
    excludeSystemFolders = session.excludeSystem || false;

    // Feed the saved ArrayBuffer through the same parse path as a fresh .gz
    const file = new File([session.buffer], session.filename, { type: 'application/gzip' });
    await doLoadFile(file);
  } catch (err) {
    console.warn('Resume failed:', err);
    await SessionDB.clear();
    document.getElementById('resume-banner').classList.add('hidden');
  }
}

// ============================================================
// File loading
// ============================================================
function setProgress(label, sub, pct) {
const el = document.getElementById('progress');
el.classList.toggle('hidden', label === null);
if (label !== null) {
  document.getElementById('p-label').textContent = label;
  document.getElementById('p-sub').textContent = sub || '';
  document.getElementById('p-fill').style.width = (pct || 0) + '%';
}
}

async function loadFile(file) {
const name = file.name.toLowerCase();

// Dismiss resume banner if still visible — user is loading a new file
document.getElementById('resume-banner')?.classList.add('hidden');

// For .gz files, show the parse filter modal first
if (name.endsWith('.gz')) {
  showParseModal(file);
  return;
}
await doLoadFile(file);
}

async function doLoadFile(file) {
setProgress('Reading file…', file.name, 10);
document.getElementById('drop-zone').classList.add('hidden');

try {
  let arrayBuffer = await file.arrayBuffer();
  setProgress('Decompressing…', `${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`, 30);

  let data;
  const name = file.name.toLowerCase();

  await new Promise(r => setTimeout(r, 20));

  if (name.endsWith('.gz')) {
    const compressed = new Uint8Array(arrayBuffer);
    const decompressed = pako.inflate(compressed);
    setProgress('Parsing LLSD binary…', `${(decompressed.byteLength / 1024 / 1024).toFixed(1)} MB uncompressed`, 55);
    await new Promise(r => setTimeout(r, 20));
    const parser = new LLSDBinaryParser(decompressed.buffer);
    data = parser.parse();
    // Apply parse filter (type filter + system folder exclusion)
    data = applyParseFilter(data);
    // Persist the raw .gz to IndexedDB for resume on next load
    SessionDB.save(file.name, arrayBuffer, parseFilterKeys, excludeSystemFolders)
      .catch(err => console.warn('SessionDB save failed:', err));
  } else if (name.endsWith('.json')) {
    setProgress('Parsing JSON…', '', 55);
    await new Promise(r => setTimeout(r, 20));
    const text = new TextDecoder().decode(arrayBuffer);
    data = JSON.parse(text);
  } else if (name.endsWith('.llsd')) {
    // Raw binary (already decompressed)
    setProgress('Parsing LLSD binary…', '', 55);
    await new Promise(r => setTimeout(r, 20));
    const parser = new LLSDBinaryParser(arrayBuffer);
    data = parser.parse();
  } else {
    // Try JSON first, then LLSD
    try {
      const text = new TextDecoder().decode(arrayBuffer);
      data = JSON.parse(text);
    } catch {
      const parser = new LLSDBinaryParser(arrayBuffer);
      data = parser.parse();
    }
  }

  setProgress('Building index…', '', 75);
  await new Promise(r => setTimeout(r, 20));

  invData = data;
  buildIndex(data);

  setProgress('Rendering…', '', 90);
  await new Promise(r => setTimeout(r, 20));

  // Auto-expand root
  if (rootCatId) {
    expandedNodes.add(rootCatId);
    // Expand one more level
    for (const cid of (catChildren[rootCatId] || []).slice(0, 30)) {
      expandedNodes.add(cid);
    }
  }

  renderTree();
  if (rootCatId) navigateTo(rootCatId);

  document.getElementById('status-path').textContent = file.name;
  setProgress(null);

} catch (err) {
  setProgress(null);
  document.getElementById('drop-zone').classList.remove('hidden');
  alert('Error loading file:\n' + err.message);
  console.error(err);
}
}

// ============================================================
// Sort
// ============================================================
function setSortKey(key) {
if (sortKey === key) sortAsc = !sortAsc;
else { sortKey = key; sortAsc = true; }
_searchCache = { key: null, result: null }; // sort change invalidates cached results

document.querySelectorAll('.col-h').forEach(el => el.classList.remove('sorted'));
const el = document.getElementById('sort-' + key);
if (el) {
  el.classList.add('sorted');
  el.querySelector('.sort-arrow').textContent = sortAsc ? '↑' : '↓';
}
renderContentList();
}

// ============================================================
// Resizer
// ============================================================
function initResizer(resizerId, leftId) {
const resizer = document.getElementById(resizerId);
const leftEl  = document.getElementById(leftId);
let startX = 0, startW = 0;

function onMove(e) {
  const newW = Math.max(160, Math.min(600, startW + e.clientX - startX));
  leftEl.style.width = newW + 'px';
  if (leftId === 'tree-panel') leftEl.style.minWidth = leftEl.style.maxWidth = '';
}
function onUp() {
  resizer.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onMove);
  document.removeEventListener('mouseup', onUp);
}
resizer.addEventListener('mousedown', e => {
  startX = e.clientX; startW = leftEl.offsetWidth;
  resizer.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});
}

// ============================================================
// Detail pane resizer + toggle
// ============================================================
function initDetailResizer() {
const resizer = document.getElementById('resizer3');
const panel   = document.getElementById('detail-side');
if (!resizer || !panel) return;
let startX = 0, startW = 0;

function onMove(e) {
  const newW = Math.max(160, Math.min(480, startW - (e.clientX - startX)));
  panel.style.width = newW + 'px';
}
function onUp() {
  resizer.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onMove);
  document.removeEventListener('mouseup', onUp);
}
resizer.addEventListener('mousedown', e => {
  startX = e.clientX; startW = panel.offsetWidth;
  resizer.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});
}

function toggleDetailPane() {
const panel   = document.getElementById('detail-side');
const resizer = document.getElementById('resizer3');
const btn     = document.getElementById('btn-toggle-detail');
const isHidden = panel.classList.contains('collapsed');
panel.classList.toggle('collapsed');
resizer.classList.toggle('hidden');
if (btn) {
  btn.classList.toggle('active', isHidden);
  btn.textContent = isHidden ? '›' : '‹';
}
localStorage.setItem('sl_inv_detail_open', isHidden ? '1' : '0');
}

// ============================================================
// Drag & drop
// ============================================================
function initDrop() {
const zone = document.getElementById('drop-zone');
const app  = document.getElementById('app');

// Prevent browser from navigating to / saving the file on any drag
document.addEventListener('dragover',  e => e.preventDefault());
document.addEventListener('drop',      e => e.preventDefault());

app.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
app.addEventListener('dragleave', e => { if (!app.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
app.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});
}

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
initDrop();
initResizer('resizer', 'tree-panel');
initResizer('resizer2', 'detail-panel');
initDetailResizer();

// Restore detail pane state
const detailOpen = localStorage.getItem('sl_inv_detail_open');
if (detailOpen === '0') {
  document.getElementById('detail-side').classList.add('collapsed');
  document.getElementById('resizer3').classList.add('hidden');
  const btn = document.getElementById('btn-toggle-detail');
  if (btn) btn.textContent = '›';
}

document.getElementById('btn-toggle-detail').addEventListener('click', toggleDetailPane);

// Check for a saved session and show resume banner if found
checkResumeBanner();
document.getElementById('resume-btn-yes').addEventListener('click', () => resumeSession());
document.getElementById('resume-btn-no').addEventListener('click', async () => {
  await SessionDB.clear();
  document.getElementById('resume-banner').classList.add('hidden');
});

document.getElementById('btn-view-list').addEventListener('click', () => {
  viewMode = 'list';
  document.getElementById('btn-view-list').classList.add('active');
  document.getElementById('btn-view-icons').classList.remove('active');
  document.getElementById('size-slider-wrap').classList.add('hidden');
  localStorage.setItem('sl_inv_viewmode', 'list');
  renderContentList();
});

document.getElementById('btn-view-icons').addEventListener('click', () => {
  viewMode = 'icons';
  document.getElementById('btn-view-icons').classList.add('active');
  document.getElementById('btn-view-list').classList.remove('active');
  document.getElementById('size-slider-wrap').classList.remove('hidden');
  localStorage.setItem('sl_inv_viewmode', 'icons');
  renderContentList();
});

document.getElementById('icon-size-slider').addEventListener('input', e => {
  applyIconSize(parseInt(e.target.value));
  localStorage.setItem('sl_inv_iconsize', e.target.value);
  // No need to re-render — CSS variable change reflowed by browser automatically
});

// Lightbox: close on bg click, X button, or ESC
document.getElementById('lightbox-bg').addEventListener('click', closeLightbox);
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lb-prev').addEventListener('click', e => { e.stopPropagation(); lbNavigate(-1); });
  document.getElementById('lb-next').addEventListener('click', e => { e.stopPropagation(); lbNavigate(+1); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();

  // Skip all nav keys when typing in an input
  const tag = document.activeElement.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

  // Backspace = go up one folder
  if (e.key === 'Backspace' && !inInput) {
    e.preventDefault();
    if (navStack.length >= 2) navigateTo(navStack[navStack.length - 2].id);
    return;
  }

  // Lightbox arrow navigation — must be checked BEFORE grid navigation
  const lb = document.getElementById('lightbox');
  if (lb && !lb.classList.contains('hidden')) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); lbNavigate(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); lbNavigate(+1); return; }
  }

  // Arrow keys = move selection in content list
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' ||
       e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !inInput) {
    e.preventDefault();
    const contents = getSortedContents(currentCatId);
    if (!contents.length) return;

    let next = selectedIndex;

    if (viewMode === 'list') {
      // List: up/down only
      if (e.key === 'ArrowDown') next = selectedIndex < 0 ? 0 : selectedIndex + 1;
      if (e.key === 'ArrowUp')   next = selectedIndex < 0 ? 0 : selectedIndex - 1;
    } else {
      // Icons grid: derive column count from actual rendered layout.
      // Math.round(offsetWidth / cellSize) breaks with 1fr expansion — ask the DOM instead.
      const grid = document.querySelector('.icon-grid');
      const cols = getGridCols(grid);
      if (e.key === 'ArrowRight') next = selectedIndex < 0 ? 0 : selectedIndex + 1;
      if (e.key === 'ArrowLeft')  next = selectedIndex < 0 ? 0 : selectedIndex - 1;
      if (e.key === 'ArrowDown')  next = selectedIndex < 0 ? 0 : selectedIndex + cols;
      if (e.key === 'ArrowUp')    next = selectedIndex < 0 ? 0 : selectedIndex - cols;
    }

    selectByIndex(Math.max(0, Math.min(contents.length - 1, next)));
    return;
  }

  // Enter or Space = open selected folder / texture
  if ((e.key === 'Enter' || e.key === ' ') && !inInput) {
    e.preventDefault();
    if (!selectedItem) return;
    if (selectedIsFolder) {
      navigateTo(selectedItem._id);
    } else {
      if (isTextureType(selectedItem) && itemHasAssetId(selectedItem)) {
        openLightbox(selectedItem.asset_id, selectedItem.name);
      }
    }
  }

  // / = focus search box
  if (e.key === '/' && !inInput) {
    e.preventDefault();
    const s = document.getElementById('search');
    if (s) { s.focus(); s.select(); }
  }

  // D = toggle detail pane
  if ((e.key === 'd' || e.key === 'D') && !inInput) {
    e.preventDefault();
    toggleDetailPane();
  }

  // ? = keyboard shortcut overlay
  if (e.key === '?' && !inInput) {
    e.preventDefault();
    const overlay = document.getElementById('kbd-overlay');
    if (overlay) overlay.classList.toggle('hidden');
  }

  // Escape = also close kbd overlay and bc expand menus
  if (e.key === 'Escape') {
    const overlay = document.getElementById('kbd-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

});

// Parse filter modal
buildParseModal();
document.getElementById('pm-select-all').addEventListener('click', () => {
  PARSE_FILTER_GROUPS.forEach(g => g.types.forEach(t => parseFilterKeys.add(t.key)));
  document.querySelectorAll('#parse-modal-box .fchip').forEach(c => c.classList.add('on'));
});
document.getElementById('pm-clear-all').addEventListener('click', () => {
  parseFilterKeys.clear();
  document.querySelectorAll('#parse-modal-box .fchip').forEach(c => c.classList.remove('on'));
});
document.getElementById('pm-confirm').addEventListener('click', async () => {
  excludeSystemFolders = document.getElementById('pm-exclude-system').checked;
  hideParseModal();
  if (pendingFile) await doLoadFile(pendingFile);
  pendingFile = null;
});
// Cancel modal by clicking background
document.getElementById('parse-modal-bg')?.addEventListener('click', () => {
  hideParseModal();
  pendingFile = null;
  document.getElementById('drop-zone').classList.remove('hidden');
});

// Filter panel
buildFilterPanel();
document.getElementById('btn-filter').addEventListener('click', () => {
  document.getElementById('filter-bar').classList.toggle('open');
});

document.getElementById('btn-load').addEventListener('click', () => {
  document.getElementById('file-input').click();
});
document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) loadFile(file);
  e.target.value = '';
});

document.getElementById('btn-regex').addEventListener('click', () => {
  regexMode = !regexMode;
  _searchCache = { key: null, result: null }; // regex mode change invalidates cached results
  const btn = document.getElementById('btn-regex');
  const input = document.getElementById('search');
  btn.classList.toggle('active', regexMode);
  input.classList.toggle('regex-active', regexMode);
  input.placeholder = regexMode ? 'Regular expression…' : 'Search… (a+b finds both)';
  if (searchQuery) { renderContentList(); updateStatus(); }
});

const searchClear = document.getElementById('search-clear');
searchClear.addEventListener('click', () => {
  const input = document.getElementById('search');
  input.value = '';
  searchQuery = '';
  searchClear.classList.remove('visible');
  document.getElementById('status-filter').textContent = '';
  renderContentList();
  updateStatus();
  input.focus();
});

document.getElementById('search').addEventListener('input', e => {
  const raw = e.target.value.trim();
  searchClear.classList.toggle('visible', raw.length > 0);

  // Always cancel any pending search first
  clearTimeout(_searchDebounceTimer);

  // Instant UI feedback: clear the pane immediately when query is cleared
  if (!raw) {
    searchQuery = '';
    _searchCache = { key: null, result: null };
    document.getElementById('status-filter').textContent = '';
    renderContentList();
    updateStatus();
    return;
  }

  // Don't start a global scan on a single character — the result set is enormous
  // and gives no useful signal. Show a prompt instead and wait for more input.
  if (raw.length < 2) {
    document.getElementById('status-filter').textContent = 'Type more to search…';
    return;
  }

  // Debounce: wait for typing to pause before running the expensive global scan.
  // 300ms clears a full inter-keystroke gap at normal typing speed (~200-250ms),
  // so intermediate characters are skipped entirely on large inventories.
  _searchDebounceTimer = setTimeout(() => {
    searchQuery = raw;
    _searchCache = { key: null, result: null };
    renderContentList();
    // Status bar reuses the now-cached result — no second scan
    if (searchQuery) {
      const contents = getSortedContents(currentCatId);
      document.getElementById('status-filter').textContent =
        `Search: "${searchQuery}" — ${contents.length.toLocaleString()} results`;
    }
    updateStatus();
  }, 300);
});

document.getElementById('btn-expand-all').addEventListener('click', () => {
  Object.keys(catMap).forEach(id => expandedNodes.add(id));
  renderTree();
});

document.getElementById('btn-collapse-all').addEventListener('click', () => {
  expandedNodes.clear();
  if (rootCatId) expandedNodes.add(rootCatId);
  renderTree();
});

document.querySelectorAll('.col-h').forEach(el => {
  el.addEventListener('click', () => setSortKey(el.dataset.sort));
});

// Remove unused sort arrows initially
document.querySelectorAll('.col-h:not(#sort-name) .sort-arrow').forEach(el => el.textContent = '');

// Restore persistent settings
const savedViewMode = localStorage.getItem('sl_inv_viewmode') || DEFAULT_VIEW;
if (savedViewMode === 'icons') {
  viewMode = 'icons';
  document.getElementById('btn-view-icons').classList.add('active');
  document.getElementById('btn-view-list').classList.remove('active');
  document.getElementById('size-slider-wrap').classList.remove('hidden');
} else {
  viewMode = 'list';
  document.getElementById('btn-view-list').classList.add('active');
  document.getElementById('btn-view-icons').classList.remove('active');
  document.getElementById('size-slider-wrap').classList.add('hidden');
}

const savedIconSize = parseInt(localStorage.getItem('sl_inv_iconsize'));
if (!isNaN(savedIconSize)) {
  applyIconSize(savedIconSize);
  document.getElementById('icon-size-slider').value = savedIconSize;
}
});
