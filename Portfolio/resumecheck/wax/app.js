/* Dead Wax — point your phone at a record, find out what it's worth.
   Talks to two APIs directly from the browser:
     api.discogs.com      (CORS-open; personal token as a query param, no preflight)
     api.anthropic.com    (CORS-open with anthropic-dangerous-direct-browser-access)
   Nothing is stored anywhere but this device's localStorage. */
(function () {
  "use strict";

  var LS = "deadwax-v1";

  var CONDS = [
    ["M",   "Mint (M)"],
    ["NM",  "Near Mint (NM or M-)"],
    ["VG+", "Very Good Plus (VG+)"],
    ["VG",  "Very Good (VG)"],
    ["G+",  "Good Plus (G+)"],
    ["G",   "Good (G)"]
  ];

  var DEFAULTS = { token: "", cut: 30, cond: "VG+", aiKey: "", model: "claude-opus-5" };
  var S = Object.assign({}, DEFAULTS);
  var saved = [];

  var cur = null;      // { id, title, artist, meta, thumb, uri, suggestions, stats, community }
  var condShot = null; // { b64, mediaType }

  // ---------------- utils ----------------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function usd(v) {
    if (v == null || !isFinite(v)) return "—";
    return "$" + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function say(el, html, kind) {
    el.innerHTML = html ? '<div class="msg ' + (kind || "") + '">' + html + "</div>" : "";
  }
  function busy(el, text) { say(el, '<span class="spin"></span>' + esc(text)); }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS) || "null");
      if (raw) {
        Object.keys(DEFAULTS).forEach(function (k) {
          if (raw.settings && raw.settings[k] != null) S[k] = raw.settings[k];
        });
        if (Array.isArray(raw.saved)) saved = raw.saved;
      }
    } catch (e) {}
  }
  function persist() {
    try { localStorage.setItem(LS, JSON.stringify({ settings: S, saved: saved })); } catch (e) {}
  }

  // ---------------- Discogs ----------------
  function DiscogsError(msg) { this.message = msg; }
  DiscogsError.prototype = Object.create(Error.prototype);

  function dg(path, params) {
    var u = new URL("https://api.discogs.com" + path);
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] != null && params[k] !== "") u.searchParams.set(k, params[k]);
    });
    if (S.token) u.searchParams.set("token", S.token);
    return fetch(u.toString()).then(function (r) {
      if (r.status === 401 || r.status === 403)
        throw new DiscogsError("Discogs wants your token for that. Add it under SETUP.");
      if (r.status === 429)
        throw new DiscogsError("Discogs rate limit hit. Wait a few seconds and try again.");
      if (r.status === 404) throw new DiscogsError("Discogs has no record with that id.");
      if (!r.ok) throw new DiscogsError("Discogs returned " + r.status + ".");
      return r.json();
    });
  }

  function search(params) {
    // format=Vinyl keeps CDs and cassettes out of a record digger's results
    return dg("/database/search", Object.assign({ type: "release", format: "Vinyl", per_page: 15 }, params))
      .then(function (j) { return (j && j.results) || []; });
  }

  // ---------------- money ----------------
  function condKey(short) {
    for (var i = 0; i < CONDS.length; i++) if (CONDS[i][0] === short) return CONDS[i][1];
    return null;
  }

  function valueFor(short) {
    // returns {value, source} — suggestion when we have a token, else the cheapest live listing
    if (cur && cur.suggestions) {
      var k = condKey(short);
      var s = k && cur.suggestions[k];
      if (s && typeof s.value === "number") return { value: s.value, source: "suggested" };
    }
    if (cur && cur.stats && cur.stats.lowest_price && typeof cur.stats.lowest_price.value === "number")
      return { value: cur.stats.lowest_price.value, source: "lowest" };
    return { value: null, source: "none" };
  }

  // ---------------- rendering ----------------
  function renderConds() {
    $("conds").innerHTML = CONDS.map(function (c) {
      return '<button type="button" data-cond="' + c[0] + '" aria-pressed="' +
        (c[0] === S.cond ? "true" : "false") + '">' + esc(c[0]) + "</button>";
    }).join("");
  }

  function renderMoney() {
    if (!cur) return;
    var v = valueFor(S.cond);
    var big = $("moneyBig"), why = $("moneyWhy"), rows = $("moneyRows");

    if (v.value == null) {
      big.textContent = "—";
      big.className = "big nil";
      why.innerHTML = S.token
        ? "Discogs has no suggested price and nothing listed for sale in this pressing. That usually means it rarely trades &mdash; check the release page before you pay anything."
        : "Add your Discogs token under SETUP to get per-grade values. Without it you only see whatever is listed right now.";
      rows.innerHTML = "";
      return;
    }

    var take = v.value * (1 - S.cut / 100);
    big.textContent = usd(take);
    big.className = "big";

    why.innerHTML = v.source === "suggested"
      ? "Discogs suggests <b>" + usd(v.value) + "</b> for a <b>" + esc(S.cond) +
        "</b> copy. Minus your " + S.cut + "% cut."
      : "No token, so this is the <b>cheapest copy listed right now</b> (" + usd(v.value) +
        ") minus your " + S.cut + "% cut &mdash; a floor, not a value.";

    var st = cur.stats || {}, com = cur.community || {};
    var lowest = st.lowest_price && typeof st.lowest_price.value === "number" ? st.lowest_price.value : null;
    var r = [];
    r.push(["Discogs value, " + S.cond, usd(v.value)]);
    r.push(["Your cut (" + S.cut + "%)", "-" + usd(v.value - take)]);
    r.push(["Cheapest listed now", lowest == null ? "none for sale" : usd(lowest)]);
    r.push(["Copies for sale", st.num_for_sale == null ? "—" : String(st.num_for_sale)]);
    if (com.want != null && com.have != null) {
      var ratio = com.have > 0 ? (com.want / com.have) : 0;
      r.push(["Want vs have", com.want + " / " + com.have +
        (com.have > 0 ? "  (" + ratio.toFixed(2) + ")" : "")]);
    }
    rows.innerHTML = r.map(function (x) {
      return "<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>";
    }).join("");
  }

  function relCardHTML(o) {
    var img = o.thumb
      ? '<img src="' + esc(o.thumb) + '" alt="" loading="lazy">'
      : '<span class="noimg"></span>';
    return img + "<div><h3>" + esc(o.title) + '</h3><div class="meta">' + esc(o.meta) + "</div></div>";
  }

  function renderHits(list) {
    var ul = $("hits");
    if (!list.length) { ul.innerHTML = ""; return; }
    ul.innerHTML = list.map(function (x) {
      var meta = [x.year, x.country, (x.label || [])[0], x.catno, (x.format || []).join(", ")]
        .filter(Boolean).join(" · ");
      return '<li class="rel" data-id="' + x.id + '" data-thumb="' + esc(x.thumb || "") + '">' +
        relCardHTML({ title: x.title, meta: meta, thumb: x.thumb }) + "</li>";
    }).join("");
  }

  function showResult(on) {
    $("finder").hidden = on;
    $("result").hidden = !on;
    window.scrollTo(0, 0);
  }

  // ---------------- open a release ----------------
  function openRelease(id, thumb) {
    busy($("finderMsg"), "Pulling the numbers…");
    var detail, stats, sugg = null;

    dg("/releases/" + id, { curr_abbr: "USD" })
      .then(function (d) {
        detail = d;
        return dg("/marketplace/stats/" + id, { curr_abbr: "USD" }).catch(function () { return {}; });
      })
      .then(function (s) {
        stats = s || {};
        if (!S.token) return null;
        return dg("/marketplace/price_suggestions/" + id).catch(function () { return null; });
      })
      .then(function (ps) {
        sugg = ps;
        var labels = detail.labels || [];
        var meta = [
          detail.year,
          detail.country,
          labels.length ? labels[0].name : null,
          labels.length ? labels[0].catno : null,
          (detail.formats || []).map(function (f) {
            return [f.name].concat(f.descriptions || []).join(", ");
          }).join(" / ")
        ].filter(Boolean).join(" · ");

        cur = {
          id: id,
          title: detail.title,
          artist: (detail.artists_sort || ""),
          meta: meta,
          thumb: thumb || (detail.thumb || ((detail.images || [])[0] || {}).uri150 || ""),
          uri: detail.uri || ("https://www.discogs.com/release/" + id),
          suggestions: sugg,
          stats: stats,
          community: detail.community || {}
        };

        $("relCard").innerHTML = relCardHTML({
          title: (cur.artist ? cur.artist + " — " : "") + cur.title,
          meta: cur.meta, thumb: cur.thumb
        });
        $("btnDiscogs").href = cur.uri;
        say($("finderMsg"), "");
        say($("condMsg"), "");
        $("condOut").innerHTML = "";
        $("condImg").hidden = true;
        $("condIdle").hidden = false;
        $("btnCondGrade").disabled = true;
        condShot = null;
        renderConds();
        renderMoney();
        showResult(true);
      })
      .catch(function (e) {
        say($("finderMsg"), esc(e.message || "Could not reach Discogs."), "err");
      });
  }

  // ---------------- barcode scanning ----------------
  var stream = null, rafId = null, zx = null;

  function camOpen() {
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }, audio: false
    }).then(function (st) {
      stream = st;
      var v = $("video");
      v.srcObject = st;
      v.hidden = false;
      $("camIdle").hidden = true;
      $("reticle").hidden = false;
      $("camHint").hidden = false;
      $("stopRow").hidden = false;
      return v.play();
    });
  }

  function camClose() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (zx) { try { zx.reset(); } catch (e) {} zx = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    var v = $("video");
    v.srcObject = null; v.hidden = true;
    $("camIdle").hidden = false;
    $("reticle").hidden = true;
    $("camHint").hidden = true;
    $("stopRow").hidden = true;
  }

  function onBarcode(code) {
    camClose();
    busy($("finderMsg"), "Barcode " + code + " — looking it up…");
    search({ barcode: code })
      .then(function (list) {
        if (!list.length) {
          say($("finderMsg"), "Nothing on Discogs for barcode <b>" + esc(code) +
            "</b>. Try the label photo, or type the catalog number.", "err");
          return;
        }
        if (list.length === 1) { openRelease(list[0].id, list[0].thumb); return; }
        say($("finderMsg"), "Barcode <b>" + esc(code) + "</b> — " + list.length +
          " pressings share it. Pick the one in your hand:");
        renderHits(list);
      })
      .catch(function (e) { say($("finderMsg"), esc(e.message), "err"); });
  }

  function scanNative() {
    var det = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
    });
    var v = $("video");
    var tick = function () {
      if (!stream) return;
      det.detect(v).then(function (codes) {
        if (codes && codes.length && codes[0].rawValue) { onBarcode(codes[0].rawValue); return; }
        rafId = requestAnimationFrame(tick);
      }).catch(function () { rafId = requestAnimationFrame(tick); });
    };
    rafId = requestAnimationFrame(tick);
  }

  function loadZXing() {
    if (window.ZXing) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
      s.onload = res;
      s.onerror = function () { rej(new Error("Could not load the barcode reader.")); };
      document.head.appendChild(s);
    });
  }

  function showCamChrome() {
    $("video").hidden = false;
    $("camIdle").hidden = true;
    $("reticle").hidden = false;
    $("camHint").hidden = false;
    $("stopRow").hidden = false;
  }

  function startScan() {
    say($("finderMsg"), "");
    $("hits").innerHTML = "";
    var go;
    if ("BarcodeDetector" in window) {
      go = camOpen().then(scanNative);
    } else {
      // ZXing opens and owns the stream itself; zx.reset() closes it
      showCamChrome();
      $("camHint").textContent = "Loading reader…";
      go = loadZXing().then(function () {
        $("camHint").textContent = "Hold the barcode in the box";
        zx = new window.ZXing.BrowserMultiFormatReader();
        return zx.decodeFromVideoDevice(null, "video", function (result) {
          if (result && result.getText) onBarcode(result.getText());
        });
      });
    }
    go.catch(function (e) {
      camClose();
      var m = (e && e.name === "NotAllowedError")
        ? "Camera blocked. Allow camera for this site in your browser settings, then try again."
        : (e && e.message) || "Camera unavailable.";
      say($("finderMsg"), esc(m) + " You can still search by name below.", "err");
    });
  }

  // ---------------- photos ----------------
  var pickTarget = null;

  function pickPhoto(target) {
    pickTarget = target;
    var f = $("filePick");
    f.value = "";
    f.click();
  }

  function downscale(file, maxPx) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var sc = Math.min(1, maxPx / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
        var c = $("grab");
        c.width = cw; c.height = ch;
        c.getContext("2d").drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        var dataUrl = c.toDataURL("image/jpeg", 0.82);
        res({ b64: dataUrl.split(",")[1], dataUrl: dataUrl, mediaType: "image/jpeg" });
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Could not read that photo.")); };
      img.src = url;
    });
  }

  // ---------------- Claude ----------------
  function claude(contentParts, maxTokens) {
    if (!S.aiKey) return Promise.reject(new Error("Add your Anthropic API key under SETUP to read photos."));

    var body = {
      model: S.model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: contentParts }],
      fallbacks: "default"
    };
    // effort is not accepted on Haiku 4.5
    if (S.model.indexOf("haiku") === -1) body.output_config = { effort: "low" };

    var headers = {
      "content-type": "application/json",
      "x-api-key": S.aiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };

    function post(b, h) {
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: h, body: JSON.stringify(b)
      });
    }

    return post(body, headers).then(function (r) {
      if (r.status !== 400) return r;
      // server-side fallback may not be enabled on this account — retry plain
      var b2 = Object.assign({}, body); delete b2.fallbacks;
      var h2 = Object.assign({}, headers); delete h2["anthropic-beta"];
      return post(b2, h2);
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          var m = (j && j.error && j.error.message) || ("API error " + r.status);
          if (r.status === 401) m = "That Anthropic key was rejected. Check it under SETUP.";
          if (r.status === 429) m = "Rate limited by the API. Try again in a moment.";
          throw new Error(m);
        }
        if (j.stop_reason === "refusal")
          throw new Error("The model declined to answer on that image.");
        return (j.content || []).filter(function (b) { return b.type === "text"; })
          .map(function (b) { return b.text; }).join("").trim();
      });
    });
  }

  function parseJSON(text) {
    var a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("The model did not return readable JSON.");
    return JSON.parse(text.slice(a, b + 1));
  }

  var ID_PROMPT =
    "This photo shows a vinyl record — its centre label, its jacket, or the runout groove. " +
    "Someone is standing in a thrift store deciding whether to buy it.\n" +
    "Read ONLY what is actually legible in the image. Never invent a value you cannot see.\n" +
    "Reply with ONLY a JSON object and no other text:\n" +
    '{"artist":string|null,"title":string|null,"catno":string|null,"label":string|null,' +
    '"year":string|null,"barcode":string|null,"notes":string|null}\n' +
    '"catno" is the catalogue number printed on the label, spine or jacket. ' +
    '"notes" is at most 12 words naming anything that dates this pressing — a barcode, ' +
    '"180g", a club-edition mark, a runout etching such as RL or STERLING — or null.';

  var COND_PROMPT =
    "Grade this used vinyl record from the photo using the Goldmine scale " +
    "(M, NM, VG+, VG, G+, G, F).\n" +
    "Be conservative. A photograph cannot show fine hairlines and cannot show surface noise, " +
    "and raking light hides as much as it reveals. Grade no higher than the image actually " +
    "supports, and be explicit about what you cannot establish.\n" +
    "Reply with ONLY a JSON object and no other text:\n" +
    '{"vinyl":string|null,"sleeve":string|null,"confidence":"low"|"medium"|"high",' +
    '"issues":string[],"cannot_tell":string[]}\n' +
    '"issues" lists visible damage only — ring wear, seam split, scratch, warp, spindle burn, ' +
    "water stain, mould — at most 5 short phrases. " +
    '"cannot_tell" names at most 3 things this photo cannot establish.';

  function runIdentify(shot) {
    busy($("finderMsg"), "Reading the label…");
    claude([
      { type: "image", source: { type: "base64", media_type: shot.mediaType, data: shot.b64 } },
      { type: "text", text: ID_PROMPT }
    ], 3000).then(function (txt) {
      var o = parseJSON(txt);
      var bits = [o.artist, o.title, o.catno].filter(Boolean);
      if (!bits.length) {
        say($("finderMsg"), "Nothing legible in that photo. Get closer to the label, " +
          "fill the frame, and keep the glare off it.", "err");
        return;
      }
      var line = [o.artist, o.title].filter(Boolean).join(" — ") +
        (o.catno ? "  ·  " + o.catno : "") + (o.notes ? "  ·  " + o.notes : "");
      busy($("finderMsg"), "Read: " + line + " — searching Discogs…");

      var first = o.catno
        ? search({ catno: o.catno, artist: o.artist || undefined })
        : Promise.resolve([]);

      first.then(function (list) {
        if (list.length) return list;
        return search({ q: [o.artist, o.title].filter(Boolean).join(" ") });
      }).then(function (list) {
        if (!list.length) {
          say($("finderMsg"), "Read <b>" + esc(line) + "</b> but Discogs had no match. " +
            "Try typing it below.", "err");
          $("q").value = [o.artist, o.title].filter(Boolean).join(" ");
          return;
        }
        say($("finderMsg"), "Read <b>" + esc(line) + "</b>. Pick the pressing:");
        renderHits(list);
      }).catch(function (e) { say($("finderMsg"), esc(e.message), "err"); });
    }).catch(function (e) {
      say($("finderMsg"), esc(e.message), "err");
    });
  }

  function runCondition() {
    if (!condShot) return;
    busy($("condMsg"), "Looking at the photo…");
    $("btnCondGrade").disabled = true;
    claude([
      { type: "image", source: { type: "base64", media_type: condShot.mediaType, data: condShot.b64 } },
      { type: "text", text: COND_PROMPT }
    ], 3000).then(function (txt) {
      var o = parseJSON(txt);
      say($("condMsg"), "");
      var html = '<div class="grades">';
      html += "<div><span>Vinyl</span><span class='g'>" + esc(o.vinyl || "can't tell") + "</span></div>";
      html += "<div><span>Sleeve</span><span class='g'>" + esc(o.sleeve || "can't tell") + "</span></div>";
      html += "<div><span>Confidence in this read</span><span class='g'>" +
        esc(o.confidence || "low") + "</span></div>";
      html += "</div>";
      if (Array.isArray(o.issues) && o.issues.length)
        html += '<ul class="issues">' + o.issues.map(function (i) {
          return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>";
      if (Array.isArray(o.cannot_tell) && o.cannot_tell.length)
        html += '<ul class="issues cant">' + o.cannot_tell.map(function (i) {
          return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>";
      if (o.vinyl && condKey(o.vinyl)) {
        html += '<div class="btnrow one"><button type="button" id="useGrade">Price it as ' +
          esc(o.vinyl) + "</button></div>";
      }
      $("condOut").innerHTML = html;
      var ug = $("useGrade");
      if (ug) ug.addEventListener("click", function () {
        S.cond = o.vinyl; persist(); renderConds(); renderMoney();
        window.scrollTo(0, 0);
      });
      $("btnCondGrade").disabled = false;
    }).catch(function (e) {
      say($("condMsg"), esc(e.message), "err");
      $("btnCondGrade").disabled = false;
    });
  }

  // ---------------- saved ----------------
  function renderSaved() {
    var ul = $("savedList"), total = 0;
    if (!saved.length) {
      ul.innerHTML = '<li style="display:block"><div class="empty">Nothing saved yet. ' +
        "Price a record and hit Save this find.</div></li>";
      $("savedTotal").textContent = usd(0);
      return;
    }
    ul.innerHTML = saved.map(function (x) {
      total += x.get || 0;
      return "<li><div><strong>" + esc(x.title) + '</strong><span class="m">' +
        esc(x.cond) + " · value " + usd(x.value) + "</span></div>" +
        '<div class="amt">' + usd(x.get) + "</div>" +
        '<div><button class="iconbtn" data-drop="' + esc(x.id) +
        '" aria-label="Remove">&times;</button></div></li>';
    }).join("");
    $("savedTotal").textContent = usd(total);
  }

  // ---------------- settings ui ----------------
  function renderSettings() {
    $("set-token").value = S.token;
    $("set-cut").value = S.cut;
    $("set-aikey").value = S.aiKey;
    $("set-model").value = S.model;
    $("set-cond").innerHTML = CONDS.map(function (c) {
      return '<option value="' + c[0] + '"' + (c[0] === S.cond ? " selected" : "") +
        ">" + esc(c[1]) + "</option>";
    }).join("");
    $("cutPill").textContent = "cut " + S.cut + "%";
    $("tokenState").textContent = S.token ? "token set" : "no token — add one in Setup";
  }

  function tab(name) {
    ["scan", "saved", "setup"].forEach(function (t) {
      $("tab-" + t).hidden = (t !== name);
      $("nav-" + t).setAttribute("aria-selected", t === name ? "true" : "false");
    });
    if (name !== "scan") camClose();
    window.scrollTo(0, 0);
  }

  // ---------------- wiring ----------------
  function init() {
    load();
    renderSettings();
    renderSaved();
    renderConds();

    $("btnScan").addEventListener("click", startScan);
    $("btnStop").addEventListener("click", camClose);
    $("btnShoot").addEventListener("click", function () { camClose(); pickPhoto("id"); });
    $("btnCondShot").addEventListener("click", function () { pickPhoto("cond"); });
    $("btnCondGrade").addEventListener("click", runCondition);

    $("filePick").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var target = pickTarget;
      downscale(f, 1400).then(function (shot) {
        if (target === "id") { runIdentify(shot); return; }
        condShot = shot;
        var im = $("condImg");
        im.src = shot.dataUrl;
        im.hidden = false;
        $("condIdle").hidden = true;
        $("btnCondGrade").disabled = false;
        say($("condMsg"), S.aiKey ? "" :
          "Photo saved on this page. Add an Anthropic key under SETUP if you want it read.", "");
      }).catch(function (err) {
        say(target === "id" ? $("finderMsg") : $("condMsg"), esc(err.message), "err");
      });
    });

    $("btnSearch").addEventListener("click", doSearch);
    $("q").addEventListener("keydown", function (e) { if (e.key === "Enter") doSearch(); });

    function doSearch() {
      var q = $("q").value.trim();
      if (!q) { $("q").focus(); return; }
      camClose();
      busy($("finderMsg"), "Searching Discogs…");
      $("hits").innerHTML = "";
      search({ q: q }).then(function (list) {
        if (!list.length) {
          say($("finderMsg"), "No releases matched <b>" + esc(q) +
            "</b>. Catalogue numbers work better than titles.", "err");
          return;
        }
        say($("finderMsg"), list.length + " pressings. The pressing decides the price — pick carefully:");
        renderHits(list);
      }).catch(function (e) { say($("finderMsg"), esc(e.message), "err"); });
    }

    $("hits").addEventListener("click", function (e) {
      var li = e.target.closest && e.target.closest("li[data-id]");
      if (!li) return;
      openRelease(li.getAttribute("data-id"), li.getAttribute("data-thumb"));
    });

    $("conds").addEventListener("click", function (e) {
      var c = e.target.getAttribute && e.target.getAttribute("data-cond");
      if (!c) return;
      S.cond = c; persist(); renderConds(); renderMoney();
    });

    $("btnBack").addEventListener("click", function (e) {
      e.preventDefault();
      showResult(false);
      say($("finderMsg"), "");
      $("hits").innerHTML = "";
      $("q").value = "";
    });

    $("btnSave").addEventListener("click", function () {
      if (!cur) return;
      var v = valueFor(S.cond);
      saved.unshift({
        id: String(Date.now()),
        title: (cur.artist ? cur.artist + " — " : "") + cur.title,
        cond: S.cond,
        value: v.value,
        get: v.value == null ? 0 : v.value * (1 - S.cut / 100),
        uri: cur.uri,
        ts: Date.now()
      });
      persist(); renderSaved(); tab("saved");
    });

    $("savedList").addEventListener("click", function (e) {
      var id = e.target.getAttribute && e.target.getAttribute("data-drop");
      if (!id) return;
      saved = saved.filter(function (x) { return x.id !== id; });
      persist(); renderSaved();
    });

    $("btnClearSaved").addEventListener("click", function () {
      if (!saved.length) return;
      if (!window.confirm("Clear every saved find?")) return;
      saved = []; persist(); renderSaved();
    });

    $("set-token").addEventListener("input", function () {
      S.token = this.value.trim(); persist(); renderSettings();
    });
    $("set-cut").addEventListener("input", function () {
      var v = parseFloat(this.value);
      S.cut = isFinite(v) ? Math.min(95, Math.max(0, v)) : 30;
      persist();
      $("cutPill").textContent = "cut " + S.cut + "%";
      renderMoney(); renderSaved();
    });
    $("set-cond").addEventListener("change", function () {
      S.cond = this.value; persist(); renderConds(); renderMoney();
    });
    $("set-aikey").addEventListener("input", function () { S.aiKey = this.value.trim(); persist(); });
    $("set-model").addEventListener("change", function () { S.model = this.value; persist(); });

    $("cutPill").addEventListener("click", function () { tab("setup"); });

    Array.prototype.forEach.call(document.querySelectorAll("nav.tabs button"), function (b) {
      b.addEventListener("click", function () { tab(b.getAttribute("data-tab")); });
    });

    if (!S.token) {
      say($("setupMsg"), "Start with the Discogs token — it is the one thing this app can't work without.", "");
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
