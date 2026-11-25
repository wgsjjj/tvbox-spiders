/*
 * 瓜子影视 (ng9.app) —— TVBox csp 源 · 纯 JS 单文件
 * 分类 / 搜索 / 详情 / 播放全部自带，不需要任何服务端进程
 */

// ==================== AES-128-CBC（纯 JS） ====================
var SBOX = [
0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16];

var INV_SBOX = new Array(256);
for (var _i = 0; _i < 256; _i++) INV_SBOX[SBOX[_i]] = _i;

var RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function _xtime(a) { a <<= 1; return (a & 0x100) ? ((a ^ 0x1b) & 0xff) : a; }
function _mul(a, b) { var r = 0; while (b) { if (b & 1) r ^= a; a = _xtime(a); b >>= 1; } return r; }
function _sh(s, r, c) { return s[r + 4 * ((c + r) % 4)]; }
function _shi(s, r, c) { return s[r + 4 * ((c - r + 4) % 4)]; }

function _expand(key) {
  var ks = key.slice(0);
  for (var i = 16; i < 176; i += 4) {
    var t = ks.slice(i - 4, i);
    if (i % 16 === 0) {
      t = [t[1], t[2], t[3], t[0]];
      t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]];
      t[0] ^= RCON[i / 16 - 1];
    }
    for (var j = 0; j < 4; j++) ks.push(ks[i - 16 + j] ^ t[j]);
  }
  return ks;
}

function _encBlock(block, ks) {
  var s = [], i;
  for (i = 0; i < 16; i++) s.push(block[i] ^ ks[i]);
  for (var rnd = 1; rnd <= 10; rnd++) {
    var t = [];
    for (i = 0; i < 16; i++) t.push(SBOX[s[i]]);
    var m = new Array(16);
    for (i = 0; i < 16; i++) m[i] = _sh(t, i % 4, (i - i % 4) / 4);
    if (rnd !== 10) {
      var ns = new Array(16);
      for (var c = 0; c < 4; c++) {
        var a0 = m[c * 4], a1 = m[c * 4 + 1], a2 = m[c * 4 + 2], a3 = m[c * 4 + 3];
        ns[c * 4]     = _mul(a0, 2) ^ _mul(a1, 3) ^ a2 ^ a3;
        ns[c * 4 + 1] = a0 ^ _mul(a1, 2) ^ _mul(a2, 3) ^ a3;
        ns[c * 4 + 2] = a0 ^ a1 ^ _mul(a2, 2) ^ _mul(a3, 3);
        ns[c * 4 + 3] = _mul(a0, 3) ^ a1 ^ a2 ^ _mul(a3, 2);
      }
      m = ns;
    }
    for (i = 0; i < 16; i++) s[i] = m[i] ^ ks[rnd * 16 + i];
    s = s.slice(0);
  }
  return s;
}

function _decBlock(block, ks) {
  var s = [], i;
  for (i = 0; i < 16; i++) s.push(block[i] ^ ks[160 + i]);
  for (var rnd = 9; rnd >= 0; rnd--) {
    var t = new Array(16);
    for (i = 0; i < 16; i++) t[i] = _shi(s, i % 4, (i - i % 4) / 4);
    var m = new Array(16);
    for (i = 0; i < 16; i++) m[i] = INV_SBOX[t[i]];
    for (i = 0; i < 16; i++) s[i] = m[i] ^ ks[rnd * 16 + i];
    if (rnd !== 0) {
      var ns = new Array(16);
      for (var c = 0; c < 4; c++) {
        var a0 = s[c * 4], a1 = s[c * 4 + 1], a2 = s[c * 4 + 2], a3 = s[c * 4 + 3];
        ns[c * 4]     = _mul(a0, 14) ^ _mul(a1, 11) ^ _mul(a2, 13) ^ _mul(a3, 9);
        ns[c * 4 + 1] = _mul(a0, 9)  ^ _mul(a1, 14) ^ _mul(a2, 11) ^ _mul(a3, 13);
        ns[c * 4 + 2] = _mul(a0, 13) ^ _mul(a1, 9)  ^ _mul(a2, 14) ^ _mul(a3, 11);
        ns[c * 4 + 3] = _mul(a0, 11) ^ _mul(a1, 13) ^ _mul(a2, 9)  ^ _mul(a3, 14);
      }
      s = ns;
    }
  }
  return s;
}

// ---- UTF-8 ----
function _u2b(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
    else if (c >= 0xd800 && c < 0xdc00) {
      var c2 = str.charCodeAt(++i);
      var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
  }
  return out;
}

function _b2u(b) {
  var s = '', i = 0;
  while (i < b.length) {
    var c = b[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xe0) s += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
    else if (c < 0xf0) s += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
    else {
      var cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
      cp -= 0x10000;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
    }
  }
  return s;
}

function cbcEncrypt(text, key, iv) {
  var data = _u2b(text);
  var pad = 16 - (data.length % 16);
  for (var p = 0; p < pad; p++) data.push(pad);
  var ks = _expand(key);
  var prev = iv.slice(0), out = [];
  for (var off = 0; off < data.length; off += 16) {
    var blk = new Array(16);
    for (var i = 0; i < 16; i++) blk[i] = data[off + i] ^ prev[i];
    var enc = _encBlock(blk, ks);
    for (var j = 0; j < 16; j++) out.push(enc[j]);
    prev = enc;
  }
  return out;
}

function cbcDecrypt(bytes, key, iv) {
  var ks = _expand(key);
  var prev = iv.slice(0), out = [];
  for (var off = 0; off + 16 <= bytes.length; off += 16) {
    var blk = bytes.slice(off, off + 16);
    var dec = _decBlock(blk, ks);
    for (var i = 0; i < 16; i++) out.push(dec[i] ^ prev[i]);
    prev = blk;
  }
  if (out.length) {
    var pad = out[out.length - 1];
    if (pad > 0 && pad <= 16) out = out.slice(0, out.length - pad);
  }
  return out;
}

function toHex(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
  return s;
}

function fromHex(hex) {
  hex = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
  var out = [];
  for (var i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  return out;
}

// ==================== 站点参数 ====================
var AES_KEY = [0x31,0x38,0x31,0x63,0x63,0x38,0x38,0x33,0x34,0x30,0x61,0x65,0x35,0x62,0x32,0x62];
var AES_IV  = [0x34,0x34,0x32,0x33,0x64,0x31,0x65,0x32,0x37,0x37,0x33,0x34,0x37,0x36,0x63,0x65];

// 第一个是最新数据源，第二个是备用（数据较旧，只在前者不通时用）
var BASES = ['https://haiwaiapi.1fc8ab0.com', 'https://hyperf.718fd9f.com'];
// ==================== 播放方式（这一版新增，按你手机情况选一个） ====================
// 'https'  直连 https（默认）
// 'http'   直连 http（不走证书，有的播放器只吃这种）
// 'relay'  走电脑上的中转（手机连不上这个片的域名时用）
var PLAY = 'https';
var RELAY = 'http://192.168.1.100:8899';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var HDR = {
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'Origin': 'https://ng9.app',
  'Referer': 'https://ng9.app/'
};

// token 只是加速用；拿不到也照样能取数据
var STATE = { uid: null, token: null, base: 0, failAt: 0 };

// ==================== 网络 ====================
function _httpPost(url, body, headers) {
  var r = null;
  if (typeof request === 'function') r = request(url, { method: 'POST', body: body, headers: headers });
  else if (typeof req === 'function') r = req(url, { method: 'POST', body: body, headers: headers });
  else if (typeof $http !== 'undefined' && $http.post) r = $http.post(url, body, { headers: headers });
  if (r === null || r === undefined) throw new Error('无网络能力');
  if (typeof r === 'string') return r;
  if (r.content !== undefined) return r.content;
  if (r.body !== undefined) return r.body;
  if (r.data !== undefined) return r.data;
  return String(r);
}

function _uuid() {
  var s = '';
  for (var i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) s += '-';
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}

function encPayload(obj) { return toHex(cbcEncrypt(JSON.stringify(obj), AES_KEY, AES_IV)); }
function decPayload(hex) { return JSON.parse(_b2u(cbcDecrypt(fromHex(hex), AES_KEY, AES_IV))); }

// 单次请求：任何异常都往外抛，由上层换线路/换身份
function rawPost(base, path, payload) {
  var body = JSON.stringify({ params: encPayload(payload) });
  var txt = _httpPost(base + path, body, HDR);
  var obj = null;
  try { obj = JSON.parse(txt); } catch (e) { throw new Error('返回不是 JSON'); }
  if (obj && typeof obj.data === 'string' && obj.data) {
    try { obj.data = decPayload(obj.data); } catch (e) { obj.data = null; }
  }
  return obj;
}

// data 里到底有没有东西（code 不可信：这个站常见「code 300 但 data 是满的」）
function _hasData(d) {
  if (d === null || d === undefined) return false;
  if (typeof d === 'object') {
    if (Object.prototype.toString.call(d) === '[object Array]') return d.length > 0;
    for (var k in d) { if (k) return true; }
    return false;
  }
  return String(d).trim().length > 0;
}

// 两条线路都试；优先 code===200，其次「data 有内容」的那条
function callApi(path, payload, withToken) {
  var p = {}, k;
  payload = payload || {};
  for (k in payload) p[k] = payload[k];
  if (withToken && STATE.token) p.token = STATE.token;
  if (p.phone_type === undefined) p.phone_type = 3;

  var order = [STATE.base, 1 - STATE.base];
  var fallback = null, lastErr = null;
  for (var n = 0; n < order.length; n++) {
    var idx = order[n];
    try {
      var obj = rawPost(BASES[idx], path, p);
      if (!obj) continue;
      if (obj.code === 200 && _hasData(obj.data)) { STATE.base = idx; return obj; }
      if (_hasData(obj.data) && !fallback) fallback = { obj: obj, idx: idx };
    } catch (e) { lastErr = e; }
  }
  if (fallback) { STATE.base = fallback.idx; return fallback.obj; }
  if (lastErr) throw lastErr;
  return null;
}

// 设备注册拿 token：注册成功才算；失败的设备号直接丢掉换新的
function login() {
  for (var t = 0; t < 2; t++) {
    var uid = STATE.uid || _uuid();
    try {
      var obj = callApi('/Pc/Authentication/Device/signUp', { uid: uid, phone_type: 3 }, false);
      if (obj && obj.code === 200 && obj.data && obj.data.token) {
        STATE.uid = obj.data.uid || uid;
        STATE.token = obj.data.token;
        return true;
      }
    } catch (e) { }
    STATE.uid = null;
  }
  STATE.token = null;
  STATE.failAt = new Date().getTime();
  return false;
}

function ensureLogin() {
  if (STATE.token) return true;
  if (STATE.failAt && (new Date().getTime() - STATE.failAt) < 60000) return false;
  return login();
}

// 取数据的兜底顺序：带 token → 游客 → 重登再试。任何一环拿到内容就直接用
function apiSafe(path, payload) {
  ensureLogin();
  var r = null;
  if (STATE.token) { try { r = callApi(path, payload, true); } catch (e) { r = null; } }
  if (!r || !_hasData(r.data)) {
    try { var r0 = callApi(path, payload, false); if (r0 && _hasData(r0.data)) r = r0; } catch (e) { }
  }
  if (!r || (r.code !== 200 && !_hasData(r.data))) {
    STATE.token = null; STATE.failAt = 0;
    if (login()) {
      try { var r2 = callApi(path, payload, true); if (r2 && _hasData(r2.data)) r = r2; } catch (e) { }
    }
  }
  return r;
}

// 两套接口轮着试：新库 /H5(4) 优先，老库 /Pc(3) 兜底
var VER = [['/H5', 4], ['/Pc', 3]];
function apiV(path, payload) {
  for (var i = 0; i < VER.length; i++) {
    var p = {}, k;
    for (k in payload) p[k] = payload[k];
    p.phone_type = VER[i][1];
    var r = null;
    try { r = apiSafe(VER[i][0] + path, p); } catch (e) { r = null; }
    if (r && _hasData(r.data)) return r;
  }
  return null;
}

// 播放地址按 PLAY 方式改写
function playUrl(u) {
  u = String(u || '').trim();
  if (!/^https?:\/\//i.test(u)) return u;
  if (PLAY === 'http') return u.replace(/^https:/i, 'http:');
  if (PLAY === 'relay') {
    var base = String(RELAY || '').replace(/\/+$/, '');
    if (!base) return u;
    return base + '/m3u8?u=' + encodeURIComponent(u.replace(/^https:/i, 'http:'));
  }
  return u;
}

// https -> http（同一个地址，只是不走证书）
function toPlain(u) { return String(u || '').replace(/^https:/i, 'http:'); }

function dataOf(r) { return (r && _hasData(r.data)) ? r.data : null; }

// ==================== 数据转换 ====================
function fixPic(pic) {
  if (!pic) return '';
  pic = String(pic).trim();
  if (pic.indexOf('//') === 0) return 'https:' + pic;
  return pic;
}

function cleanText(v) {
  v = String(v === undefined || v === null ? '' : v).trim();
  if (v === '0' || v === 'null' || v === 'None' || v === '暂无') return '';
  return v;
}

// 分集名/线路名里出现 $ 或 # 会把播放列表切乱，统一换全角
function escName(s) {
  s = String(s === undefined || s === null ? '' : s).trim();
  return s.replace(/\$/g, '＄').replace(/#/g, '＃');
}

function stamp(v) {
  var s = String(v || '').substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 0;
  return parseInt(s.replace(/-/g, ''), 10) || 0;
}

function toItem(v) {
  return {
    vod_id: String(v.vod_id || v.id || ''),
    vod_name: String(v.vod_name || v.c_name || '').trim(),
    vod_pic: fixPic(v.vod_pic || v.c_pic || ''),
    vod_remarks: cleanText(v.new_continue || v.vod_continu || v.vod_title || ''),
    vod_year: String(v.vod_year || '').substring(0, 4),
    _t: stamp(v.vod_year || v.vod_addtime)
  };
}

var TEST_WORDS = ['测试', 'sassa', 'dasol', 'jaki', '123123'];
function isJunk(name) {
  name = String(name || '');
  if (!name || !name.trim()) return true;
  var low = name.toLowerCase();
  for (var i = 0; i < TEST_WORDS.length; i++) if (low.indexOf(TEST_WORDS[i]) >= 0) return true;
  return false;
}

// 最新的排前面；1970 这类脏日期沉底
function byNewest(a, b) {
  if (a._t !== b._t) return b._t - a._t;
  return 0;
}

function strip(list) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    delete it._t;
    out.push(it);
  }
  return out;
}

function rankResults(list, kw) {
  kw = String(kw || '').trim();
  if (!kw) return list;
  var bigrams = [];
  for (var i = 0; i < kw.length - 1; i++) bigrams.push(kw.substr(i, 2));
  var scored = [];
  for (var n = 0; n < list.length; n++) {
    var it = list[n];
    var name = it.vod_name;
    var score = 0;
    if (name === kw) score = 100;
    else if (name.indexOf(kw) === 0) score = 90;
    else if (name.indexOf(kw) >= 0) score = 80;
    else {
      var hits = 0;
      for (var b = 0; b < bigrams.length; b++) if (name.indexOf(bigrams[b]) >= 0) hits++;
      if (bigrams.length && hits === bigrams.length) score = 60;
      else if (hits > 0) score = 20 + hits * 5;
    }
    if (score > 0) { it._s = score; scored.push(it); }
  }
  scored.sort(function (a, b) {
    if (a._s !== b._s) return b._s - a._s;
    return b._t - a._t;
  });
  for (var m = 0; m < scored.length; m++) delete scored[m]._s;
  return scored;
}

function fetchList(tid, page, kw, pageSize) {
  var ck = 'ls_' + tid + '_' + page + '_' + pageSize + '_' + (kw || '');
  var hit = cacheGet(ck, 30000);
  if (hit) return hit;
  var r = apiV('/Search/GetConditionList', {
    tid: parseInt(tid, 10) || 0,
    area: '0',
    year: '0',
    sort: 'd_id',
    keywords: kw || '',
    page: parseInt(page, 10) || 1,
    pageSize: pageSize || 30
  });
  var d = dataOf(r);
  if (!d) return { list: [], total: 0 };
  var raw = d.list || [];
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var it = toItem(raw[i]);
    if (isJunk(it.vod_name)) continue;
    out.push(it);
  }
  return cacheSet(ck, { list: out, total: parseInt(d.total, 10) || 0 });
}

function searchAll(kw, page) {
  // 源站搜索越大越慢，20 条一次最划算
  var a = fetchList('0', page, kw, 20);
  return { list: rankResults(a.list, kw), total: a.total };
}

function getDetail(vodId) {
  var ck = 'dt_' + vodId;
  var hit = cacheGet(ck, 300000);
  if (hit) return hit;
  var r = apiV('/Resource/GetVodInfo', { vod_id: parseInt(vodId, 10) });
  var d = dataOf(r);
  if (!d) return null;
  var info = d.vodInfo || d;
  if (!info || !info.vod_name) return null;
  return cacheSet(ck, info);
}

var CACHE = {};
function cacheGet(key, ttl) {
  var c = CACHE[key];
  if (c && (new Date().getTime() - c.t) < (ttl || 60000)) return c.v;
  return null;
}
function cacheSet(key, v) {
  CACHE[key] = { t: new Date().getTime(), v: v };
  return v;
}

function getPlayUrls(vodId) {
  var ck = 'pl_' + vodId;
  var hit = cacheGet(ck, 120000);
  if (hit) return hit;

  var urls = [], page = 1, total = 0;
  while (page <= 8) {
    var r = apiV('/Resource/GetOnePlayList', { vod_id: parseInt(vodId, 10), page: page, pageSize: 300 });
    var d = dataOf(r);
    if (!d) break;
    var batch = d.urls || [];
    if (!total) total = parseInt(d.total_vod_vurl, 10) || 0;
    for (var i = 0; i < batch.length; i++) urls.push(batch[i]);
    if (!batch.length) break;
    if (total && urls.length >= total) break;
    page++;
  }

  // 排序：按 sort，其次按名字里的数字（短剧接口偶尔 sort 为空）
  urls.sort(function (a, b) {
    var sa = parseInt(a.sort, 10), sb = parseInt(b.sort, 10);
    if ((sa || 0) !== (sb || 0)) return (sa || 0) - (sb || 0);
    var na = parseInt(String(a.name || '').replace(/\D/g, ''), 10) || 0;
    var nb = parseInt(String(b.name || '').replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  var out = [], seen = {};
  for (var n = 0; n < urls.length; n++) {
    var vid = urls[n].vurl_id;
    if (vid) {
      if (seen[vid]) continue;
      seen[vid] = 1;
    }
    var url = String(urls[n].url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    var name = escName(cleanText(urls[n].name)) || ('第' + (out.length + 1) + '集');
    out.push({ name: name, url: playUrl(url) });
  }
  return cacheSet(ck, out);
}

// ==================== csp 源 ====================
var rule = {
  title: '瓜子影视',
  host: 'https://ng9.app',
  homeUrl: '/home',
  searchable: 1,
  quickSearch: 1,
  filterable: 0,
  headers: { 'User-Agent': UA, 'Referer': 'https://ng9.app/' },
  class_name: '最新更新&电影&电视剧&综艺&动漫&短剧',
  class_url: '0&1&2&3&4&64',

  一级: function (ids, pg) {
    var tid = '0';
    if (ids !== undefined && ids !== null) {
      if (typeof ids === 'string' && /^\d+$/.test(ids)) tid = ids;
      else if (typeof ids === 'number') tid = String(ids);
      else if (ids && ids.id !== undefined) tid = String(ids.id);
    }
    var page = parseInt(pg, 10) || 1;
    var r = fetchList(tid, page, '', 30);
    r.list.sort(byNewest);
    return {
      page: page,
      pagecount: r.total > 0 ? Math.min(9999, Math.ceil(r.total / 30)) : 9999,
      list: strip(r.list)
    };
  },

  搜索: function (wd, quick, pg) {
    var page = parseInt(pg, 10) || 1;
    var r = searchAll(String(wd || ''), page);
    return {
      page: page,
      pagecount: r.total > 0 ? Math.min(20, Math.ceil(r.total / 30)) : page + 1,
      list: strip(r.list)
    };
  },

  二级: function (ids, orId) {
    var vodId = String(orId || ids || '').split('$')[0];
    var info = getDetail(vodId) || {};
    var plays = getPlayUrls(vodId);

    // 同一批集数，出两条线路：一条 https 直连，一条明文 http
    // 播放器里哪条能播就点哪条，不用改配置
    var p1 = [], p2 = [];
    for (var i = 0; i < plays.length; i++) {
      var u = plays[i].url;
      p1.push(plays[i].name + '$' + u);
      p2.push(plays[i].name + '$' + toPlain(u));
    }

    var lines = [];
    if (info.vod_use_content) lines.push(String(info.vod_use_content).trim());
    if (info.videoTag) lines.push('类型：' + info.videoTag);
    if (info.vod_actor) lines.push('主演：' + info.vod_actor);
    if (info.vod_director) lines.push('导演：' + info.vod_director);
    if (info.vod_area) lines.push('地区：' + info.vod_area);
    if (info.vod_year) lines.push('上映：' + String(info.vod_year).substring(0, 10));
    if (info.vod_total) lines.push('集数：' + String(info.vod_total));
    if (!plays.length) {
      lines.push('');
      lines.push('这次没有取到播放地址，退回上一页重新点进来一次通常就有了。');
    } else {
      lines.push('');
      lines.push('播不出来就切到上一条线路（播放器里换线路），两条走的是同一批片源。');
    }
    var content = lines.filter(function (x) { return !!x; }).join('\n');

    return {
      list: [{
        vod_id: vodId,
        vod_name: info.vod_name || '',
        vod_pic: fixPic(info.pic || info.vod_pic || ''),
        vod_year: String(info.vod_year || '').substring(0, 4),
        vod_area: info.vod_area || '',
        vod_remarks: cleanText(info.vod_title || info.vod_continu),
        vod_content: content,
        vod_play_from: '瓜子影视$$$备用线路',
        vod_play_url: p1.join('#') + '$$$' + p2.join('#')
      }]
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    rule: rule,
    _t: {
      cbcEncrypt: cbcEncrypt, cbcDecrypt: cbcDecrypt, toHex: toHex, fromHex: fromHex,
      encPayload: encPayload, decPayload: decPayload, login: login, apiSafe: apiSafe,
      STATE: STATE, apiV: apiV, playUrl: playUrl, toPlain: toPlain, fetchList: fetchList, searchAll: searchAll, getDetail: getDetail,
      getPlayUrls: getPlayUrls, rankResults: rankResults
    }
  };
}
