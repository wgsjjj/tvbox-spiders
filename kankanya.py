# -*- coding: utf-8 -*-
"""看看鸭（kankanya.me）TVBox py 蜘蛛。

接口按 TVBox 官方模板：从 base.spider 继承，实现 homeContent / categoryContent /
detailContent / searchContent / playerContent。

三道门槛的解法：
  1) 人机验证  POST /robot.php，value/token 用页面里的 encrypt()（62 字符表 +3 位移
     + 左右各塞一个随机字符 + btoa）
  2) 播放密文   player_aaaa.url → POST /kkyplayer/api.php → data.url（还要再解一次）
  3) 播放解密   urlmode=1 是「md5('test') 循环异或 → base64 → 三段拆分 →
     首段/次段是索引表 → 字典还原」；urlmode=2 是「三层一跳字符位移」。
     两个都纯 Python 算，不依赖任何外部程序。
"""

import base64
import hashlib
import json
import random
import re

from base.spider import Spider as BaseSpider


class Spider(BaseSpider):
    # ---------------------------------------------------------------- 常量
    # 备选域名：同一个站点有多个入口，**线路数量不一样**。
    # 实测（2026-11-15，「谷雨」）：
    #   kankanya.pro → 10 条线（自营b/c/e/f/g/h、FF有广/LZ有广/BF有广/YZ有广）
    #   kankanya.me  →  6 条线（地址2/3/5/6/7/8）
    # 所以不能钉死一个域名，按顺序探测，谁的线路多用谁。
    HOSTS = [
        "https://kankanya.pro",
        "https://www.kankanya.me",
        "https://kankanya.me",
    ]
    HOST = "https://kankanya.pro"   # 运行时会被探测结果覆盖
    UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    # 页面 encrypt() 用的字符表（62 个）
    TABLE62 = "PXhw7UT1B0a9kQDKZsjIASmOezxYG4CHo5Jyfg2b8FLpEvRr3WtVnlqMidu6cN"

    # 分类：站点 slug -> 显示名
    CATS = [
        ("dianying", "电影"),
        ("juji", "剧集"),
        ("zongyi", "综艺"),
        ("dongman", "动漫"),
    ]

    def __init__(self):
        self.extend = ""
        self.session = None
        self.verified = False

    def getName(self):
        return "看看鸭"

    def init(self, extend=""):
        self.extend = extend or ""
        self.session = self._new_session()
        self.verified = False
        self._host_picked = False
        # 播放接口域名：`/kkyplayer/api.php` 只在 kankanya.me 上存在，
        # kankanya.pro 返回 404（实测 2026-11-16）。
        # 所以「页面用线路多的域名，播放接口用能用的域名」，两边都不能少。
        self.play_host = None

    def _pick_play_host(self):
        """找一个真正能响应 /kkyplayer/api.php 的域名。

        站点把「页面」和「播放接口」拆在不同域名上：
          · kankanya.pro  → 详情页 10 条线路，但 /kkyplayer/api.php 是 404
          · kankanya.me   → 详情页 6 条线路，播放接口正常
        只用 .pro 的话，列表/线路都很全，一播放就空。
        """
        if self.play_host:
            return self.play_host
        for h in self.HOSTS:
            try:
                r = self.session.post(
                    h + "/kkyplayer/api.php",
                    data={"vid": "probe"},
                    timeout=12,
                    headers={"Referer": h + "/", "Origin": h,
                             "X-Requested-With": "XMLHttpRequest"},
                )
                if r.status_code == 200:
                    self.play_host = h
                    return h
            except Exception:
                continue
        # 都不行就用主域名兜底
        self.play_host = self.HOST
        return self.play_host

    def _pick_host(self):
        """探测哪个域名可用、且线路最多。

        只在第一次需要时跑（每个实例一次），失败的域名记下来不再试。
        """
        if self._host_picked:
            return
        self._host_picked = True
        best = None
        for h in self.HOSTS:
            self.HOST = h
            self.session = self._new_session()
            self.verified = False
            try:
                if not self._pass_robot():
                    continue
                # 用一个样本片量线路数：详情页里 tab 的数量
                n = self._probe_lines()
                if n and (best is None or n > best[1]):
                    best = (h, n)
                # 已经拿到 8 条以上就不必再试别的域名了
                if n >= 8:
                    break
            except Exception:
                continue
        if best:
            self.HOST = best[0]
            self.session = self._new_session()
            self.verified = False
            self._pass_robot()
            print("[kankanya] 页面域名 %s（%d 条线路）" % (best[0], best[1]), flush=True)
        # 页面域名定了之后，再单独定播放接口域名
        ph = self._pick_play_host()
        print("[kankanya] 播放接口 %s" % ph, flush=True)

    def _probe_lines(self):
        """随机拿一部剧的详情，数上有几条线路。拿不到返回 0。"""
        try:
            html = self._get("/show/juji-----------.html", referer="/")
            # 优先找「谷雨」这类多线路的热门；找不到就用第一个
            vids = re.findall(r'href="/detail/([A-Za-z0-9]+)\.html"', html)
            if not vids:
                return 0
            # 多翻几个，取最大值
            best = 0
            for vid in vids[:4]:
                d = self._get("/detail/%s.html" % vid, referer="/")
                if not d:
                    continue
                tabs = re.findall(r'data-dropdown-value="[^"]*"[^>]*>\s*<span>[^<]*</span>', d)
                best = max(best, len(tabs))
                if best >= 8:
                    break
            return best
        except Exception:
            return 0

    # ---------------------------------------------------------------- 会话
    def _new_session(self):
        try:
            import requests
            s = requests.Session()
            s.headers.update({
                "User-Agent": self.UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9",
            })
            return s
        except Exception:
            return None

    def _encrypt(self, s):
        """页面 encrypt()：逐字符在 62 表里 +3 位移，左右各塞一个随机字符，再 base64"""
        out = []
        n = len(self.TABLE62)
        for ch in s:
            i = self.TABLE62.find(ch)
            code = ch if i < 0 else self.TABLE62[(i + 3) % n]
            out.append(self.TABLE62[random.randrange(n)] + code +
                       self.TABLE62[random.randrange(n)])
        return base64.b64encode("".join(out).encode()).decode()

    def _is_ok(self, html):
        return bool(html) and "人机验证" not in html and len(html) > 5000

    def _get(self, path, referer="/", timeout=25):
        if not self.session:
            return ""
        url = path if path.startswith("http") else self.HOST + path
        ref = referer if str(referer).startswith("http") else self.HOST + (referer or "/")
        try:
            r = self.session.get(url, headers={"Referer": ref}, timeout=timeout)
            r.encoding = "utf-8"
            return r.text or ""
        except Exception:
            return ""

    def _post(self, path, data, referer="/", timeout=25):
        if not self.session:
            return ""
        url = path if path.startswith("http") else self.HOST + path
        ref = referer if str(referer).startswith("http") else self.HOST + (referer or "/")
        try:
            r = self.session.post(url, data=data, timeout=timeout, headers={
                "Referer": ref,
                "Origin": self.HOST,
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded",
            })
            r.encoding = "utf-8"
            return r.text or ""
        except Exception:
            return ""

    def _post_abs(self, url, data, referer="/", timeout=25):
        """POST 到完整 URL（不拼 self.HOST）。播放接口在另一个域名上时用。"""
        if not self.session:
            return ""
        try:
            r = self.session.post(url, data=data, timeout=timeout, headers={
                "Referer": referer,
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded",
            })
            r.encoding = "utf-8"
            return r.text or ""
        except Exception:
            return ""

    def _pass_robot(self):
        """过人机验证；成功返回 True"""
        home = self._get("/")
        if self._is_ok(home):
            self.verified = True
            return True
        m = re.search(r'var token = encrypt\("([^"]+)"\)', home)
        if not m:
            return False
        self._post("/robot.php", {
            "value": self._encrypt(self.HOST + "/"),
            "token": self._encrypt(m.group(1)),
        }, referer="/")
        ok = self._is_ok(self._get("/"))
        self.verified = ok
        return ok

    def _ensure(self):
        self._pick_host()
        return self.verified or self._pass_robot()

    # ---------------------------------------------------------------- 解密
    @staticmethod
    def _b64(s):
        s = (s or "").replace("-", "+").replace("_", "/")
        s += "=" * (-len(s) % 4)
        return base64.b64decode(s)

    def _shift_decode(self, cipher):
        """urlmode=2：三层取一个字符，再在 62 表里回退 3 位"""
        raw = self._b64(cipher).decode("utf-8", "ignore")
        out = []
        n = len(self.TABLE62)
        for ch in raw[1::3]:
            i = self.TABLE62.find(ch)
            out.append(ch if i < 0 else self.TABLE62[(i + 59) % n])
        return "".join(out)

    def _xor_base64(self, cipher):
        """urlmode=1 第一步：base64 -> md5('test') 循环异或 -> base64"""
        raw = self._b64(cipher).decode("latin1")
        key = hashlib.md5(b"test").hexdigest()
        out = "".join(chr(ord(c) ^ ord(key[i % len(key)])) for i, c in enumerate(raw))
        return self._b64(out).decode("utf-8", "ignore")

    def _split_decode(self, cipher):
        """urlmode=1 主体：混乱串 -> 分三段 -> 头两段是码表，第三段是正文"""
        data = self._xor_base64(cipher)
        parts = data.split("/")
        if len(parts) < 3:
            return ""
        mid = "/".join(parts[2:])
        body = self._b64(mid).decode("utf-8", "ignore")
        idx_arr = json.loads(self._b64(parts[0]).decode("utf-8", "ignore"))
        map_arr = json.loads(self._b64(parts[1]).decode("utf-8", "ignore"))

        out = []
        for ch in body:
            if ch.isalpha() and ch in map_arr:
                try:
                    out.append(map_arr[idx_arr.index(ch)])
                except ValueError:
                    out.append(ch)
            else:
                out.append(ch)
        return "".join(out)

    def _decrypt_play(self, cipher, mode):
        try:
            mode = int(mode)
        except Exception:
            mode = 0
        if mode == 2:
            return self._shift_decode(cipher)
        if mode == 1:
            return self._split_decode(cipher)
        return cipher

    # ---------------------------------------------------------------- 列表
    def _parse_items(self, html):
        items, seen = [], set()
        for m in re.finditer(
                r'<a[^>]+href="/detail/([A-Za-z0-9]+)\.html"[^>]*>(.*?)</a>',
                html, re.S):
            vid, inner = m.group(1), m.group(2)
            if vid in seen:
                continue
            seen.add(vid)

            name = ""
            mt = (re.search(r'title="([^"]{1,60})"', inner)
                  or re.search(r'alt="([^"]{1,60})"', inner)
                  or re.search(r'<h\d[^>]*>([^<]{1,60})</h\d>', inner))
            if mt:
                name = mt.group(1).strip()
            if not name:
                continue

            pic = ""
            mi = re.search(r'(?:data-original|data-src|src)="([^"]+)"', inner)
            if mi:
                pic = mi.group(1)
                if pic.startswith("//"):
                    pic = "https:" + pic
                elif pic.startswith("/"):
                    pic = self.HOST + pic

            rem = ""
            mr = re.search(r'class="[^"]*(?:pic-text|remarks|note|state)[^"]*"[^>]*>([^<]{1,30})<', inner)
            if mr:
                rem = mr.group(1).strip()

            items.append({
                "vod_id": vid,
                "vod_name": name,
                "vod_pic": pic,
                "vod_remarks": rem,
            })
        return items

    # ---------------------------------------------------------------- 接口
    def homeContent(self, filter=False):
        return {"class": [{"type_id": k, "type_name": v} for k, v in self.CATS]}

    def homeVideoContent(self):
        return {"list": self.categoryContent("dianying", "1", False, None).get("list", [])}

    def categoryContent(self, tid, pg, filter=False, extend=None):
        if not self._ensure():
            return {"list": [], "page": 1, "pagecount": 1, "limit": 48, "total": 0}
        slug = tid if tid in dict(self.CATS) else "dianying"
        try:
            page = int(pg)
        except Exception:
            page = 1

        # 站点真实分页地址：/show/{slug}--------{pg}---.html
        if page <= 1:
            url = "/show/%s-----------.html" % slug
        else:
            url = "/show/%s--------%d---.html" % (slug, page)

        html = self._get(url, referer="/")
        items = self._parse_items(html) if html else []

        return {
            "list": items,
            "page": page,
            "pagecount": page + 1 if items else page,
            "limit": 48,
            "total": 9999 if items else 0,
        }

    def detailContent(self, ids):
        vid = ids[0] if isinstance(ids, list) and ids else (ids if isinstance(ids, str) else "")
        vid = str(vid).strip()
        if not vid:
            return {"list": []}

        # 抓详情页。站点偶发返回空页 / 人机验证 / 5xx，重建会话再试，
        # 比把「没找到」丢给用户强。这也是所有 py 源的通病，不是这个站特殊。
        html = ""
        for attempt in range(3):
            if attempt > 0:
                self.session = self._new_session()
                self.verified = False
                self._host_picked = False   # 重新选域名：可能这个域名刚被打挂
            if not self._ensure():
                continue
            html = self._get("/detail/%s.html" % vid, referer="/")
            if html and "人机验证" not in html and len(html) > 3000:
                break
            html = ""
        if not html:
            return {"list": []}

        name = ""
        m = re.search(r"<h1[^>]*>([^<]{1,80})</h1>", html)
        if m:
            name = m.group(1).strip()
        if not name:
            m = re.search(r"<title>([^<|－\-]{1,60})", html)
            if m:
                name = m.group(1).strip()

        pic = ""
        m = re.search(r'(?:data-original|data-src)="([^"]+)"', html)
        if m:
            pic = m.group(1)
            if pic.startswith("//"):
                pic = "https:" + pic
            elif pic.startswith("/"):
                pic = self.HOST + pic

        content = ""
        # 简介只在 module-info-introduction-content 里。
        # 早期用的 `desc|intro|content|plot|text` 宽匹配会先命中
        # 「我的观影记录」那个下拉框（class 里带 history），简介就变成了
        # 四个字「我的观影记录」—— 详情页看着像没有介绍。
        m = re.search(
            r'<div[^>]+class="[^"]*module-info-introduction-content[^"]*"[^>]*>(.*?)</div>',
            html, re.S)
        if not m:
            m = re.search(r'<meta name="description" content="([^"]*)"', html)
            if m:
                content = m.group(1)
                # 站点在 description 里带「片名剧情:」前缀，去掉更像简介
                content = re.sub(r"^[^:：]{1,20}剧情[:：]\s*", "", content)
        if m and not content:
            content = re.sub(r"<[^>]+>", "", m.group(1))
        content = re.sub(r"\s+", " ", content).strip()[:1200]

        year = ""
        m = re.search(r"(\d{4})\s*年", html)
        if m:
            year = m.group(1)

        # 线路名（tab 上的真名，如「地址3」「地址8」）
        tab_names = []
        for m in re.finditer(r'data-dropdown-value="[^"]*"[^>]*>\s*<span>([^<]*)</span>', html):
            tab_names.append(m.group(1).strip())

        # 按 sid 分组拿线路。
        #
        # 早先是按 `<div class="module-list sort-list tab-list ...">` 切面板，
        # 版面一改（class 改名、多套一层）就整站线路全丢，而且看不出是解析问题。
        # /play/{vid}-{sid}-{nid}.html 里的 **sid 就是线路号**，直接从链接里分组
        # 不依赖任何 DOM 结构 —— 站点怎么改版都还能用。
        #
        # 已验证（2026-11-15）：tab 数量与 sid 分组数完全一致，
        # 看看鸭给几条线路就是几条（2/5/6 条都见过），不是我们丢的。
        by_sid = {}
        for m in re.finditer(
                r'href="/play/%s-(\d+)-(\d+)\.html"[^>]*>(?:\s*<span>([^<]{0,40})</span>)?'
                % re.escape(vid), html):
            sid, nid, label = m.group(1), m.group(2), (m.group(3) or "").strip()
            eps = by_sid.setdefault(sid, [])
            if any(e[1] == nid for e in eps):
                continue
            eps.append((label, nid))

        froms, urls, total = [], [], 0
        used = set()
        for si, sid in enumerate(sorted(by_sid.keys(), key=int)):
            eps = by_sid[sid]
            if not eps:
                continue
            # 集号排序：站点偶尔乱序，按 nid 数字排才和页面上一致
            eps.sort(key=lambda x: int(x[1]))
            # tab 名按下标对：sid=1 对第一个 tab，以此类推
            line = tab_names[si] if si < len(tab_names) else ("地址%s" % sid)
            if line in used:
                line = "%s-%d" % (line, si + 1)
            used.add(line)

            pairs = []
            for nm, nid in eps:
                show = nm or ("第%s集" % nid)
                pairs.append("%s$%s-%s-%s" % (
                    show.replace("$", "").replace("#", ""), vid, sid, nid))
            froms.append(line)
            urls.append("#".join(pairs))
            total = max(total, len(pairs))

        if not froms:
            return {"list": []}

        return {"list": [{
            "vod_id": vid,
            "vod_name": name,
            "vod_pic": pic,
            "vod_content": content,
            "vod_year": year,
            "vod_remarks": ("共%d集" % total) if total > 1 else "高清",
            "vod_play_from": "$$$".join(froms),
            "vod_play_url": "$$$".join(urls),
        }]}

    def searchContent(self, key, quick=False, pg="1"):
        if not self._ensure():
            return {"list": []}
        try:
            page = int(pg)
        except Exception:
            page = 1

        # 站点搜索页：/search/{kw}-------------.html
        q = key.strip()
        if page <= 1:
            url = "/search/%s-------------.html" % q
        else:
            url = "/search/%s----------%d---.html" % (q, page)

        html = self._get(url, referer="/")
        items = self._parse_items(html) if html else []
        return {"list": items, "page": page}

    def playerContent(self, flag, vid, vipFlags=None):
        """现场解出真实播放地址。

        vid 形如 ``Eumhhk-1-2``（影片id-线路-集）。
        """
        parts = str(vid).split("-")
        if len(parts) < 3:
            return {"parse": 0, "playUrl": "", "url": ""}
        pid, sid, nid = parts[0], parts[1], parts[2]

        play_path = "/play/%s-%s-%s.html" % (pid, sid, nid)
        for attempt in range(3):
            if attempt == 2:
                # 换全新会话：同会话的 vid 有时效，过期就 403
                self.session = self._new_session()
                self.verified = False
            if not self._ensure():
                continue

            html = self._get("%s?t=%d" % (play_path, random.randrange(1, 10 ** 9)),
                             referer="/detail/%s.html" % pid)
            if not html or "player_aaaa" not in html:
                continue

            m = (re.search(r"player_aaaa\s*=\s*(\{.*?\})\s*;?\s*</script>", html, re.S)
                 or re.search(r"player_aaaa\s*=\s*(\{.*?\})\s*;", html, re.S))
            if not m:
                continue
            try:
                p = json.loads(m.group(1).replace("\\/", "/"))
            except Exception:
                continue

            enc_vid = p.get("url") or ""
            if not enc_vid:
                continue

            # 播放接口必须打到「有这个接口的域名」上（见 _pick_play_host）
            ph = self._pick_play_host()
            txt = self._post_abs(ph + "/kkyplayer/api.php",
                                 {"vid": enc_vid}, referer=ph + play_path)
            try:
                d = json.loads(txt)
            except Exception:
                continue
            if d.get("code") != 200:
                msg = d.get("message") or ""
                # 源站自己说线路挂了 / 转码中，重试没用
                if "故障" in msg or "转码" in msg:
                    return {"parse": 0, "playUrl": "", "url": "", "msg": msg}
                continue

            data = d.get("data") or {}
            url = self._decrypt_play(data.get("url", ""), data.get("urlmode", 0))
            if url.startswith("http"):
                return {"parse": 0, "playUrl": "", "url": url, "header": ""}

        return {"parse": 0, "playUrl": "", "url": ""}

    def isVideoFormat(self, url):
        u = (url or "").lower()
        return ".m3u8" in u or ".mp4" in u

    def manualVideoCheck(self):
        return False

    def localProxy(self, param):
        return None
