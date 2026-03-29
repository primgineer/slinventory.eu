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
const ASSET_TYPE = {
'-1':'Unknown', 0:'Texture', 1:'Sound', 2:'Calling Card', 3:'Landmark',
5:'Clothing', 6:'Object', 7:'Notecard', 8:'Folder', 9:'Root Folder',
10:'Script', 11:'Script Bytecode', 12:'Texture (TGA)', 13:'Body Part',
14:'Trash', 15:'Snapshots', 16:'Lost & Found', 17:'Sound (WAV)',
18:'Image (TGA)', 19:'Image (JPEG)', 20:'Animation', 21:'Gesture',
22:'Simstate', 24:'Favorites', 45:'Link', 46:'Folder Link',
49:'Marketplace', 50:'Mesh', 56:'Settings', 57:'Material',
};

const FOLDER_TYPE = {
'-1':'Folder', 0:'Textures', 1:'Sounds', 2:'Calling Cards', 3:'Landmarks',
5:'Clothing', 6:'Objects', 7:'Notecards', 8:'Folder', 9:'My Inventory',
10:'Scripts', 13:'Body Parts', 14:'Trash', 15:'Snapshots',
16:'Lost & Found', 20:'Animations', 21:'Gestures', 45:'Links',
46:'Folder Links', 49:'Marketplace', 50:'Meshes', 56:'Settings', 57:'Materials',
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
trash:        `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.5 8h5l.5-8" stroke="#e85555" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/></svg>`,
calling_card: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1.5" fill="#9b6dff" opacity=".12" stroke="#9b6dff" stroke-width="1.2"/><circle cx="5.5" cy="7" r="1.2" fill="#9b6dff" opacity=".7"/><line x1="8" y1="6.5" x2="12" y2="6.5" stroke="#9b6dff" stroke-width="1" stroke-linecap="round" opacity=".5"/><line x1="8" y1="8.5" x2="10.5" y2="8.5" stroke="#9b6dff" stroke-width="1" stroke-linecap="round" opacity=".4"/></svg>`,
lost_found:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" fill="#e8a630" opacity=".1" stroke="#e8a630" stroke-width="1.2"/><text x="8" y="11.5" text-anchor="middle" font-family="monospace" font-size="8" fill="#e8a630" font-weight="bold">?</text></svg>`,
snapshot:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="9" rx="1.2" fill="none" stroke="#3dba7f" stroke-width="1.2"/><circle cx="8" cy="8.5" r="2" stroke="#3dba7f" stroke-width="1.2"/><path d="M5.5 4l.8-1.5h3.4L10.5 4" stroke="#3dba7f" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
link:         `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5a3 3 0 0 0 4.2.1l1.8-1.8a3 3 0 0 0-4.2-4.2L7.2 4.7" stroke="#4a9eff" stroke-width="1.3" stroke-linecap="round" opacity=".7"/><path d="M9.5 6.5a3 3 0 0 0-4.2-.1L3.5 8.2a3 3 0 0 0 4.2 4.2l1.1-1.1" stroke="#4a9eff" stroke-width="1.3" stroke-linecap="round"/></svg>`,
unknown:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="#5a6a80" stroke-width="1.2"/><text x="8" y="11" text-anchor="middle" font-family="monospace" font-size="8" fill="#5a6a80">?</text></svg>`,
};

function getIconForCategory(folderType) {
const t = parseInt(folderType);
const map = {
  0:'texture', 1:'sound', 2:'calling_card', 3:'landmark',
  5:'clothing', 6:'object', 7:'notecard', 10:'script',
  13:'bodypart', 14:'trash', 15:'snapshot', 16:'lost_found',
  20:'animation', 21:'gesture', 45:'link', 46:'link',
  50:'mesh', 56:'settings', 57:'settings',
};
return ICONS[map[t] || 'folder'];
}

function getIconForItem(assetType) {
const t = parseInt(assetType);
const map = {
  0:'texture', 1:'sound', 2:'calling_card', 3:'landmark',
  5:'clothing', 6:'object', 7:'notecard', 10:'script',
  11:'script', 12:'texture', 13:'bodypart', 14:'trash',
  15:'snapshot', 16:'lost_found', 17:'sound', 18:'texture',
  19:'texture', 20:'animation', 21:'gesture', 45:'link',
  46:'link', 50:'mesh', 56:'settings', 57:'settings',
};
return ICONS[map[t] || 'unknown'];
}

function getFolderTypeName(ft) {
return FOLDER_TYPE[ft] || FOLDER_TYPE[-1];
}

function getAssetTypeName(at) {
return ASSET_TYPE[at] || `Type ${at}`;
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
let viewMode = 'list'; // 'list' | 'icons'
let iconSize = 100;
// activeTypeFilter: Set of canonical type keys (strings like 'texture','sound',…,'folder')
// Empty set = no filter = show all
let activeTypeFilter = new Set();
let regexMode = false;  // toggled by the .* button

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
}

function countDescendantItems(catId) {
let count = (catItems[catId] || []).length;
for (const cid of (catChildren[catId] || []))
  count += countDescendantItems(cid);
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
icon.innerHTML = isExpanded ? ICONS.folder_open : getIconForCategory(ft);

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

function renderBreadcrumb() {
const bc = document.getElementById('breadcrumb');
bc.innerHTML = '';
navStack.forEach((item, i) => {
  if (i > 0) {
    const sep = document.createElement('span');
    sep.className = 'bc-sep'; sep.textContent = '›';
    bc.appendChild(sep);
  }
  const el = document.createElement('span');
  el.className = 'bc-item' + (i === navStack.length - 1 ? ' current' : '');
  el.textContent = item.name;
  if (i < navStack.length - 1) el.addEventListener('click', () => navigateTo(item.id));
  bc.appendChild(el);
});
}

// Canonical type key for an item, matching the keys used in getIconForItem map
function itemTypeKey(item) {
const t = item.type;
const iconMap = {
  0:'texture', 1:'sound', 2:'calling_card', 3:'landmark',
  5:'clothing', 6:'object', 7:'notecard', 10:'script',
  11:'script', 12:'texture', 13:'bodypart', 14:'trash',
  15:'snapshot', 16:'lost_found', 17:'sound', 18:'texture',
  19:'texture', 20:'animation', 21:'gesture', 45:'link',
  46:'link', 50:'mesh', 56:'settings', 57:'settings',
};
if (typeof t === 'number') return iconMap[t] || 'unknown';
if (typeof t === 'string') {
  const n = parseInt(t);
  if (!isNaN(n)) return iconMap[n] || t.toLowerCase();
  return t.toLowerCase();
}
return 'unknown';
}

function passesTypeFilter(entry) {
if (activeTypeFilter.size === 0) return true;
if (entry._isFolder) return activeTypeFilter.has('folder');
return activeTypeFilter.has(itemTypeKey(entry));
}

function getSortedContents(catId) {
const matcher = buildMatcher(searchQuery);

let folders, its;

if (searchQuery) {
  const matchedFolderIds = new Set();
  const matchedItems = [];
  for (const [id, cat] of Object.entries(catMap)) {
    if (matcher(cat.name || '')) matchedFolderIds.add(id);
  }
  for (const items of Object.values(catItems)) {
    for (const item of items) {
      if (matcher(item.name || '')) matchedItems.push(item);
    }
  }
  folders = [...matchedFolderIds].map(id => ({ _isFolder: true, _id: id, ...catMap[id] }));
  its = matchedItems;
} else {
  folders = (catChildren[catId] || []).map(id => ({ _isFolder: true, _id: id, ...catMap[id] }));
  its = catItems[catId] || [];
}

// Apply type filter
folders = folders.filter(passesTypeFilter);
its = its.filter(passesTypeFilter);

const sortFn = (a, b) => {
  let va, vb;
  if (sortKey === 'name') { va = (a.name||'').toLowerCase(); vb = (b.name||'').toLowerCase(); }
  else if (sortKey === 'type') {
    va = a._isFolder ? 'folder' : getAssetTypeName(a.type || -1);
    vb = b._isFolder ? 'folder' : getAssetTypeName(b.type || -1);
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
return [...folders, ...its];
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
    return escHtml(text).replace(new RegExp(raw, 'gi'), m => `<span class="hl">${escHtml(m)}</span>`);
  } catch { return escHtml(text); }
}

// Multi-word AND: highlight each term separately
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

function renderContentList() {
const list = document.getElementById('content-list');
const colHeader = document.getElementById('col-header');
if (!currentCatId) return;

const contents = getSortedContents(currentCatId);

if (viewMode === 'icons') {
  colHeader.style.display = 'none';
  list.innerHTML = '';
  if (contents.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="es-icon">📭</div><div class="es-text">This folder is empty</div></div>';
    return;
  }
  renderIconGrid(list, contents);
} else {
  colHeader.style.display = '';
  list.innerHTML = '';
  if (contents.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="es-icon">📭</div><div class="es-text">This folder is empty</div></div>';
    return;
  }
  renderListRows(list, contents);
}
}

function renderListRows(list, contents) {
const frag = document.createDocumentFragment();
for (const entry of contents) {
  const row = document.createElement('div');
  row.className = 'list-row' + (isSelectedEntry(entry) ? ' selected' : '');

  const ft = entry.preferred_type ?? entry.type_default ?? -1;
  const at = entry.type ?? -1;
  const iconSvg = entry._isFolder ? getIconForCategory(ft) : getIconForItem(at);
  const typeName = entry._isFolder ? getFolderTypeName(ft) : getAssetTypeName(at);
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

  row.addEventListener('click', () => selectEntry(entry));
  row.addEventListener('dblclick', () => { if (entry._isFolder) navigateTo(entry._id); });
  frag.appendChild(row);
}
list.appendChild(frag);
}

// ── Texture detection ──────────────────────────────────────────
// type field can be integer OR string (from JSON enrichment or raw parse)
const TEXTURE_ASSET_TYPES_INT = new Set([0, 12, 18, 19]);
const TEXTURE_ASSET_TYPES_STR = new Set(['texture', 'image_tga', 'image_jpeg', 'texture_tga']);

function isTextureType(typeVal) {
if (typeVal == null) return false;
if (typeof typeVal === 'number') return TEXTURE_ASSET_TYPES_INT.has(typeVal);
const s = String(typeVal).toLowerCase();
return TEXTURE_ASSET_TYPES_INT.has(parseInt(s)) || TEXTURE_ASSET_TYPES_STR.has(s);
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
  if (isTextureType(item.type) && itemHasAssetId(item)) return item.asset_id;
}
for (const cid of (catChildren[catId] || [])) {
  for (const item of (catItems[cid] || [])) {
    if (isTextureType(item.type) && itemHasAssetId(item)) return item.asset_id;
  }
}
return null;
}

function openLightbox(assetId, name) {
const lb = document.getElementById('lightbox');
const img = document.getElementById('lightbox-img');
const lbName = document.getElementById('lightbox-name');
img.src = thumbUrl(assetId).replace('256x192', '512x512'); // ask for bigger size
// Fallback: if 512 fails, try 256
img.onerror = () => { img.src = thumbUrl(assetId); img.onerror = null; };
lbName.textContent = name || '';
lb.classList.remove('hidden');
}

function closeLightbox() {
const lb = document.getElementById('lightbox');
lb.classList.add('hidden');
const img = document.getElementById('lightbox-img');
img.src = '';
}

function thumbUrl(assetId) {
return `https://picture-service.secondlife.com/${assetId}/256x192.jpg`;
}

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
// The folder shape is an SVG with a foreignObject or clipPath so the
// thumbnail image fills the inside of the folder icon shape.
// We use a CSS clip-path approach: the folder body rect + tab rect,
// composed as an SVG with an <image> inside.
function buildFolderThumbCell(entry) {
// Returns the thumb-area element for a folder in icon view
const wrap = document.createElement('div');
wrap.className = 'folder-icon-wrap';

const thumbAssetId = getFolderThumbAssetId(entry._id);

if (thumbAssetId) {
  // SVG folder shape with embedded <image> that fills the inside
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
  // Folder tab (top-left bump)
  const tab = document.createElementNS(svgNS, 'path');
  tab.setAttribute('d', 'M4 22 Q4 16 10 16 L34 16 Q38 16 40 20 L46 28 L96 28 Q98 28 98 30 L98 76 Q98 78 96 78 L4 78 Q2 78 2 76 L2 24 Q2 22 4 22 Z');
  clip.appendChild(tab);
  defs.appendChild(clip);
  svg.appendChild(defs);

  // Folder background (visible even before image loads)
  const bg = document.createElementNS(svgNS, 'path');
  bg.setAttribute('d', 'M4 22 Q4 16 10 16 L34 16 Q38 16 40 20 L46 28 L96 28 Q98 28 98 30 L98 76 Q98 78 96 78 L4 78 Q2 78 2 76 L2 24 Q2 22 4 22 Z');
  bg.setAttribute('fill', '#1e2e44');
  bg.setAttribute('stroke', '#4a9eff');
  bg.setAttribute('stroke-width', '1.5');
  bg.setAttribute('opacity', '0.9');
  svg.appendChild(bg);

  // Image clipped to folder shape — starts invisible
  const img = document.createElementNS(svgNS, 'image');
  img.setAttribute('href', '');
  img.setAttribute('x', '2'); img.setAttribute('y', '28');
  img.setAttribute('width', '96'); img.setAttribute('height', '50');
  img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  img.setAttribute('clip-path', `url(#${clipId})`);
  img.style.opacity = '0';
  img.style.transition = 'opacity 0.3s';
  svg.appendChild(img);

  // Folder outline on top (gives the folder shape crisp edges over image)
  const outline = document.createElementNS(svgNS, 'path');
  outline.setAttribute('d', 'M4 22 Q4 16 10 16 L34 16 Q38 16 40 20 L46 28 L96 28 Q98 28 98 30 L98 76 Q98 78 96 78 L4 78 Q2 78 2 76 L2 24 Q2 22 4 22 Z');
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', '#4a9eff');
  outline.setAttribute('stroke-width', '1.8');
  outline.setAttribute('opacity', '0.85');
  svg.appendChild(outline);

  wrap.appendChild(svg);

  // Load image — set href once constructed
  const url = thumbUrl(thumbAssetId);
  const testImg = new Image();
  testImg.onload = () => {
    img.setAttribute('href', url);
    img.style.opacity = '1';
    thumbCache[thumbAssetId] = 'ok';
  };
  testImg.onerror = () => { thumbCache[thumbAssetId] = 'error'; };
  testImg.src = url;

} else {
  // Plain folder SVG, no thumbnail
  wrap.innerHTML = `<svg viewBox="0 0 100 80" width="100" height="80" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 22 Q4 16 10 16 L34 16 Q38 16 40 20 L46 28 L96 28 Q98 28 98 30 L98 76 Q98 78 96 78 L4 78 Q2 78 2 76 L2 24 Q2 22 4 22 Z"
      fill="#1e2e44" stroke="#4a9eff" stroke-width="1.8" opacity="0.9"/>
  </svg>`;
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
  const at = entry.type ?? -1;
  const typeName = entry._isFolder ? getFolderTypeName(ft) : getAssetTypeName(at);

  // ── Visual area ────────────────────────────────────────────
  if (entry._isFolder) {
    cell.appendChild(buildFolderThumbCell(entry));

  } else if (isTextureType(at) && itemHasAssetId(entry)) {
    // Texture item: thumbnail in a rounded box with spinner
    const thumbBox = document.createElement('div');
    thumbBox.className = 'thumb-box';

    const spinWrap = document.createElement('div');
    spinWrap.className = 'thumb-icon';
    spinWrap.innerHTML = `<div class="thumb-spin"></div>`;
    thumbBox.appendChild(spinWrap);

    const img = document.createElement('img');
    img.alt = '';
    thumbBox.appendChild(img);
    loadThumb(img, entry.asset_id, () => {
      thumbBox.classList.add('img-loaded');
      spinWrap.style.display = 'none';
    });
    cell.appendChild(thumbBox);

  } else {
    // Other item type: scaled SVG icon in a box
    const thumbBox = document.createElement('div');
    thumbBox.className = 'thumb-box';
    const iconDiv = document.createElement('div');
    iconDiv.className = 'thumb-icon';
    const iconSvg = getIconForItem(at);
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

  cell.addEventListener('click', () => selectEntry(entry));
  cell.addEventListener('dblclick', () => {
    if (entry._isFolder) {
      navigateTo(entry._id);
    } else if (isTextureType(at) && itemHasAssetId(entry)) {
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
renderContentList();
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
  const at = entry.type ?? -1;
  dsIcon.innerHTML = `<div style="width:32px;height:32px;">${getIconForItem(at)}</div>`;
  dsName.textContent = entry.name || '(unnamed)';
  dsType.textContent = getAssetTypeName(at);

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
]},
{ label: 'Wearables', types: [
  { key: 'texture',      label: 'Textures',     icon: 'texture'      },
  { key: 'clothing',     label: 'Clothing',     icon: 'clothing'     },
  { key: 'bodypart',     label: 'Body Parts',   icon: 'bodypart'     },
  { key: 'calling_card', label: 'Calling Cards',icon: 'calling_card' },
  { key: 'snapshot',     label: 'Snapshots',    icon: 'snapshot'     },
  { key: 'link',         label: 'Links',        icon: 'link'         },
  { key: 'lost_found',   label: 'Lost & Found', icon: 'lost_found'   },
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
  { key: 'object',       label: 'Objects',    icon: 'object'    },
  { key: 'notecard',     label: 'Notecards',  icon: 'notecard'  },
  { key: 'script',       label: 'Scripts',    icon: 'script'    },
  { key: 'mesh',         label: 'Meshes',     icon: 'mesh'      },
  { key: 'animation',    label: 'Animations', icon: 'animation' },
  { key: 'gesture',      label: 'Gestures',   icon: 'gesture'   },
  { key: 'landmark',     label: 'Landmarks',  icon: 'landmark'  },
  { key: 'sound',        label: 'Sounds',     icon: 'sound'     },
  { key: 'settings',     label: 'Settings',   icon: 'settings'  },
]},
{ id: 'wearables', label: 'Wearables', types: [
  { key: 'texture',      label: 'Textures',     icon: 'texture'      },
  { key: 'clothing',     label: 'Clothing',     icon: 'clothing'     },
  { key: 'bodypart',     label: 'Body Parts',   icon: 'bodypart'     },
  { key: 'calling_card', label: 'Calling Cards',icon: 'calling_card' },
  { key: 'snapshot',     label: 'Snapshots',    icon: 'snapshot'     },
  { key: 'link',         label: 'Links',        icon: 'link'         },
]},
];

// Maps parse filter key → LLSD type strings/ints to keep
const PARSE_KEY_TO_TYPES = {
category:     ['category', 8, 9],
object:       ['object', 6],
notecard:     ['notecard', 7],
script:       ['lsl_text', 'lsl_bytecode', 10, 11],
mesh:         ['mesh', 50],
animation:    ['animation', 20],
gesture:      ['gesture', 21],
landmark:     ['landmark', 3],
sound:        ['sound', 1, 17],
settings:     ['settings', 56],
texture:      ['texture', 'image_tga', 'image_jpeg', 0, 12, 18, 19],
clothing:     ['clothing', 5],
bodypart:     ['bodypart', 13],
calling_card: ['calling_card', 2],
snapshot:     ['snapshot', 15],
link:         ['link', 45, 46],
};

let pendingFile = null;          // file waiting for modal confirm
let parseFilterKeys = new Set(); // keys selected in modal; empty = load all
let excludeSystemFolders = false;

// preferred_type values that identify system/library folders to exclude
const SYSTEM_FOLDER_TYPES = new Set([
  'bodypart', 'callcard', 'clothing', 'current', 'favorite',
  'my_otfts', 'gesture', 'landmark', 'lstndfnd', 'material',
  'notecard', 'snapshot', 'inbox', 'lsltext', 'settings',
  'sound', 'texture', 'trash',
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
    const allowedTypes = new Set();
    for (const key of parseFilterKeys) {
      for (const t of (PARSE_KEY_TO_TYPES[key] || [])) allowedTypes.add(String(t));
    }
    const keepCategories = parseFilterKeys.has('category');
    categories = keepCategories ? categories : [];
    items = items.filter(item => allowedTypes.has(String(item.type ?? '')));
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

    // Restore parse filter state from the saved snapshot
    parseFilterKeys     = new Set(session.parseFilter || []);
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
let dragging = false, startX = 0, startW = 0;

resizer.addEventListener('mousedown', e => {
  dragging = true; startX = e.clientX; startW = leftEl.offsetWidth;
  resizer.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});
document.addEventListener('mousemove', e => {
  if (!dragging) return;
  const newW = Math.max(160, Math.min(600, startW + e.clientX - startX));
  leftEl.style.width = newW + 'px';
  if (leftId === 'tree-panel') leftEl.style.minWidth = leftEl.style.maxWidth = '';
});
document.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  resizer.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});
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
  renderContentList();
});

document.getElementById('btn-view-icons').addEventListener('click', () => {
  viewMode = 'icons';
  document.getElementById('btn-view-icons').classList.add('active');
  document.getElementById('btn-view-list').classList.remove('active');
  document.getElementById('size-slider-wrap').classList.remove('hidden');
  renderContentList();
});

document.getElementById('icon-size-slider').addEventListener('input', e => {
  applyIconSize(parseInt(e.target.value));
  // No need to re-render — CSS variable change reflowed by browser automatically
});

// Lightbox: close on bg click, X button, or ESC
document.getElementById('lightbox-bg').addEventListener('click', closeLightbox);
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
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
      // Icons grid: calculate columns from CSS variable
      const grid = document.querySelector('.icon-grid');
      const cols = grid ? Math.round(grid.offsetWidth / (iconSize + 24 + 6)) : 4;
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
      const at = selectedItem.type ?? -1;
      if (isTextureType(at) && itemHasAssetId(selectedItem)) {
        openLightbox(selectedItem.asset_id, selectedItem.name);
      }
    }
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
  searchQuery = e.target.value.trim();
  searchClear.classList.toggle('visible', searchQuery.length > 0);
  renderContentList();
  // Update status to show result count during search
  if (searchQuery) {
    const contents = getSortedContents(currentCatId);
    document.getElementById('status-filter').textContent =
      `Search: "${searchQuery}" — ${contents.length.toLocaleString()} results`;
  } else {
    document.getElementById('status-filter').textContent = '';
  }
  updateStatus();
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
});