// ==UserScript==
// @name         PKU Elective - General Education (Tongshi) Course Filter
// @namespace    pku.elective.tskfilter
// @version      2.0.0
// @description  Add a filter bar (series I/II/III/IV + uncategorized) to PKU elective course lists (yuxuan/buxuan/course query). Preserves all original course data, limit/enrolled, preference points and buttons; only hides non-matching rows. Selection persists across pages.
// @author       you
// @match        https://elective.pku.edu.cn/elective2008/*
// @match        http://elective.pku.edu.cn/elective2008/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    var STORE_KEY = 'pkuTskFilter.selected';

    // \u901a\u8bc6\u8bfe\u56db\u4e2a\u7cfb\u5217\uff08\u540d\u79f0\u4ec5\u4f5c\u53c2\u8003\u63d0\u793a\uff0c\u4e0d\u5f71\u54cd\u6309 \u4e00/\u4e8c/\u4e09/\u56db \u7684\u5b57\u9762\u7b5b\u9009\uff09
    var SERIES = [
        { label: '\u4e00', num: 'I',   tip: '\u4eba\u7c7b\u6587\u660e\u53ca\u5176\u4f20\u7edf' },
        { label: '\u4e8c', num: 'II',  tip: '\u73b0\u4ee3\u793e\u4f1a\u53ca\u5176\u95ee\u9898' },
        { label: '\u4e09', num: 'III', tip: '\u4eba\u6587\u4e0e\u81ea\u7136' },
        { label: '\u56db', num: 'IV',  tip: '\u6570\u5b66\u4e0e\u903b\u8f91' }
    ];

    // \u5339\u914d\u300c\u901a\u8bc6\u6838\u5fc3\u8bfeIV\u300d\u300c\u901a\u9009\u8bfeII\u300d\u7b49\u5b8c\u6574\u5b50\u7c7b\u4e32\uff08\u8d2a\u5a6a\uff0c\u907f\u514d II \u8bef\u5339\u914d\u6210 I\uff09
    var TSK_RE = /\u901a\u8bc6\u6838\u5fc3\u8bfe[IVX]{1,4}|\u901a\u9009\u8bfe[IVX]{1,4}/g;

    function extractKeywords(text) {
        var m = text.match(TSK_RE);
        return m || [];
    }

    // \u662f\u5426\u4e3a\u901a\u8bc6\u8bfe\uff08\u542b\u300c\u901a\u8bc6\u8bfe\u300d\u300c\u901a\u8bc6\u6838\u5fc3\u8bfe\u300d\u300c\u901a\u9009\u8bfe\u300d\u4efb\u4e00\uff09
    function isTsk(text) {
        return text.indexOf('\u901a\u8bc6\u8bfe') >= 0 || text.indexOf('\u901a\u8bc6\u6838\u5fc3\u8bfe') >= 0 || text.indexOf('\u901a\u9009\u8bfe') >= 0;
    }

    // \u8fd4\u56de\u7cfb\u5217 '\u4e00'/'\u4e8c'/'\u4e09'/'\u56db'\uff0c\u65e0\u7cfb\u5217\u53f7\u5219 '\u672a\u533a\u5206'\uff1b\u975e\u901a\u8bc6\u8bfe\u8fd4\u56de null
    function seriesOf(text) {
        if (!isTsk(text)) return null;
        var kws = extractKeywords(text);
        for (var i = 0; i < SERIES.length; i++) {
            var targets = ['\u901a\u8bc6\u6838\u5fc3\u8bfe' + SERIES[i].num, '\u901a\u9009\u8bfe' + SERIES[i].num];
            for (var j = 0; j < kws.length; j++) {
                if (targets.indexOf(kws[j]) !== -1) return SERIES[i].label;
            }
        }
        return '\u672a\u533a\u5206';
    }

    // \u627e\u51fa\u9875\u9762\u91cc\u6240\u6709\u5e26\u300c\u8bfe\u7a0b\u7c7b\u522b\u300d\u5217\u7684\u8bfe\u7a0b\u8868\u683c
    function getTables() {
        var out = [];
        var all = document.querySelectorAll('table.datagrid');
        for (var i = 0; i < all.length; i++) {
            var ths = all[i].querySelectorAll('tr.datagrid-header th');
            for (var j = 0; j < ths.length; j++) {
                if (ths[j].textContent.trim() === '\u8bfe\u7a0b\u7c7b\u522b') { out.push(all[i]); break; }
            }
        }
        return out;
    }

    // \u6c42\u67d0\u5f20\u8868\u300c\u8bfe\u7a0b\u7c7b\u522b\u300d\u5217\u7684\u5217\u53f7
    function getCategoryColIndex(table) {
        var ths = table.querySelectorAll('tr.datagrid-header th');
        for (var i = 0; i < ths.length; i++) {
            if (ths[i].textContent.trim() === '\u8bfe\u7a0b\u7c7b\u522b') return i;
        }
        return -1;
    }

    // \u67d0\u5f20\u8868\u7684\u6570\u636e\u884c\uff08\u6392\u9664\u8868\u5934\u3001\u8868\u5c3e/\u5206\u9875\uff09
    function getDataRows(table) {
        var out = [];
        var trs = table.querySelectorAll('tr');
        for (var i = 0; i < trs.length; i++) {
            var c = trs[i].className;
            if (c === 'datagrid-even' || c === 'datagrid-odd') out.push(trs[i]);
        }
        return out;
    }

    // \u53d6\u67d0\u884c\u7684\u300c\u8bfe\u7a0b\u7c7b\u522b\u300d\u6587\u672c\uff08\u6570\u636e\u5355\u5143\u683c\u5373\u4f7f colspan=2 \u4e5f\u662f\u5355\u4e2a td\uff0c\u76f4\u63a5\u53d6\u5373\u53ef\uff09
    function getCategory(row, colIdx) {
        var tds = row.children;
        if (colIdx < 0 || colIdx >= tds.length) return '';
        return tds[colIdx].textContent.trim();
    }

    // \u7edf\u8ba1\u5404\u6309\u94ae\u5339\u914d\u884c\u6570
    function countMatches() {
        var counts = { all: 0, allTsk: 0, '\u4e00': 0, '\u4e8c': 0, '\u4e09': 0, '\u56db': 0, '\u672a\u533a\u5206': 0 };
        getTables().forEach(function (table) {
            var colIdx = getCategoryColIndex(table);
            if (colIdx < 0) return;
            getDataRows(table).forEach(function (row) {
                counts.all++;
                var cat = getCategory(row, colIdx);
                if (isTsk(cat)) {
                    counts.allTsk++;
                    counts[seriesOf(cat)]++;
                }
            });
        });
        return counts;
    }

    // \u5e94\u7528\u7b5b\u9009\uff1akey \u4e3a 'all' | 'allTsk' | '\u4e00' | '\u4e8c' | '\u4e09' | '\u56db' | '\u672a\u533a\u5206'
    function applyFilter(key) {
        getTables().forEach(function (table) {
            var colIdx = getCategoryColIndex(table);
            if (colIdx < 0) return;
            getDataRows(table).forEach(function (row) {
                var cat = getCategory(row, colIdx);
                var show;
                if (key === 'all') show = true;
                else if (key === 'allTsk') show = isTsk(cat);
                else show = (seriesOf(cat) === key);
                row.style.display = show ? '' : 'none';
            });
        });
    }

    function makeBtn(text, showKey, active) {
        var b = document.createElement('button');
        b.textContent = text;
        b.setAttribute('data-key', showKey);
        b.style.cssText = 'margin:0 4px 4px 0;padding:4px 10px;font-size:13px;cursor:pointer;'
            + 'border:1px solid #9b0000;background:#fff;color:#9b0000;border-radius:3px;';
        if (active) b.style.cssText += 'background:#9b0000;color:#fff;';
        return b;
    }

    function buildFilterBar() {
        var counts = countMatches();

        var bar = document.createElement('div');
        bar.id = 'pkuTskFilterBar';
        bar.style.cssText = 'background:#fff;padding:8px 10px;margin:6px 0;'
            + 'border:1px solid #9b0000;border-radius:4px;font-size:13px;color:#333;';

        var title = document.createElement('span');
        title.textContent = '\u901a\u8bc6\u8bfe\u7b5b\u9009\uff1a';
        title.style.cssText = 'font-weight:bold;';
        bar.appendChild(title);

        var buttons = [];
        buttons.push(makeBtn('\u5168\u90e8(' + counts.all + ')', 'all', true));
        buttons.push(makeBtn('\u901a\u8bc6\u8bfe(' + counts.allTsk + ')', 'allTsk', false));

        var sep = document.createElement('span');
        sep.textContent = '|';
        sep.style.cssText = 'color:#bbb;margin:0 2px;';

        buttons.forEach(function (b) { bar.appendChild(b); });
        bar.appendChild(sep);

        SERIES.forEach(function (s) {
            var key = s.label;
            var n = counts[key] || 0;
            var b = makeBtn(key + '(' + n + ')', key, false);
            b.title = '\u901a\u8bc6\u8bfe\u7cfb\u5217' + s.label + '\uff1a' + s.tip;
            if (n === 0) { b.style.opacity = '0.45'; b.style.borderColor = '#ccc'; b.style.color = '#999'; }
            bar.appendChild(b);
            buttons.push(b);
        });

        (function () {
            var key = '\u672a\u533a\u5206';
            var n = counts[key] || 0;
            var b = makeBtn(key + '(' + n + ')', key, false);
            b.title = '\u901a\u8bc6\u8bfe\uff08\u672a\u6807\u6ce8\u7cfb\u5217\uff09';
            if (n === 0) { b.style.opacity = '0.45'; b.style.borderColor = '#ccc'; b.style.color = '#999'; }
            bar.appendChild(b);
            buttons.push(b);
        })();

        function setActive(key) {
            buttons.forEach(function (b) {
                var on = b.getAttribute('data-key') === key;
                b.style.background = on ? '#9b0000' : '#fff';
                b.style.color = on ? '#fff' : '#9b0000';
            });
            applyFilter(key);
            try { sessionStorage.setItem(STORE_KEY, key); } catch (e) {}
        }

        buttons.forEach(function (b) {
            b.addEventListener('click', function () { setActive(b.getAttribute('data-key')); });
        });

        // \u63d0\u793a\u884c
        var tip = document.createElement('div');
        tip.style.cssText = 'margin-top:5px;color:#888;font-size:12px;';
        tip.textContent = '\u901a\u8bc6\u8bfe\u56db\u7cfb\u5217\uff08\u53c2\u8003\uff09\uff1a' + SERIES.map(function (s) { return s.label + '=' + s.tip; }).join('\u3001')
            + '\uff1b\u300c\u672a\u533a\u5206\u300d\u4e3a\u672a\u6807\u6ce8\u7cfb\u5217\u7684\u901a\u8bc6\u8bfe\u3002\u7b5b\u9009\u4ec5\u4f5c\u7528\u4e8e\u5f53\u524d\u9875\uff08\u7ffb\u9875\u540e\u9009\u62e9\u81ea\u52a8\u4fdd\u6301\uff09\u3002\u70b9\u300c\u5168\u90e8\u300d\u6062\u590d\u3002';
        bar.appendChild(tip);

        // \u6062\u590d\u4e0a\u6b21\u9009\u62e9
        try {
            var saved = sessionStorage.getItem(STORE_KEY);
            var valid = saved === 'all' || saved === 'allTsk'
                || buttons.some(function (b) { return b.getAttribute('data-key') === saved; });
            if (saved && valid && saved !== 'all') setActive(saved);
        } catch (e) {}

        return bar;
    }

    function init() {
        if (document.getElementById('pkuTskFilterBar')) return;
        var tables = getTables();
        if (tables.length === 0) return;

        var bar = buildFilterBar();
        tables[0].parentNode.insertBefore(bar, tables[0]);
    }

    function waitReady() {
        var tries = 0;
        var timer = setInterval(function () {
            if (++tries > 50) { clearInterval(timer); init(); return; }
            if (document.readyState !== 'loading') { clearInterval(timer); init(); }
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitReady);
    } else {
        waitReady();
    }
})();
