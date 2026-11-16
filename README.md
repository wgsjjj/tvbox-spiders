# tvbox-spiders

TVBox / 蜂蜜影视 / LibreTV Native 可用的 Python 蜘蛛源。

## 使用方法

在 App 的「我的 → 点播源 → 添加」里填入以下任一地址：

```
https://gitee.com/wgsjjj/tvbox-spiders/raw/master/kankanya.py
```

如果 App 支持多地址回退，可以同时填两个（用 `|` 分隔），哪个通用哪个：

```
https://cdn.jsdelivr.net/gh/wgsjjj/tvbox-spiders@main/kankanya.py|https://gitee.com/wgsjjj/tvbox-spiders/raw/master/kankanya.py
```

## 源列表

| 文件 | 站点 | 说明 |
|---|---|---|
| `kankanya.py` | 看看鸭 | 多线路，纯 Python 解密，不需要 node |

## 说明

这些蜘蛛跑在 App 内置的 CPython 里（Chaquopy），依赖 `requests`、`lxml`、`pycryptodome`。

只做解析转发，不托管任何视频内容。
