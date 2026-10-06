(function () {
  "use strict";

  var PAGE_SIZE = 100;
  var DATA_URL = "added.json";

  var state = {
    entries: [],
    filtered: [],
    page: 1,
    kind: "all",
    version: "all",
    query: "",
  };

  function flatten(payload) {
    var out = [];
    (payload.textmap || []).forEach(function (item) {
      out.push({
        kind: "textmap",
        version: item.v || "",
        zh: item.C || "",
        en: item.E || "",
        label: "文本",
        key: "H" + item.H,
      });
    });
    (payload.talk || []).forEach(function (item) {
      out.push({
        kind: "talk",
        version: item.v || "",
        zh: item.TCH || "",
        en: item.TEN || "",
        speakerZh: item.SCH || "",
        speakerEn: item.SEN || "",
        label: "对话",
        key: "I" + item.I,
      });
    });
    return out;
  }

  function matches(entry) {
    if (state.kind !== "all" && entry.kind !== state.kind) {
      return false;
    }
    if (state.version !== "all" && entry.version !== state.version) {
      return false;
    }
    if (!state.query) {
      return true;
    }
    var needle = state.query.toLowerCase();
    return (
      entry.zh.toLowerCase().indexOf(needle) !== -1 ||
      entry.en.toLowerCase().indexOf(needle) !== -1 ||
      (entry.speakerZh || "").toLowerCase().indexOf(needle) !== -1 ||
      (entry.speakerEn || "").toLowerCase().indexOf(needle) !== -1
    );
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderItem(entry) {
    var parts = ['<div class="tu-item">'];
    parts.push(
      '<div class="tu-meta"><span class="tu-badge">' +
        escapeHtml(entry.label) +
        '</span><span class="tu-badge">' +
        escapeHtml(entry.version) +
        "</span>" +
        escapeHtml(entry.key) +
        "</div>"
    );
    if (entry.kind === "talk" && entry.speakerZh) {
      parts.push('<div class="tu-meta">' + escapeHtml(entry.speakerZh) + "</div>");
    }
    if (entry.zh) {
      parts.push('<div class="tu-zh">' + escapeHtml(entry.zh) + "</div>");
    }
    if (entry.en) {
      parts.push('<div class="tu-en">' + escapeHtml(entry.en) + "</div>");
    }
    parts.push("</div>");
    return parts.join("");
  }

  function render() {
    state.filtered = state.entries.filter(matches);

    var totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    if (state.page > totalPages) {
      state.page = totalPages;
    }
    var start = (state.page - 1) * PAGE_SIZE;
    var slice = state.filtered.slice(start, start + PAGE_SIZE);

    document.getElementById("tu-results").innerHTML = slice.map(renderItem).join("");
    document.getElementById("tu-empty").hidden = state.filtered.length !== 0;
    document.getElementById("tu-page").textContent =
      "第 " + state.page + " / " + totalPages + " 页（共 " + state.filtered.length + " 条）";
    document.getElementById("tu-prev").disabled = state.page <= 1;
    document.getElementById("tu-next").disabled = state.page >= totalPages;
  }

  function fillVersions(payload) {
    var select = document.getElementById("tu-version");
    var seen = [];
    (payload.runs || []).forEach(function (run) {
      if (run.version && seen.indexOf(run.version) === -1) {
        seen.push(run.version);
      }
    });
    seen
      .sort()
      .reverse()
      .forEach(function (version) {
        var option = document.createElement("option");
        option.value = version;
        option.textContent = version;
        select.appendChild(option);
      });
  }

  function renderSummary(payload) {
    var runs = payload.runs || [];
    if (!runs.length) {
      document.getElementById("tu-summary").textContent = "暂无增量记录。";
      return;
    }
    var lines = runs.map(function (run) {
      var counts = run.counts || {};
      return (
        escapeHtml(run.version) +
        "（" +
        escapeHtml((run.recorded_at || "").slice(0, 10)) +
        "）：文本 " +
        (counts.textmap || 0) +
        " 条，对话 " +
        (counts.talk || 0) +
        " 条"
      );
    });
    document.getElementById("tu-summary").innerHTML =
      "共 " +
      (payload.textmap || []).length +
      " 条文本、" +
      (payload.talk || []).length +
      " 条对话，来自 " +
      runs.length +
      " 次更新<br>" +
      lines.join("<br>");
  }

  function bind() {
    var query = document.getElementById("tu-q");
    var debounce = null;
    query.addEventListener("input", function () {
      if (debounce) {
        clearTimeout(debounce);
      }
      debounce = setTimeout(function () {
        state.query = query.value.trim();
        state.page = 1;
        render();
      }, 150);
    });

    document.getElementById("tu-kind").addEventListener("change", function (event) {
      state.kind = event.target.value;
      state.page = 1;
      render();
    });

    document.getElementById("tu-version").addEventListener("change", function (event) {
      state.version = event.target.value;
      state.page = 1;
      render();
    });

    document.getElementById("tu-prev").addEventListener("click", function () {
      if (state.page > 1) {
        state.page -= 1;
        render();
      }
    });

    document.getElementById("tu-next").addEventListener("click", function () {
      state.page += 1;
      render();
    });
  }

  function boot() {
    fetch(DATA_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (payload) {
        state.entries = flatten(payload);
        fillVersions(payload);
        renderSummary(payload);
        bind();
        render();
      })
      .catch(function (error) {
        document.getElementById("tu-summary").textContent =
          "加载 " + DATA_URL + " 失败：" + error.message;
      });
  }

  boot();
})();
