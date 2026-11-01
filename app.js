(function () {
  "use strict";

  var words = [];
  var stats = {};
  var wrongWords = {};
  var profiles = {};
  var history = [];
  var histIndex = -1;
  var direction = "A";
  var mode = "normal";
  var answerShown = false;

  var MODES = ["normal", "bilemediklerim", "sorulmayanlar"];
  var MODE_LABELS = {
    normal: "Normal",
    bilemediklerim: "Bilemediklerim",
    sorulmayanlar: "Sorulmayanlar",
  };

  var STORE = {
    "/api/stats": "lid-stats",
    "/api/wrong-words": "lid-wrong-words",
    "/api/profiles": "lid-profiles",
  };

  var $ = function (id) { return document.getElementById(id); };

  function loadStore(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return {};
      var data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      return {};
    }
  }

  // --- Init ---
  async function init() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function (e) {
        console.error(e);
      });
    }

    try {
      var response = await fetch("all_wortliste.json");
      if (!response.ok) throw new Error("kelime listesi yuklenemedi");
      var wData = await response.json();
      stats = loadStore(STORE["/api/stats"]);
      wrongWords = loadStore(STORE["/api/wrong-words"]);
      profiles = loadStore(STORE["/api/profiles"]);

      var keys = Object.keys(wData);
      for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        var v = wData[id];
        words.push({
          id: id,
          de: v[0],
          tr: v[1].split("\n")[0],
          examples: v[2],
        });
      }

      bindEvents();
      pickNext();
    } catch (e) {
      $("word").textContent = "Yukleme hatasi!";
      console.error(e);
    }
  }

  function bindEvents() {
    // Card actions
    $("btn-show").addEventListener("click", revealAnswer);
    $("btn-correct").addEventListener("click", markCorrect);
    $("btn-wrong").addEventListener("click", markWrong);
    $("btn-prev").addEventListener("click", goPrev);
    $("btn-dir").addEventListener("click", toggleDirection);
    $("btn-mode").addEventListener("click", toggleMode);

    // Menu
    $("btn-menu").addEventListener("click", openMenu);
    $("overlay").addEventListener("click", closeAllSheets);
    $("m-report").addEventListener("click", reportWord);
    $("m-wrong-download").addEventListener("click", downloadWrongWords);
    $("m-stats").addEventListener("click", openStatsManager);
    $("m-close").addEventListener("click", closeAllSheets);

    // Stats manager
    $("s-reset").addEventListener("click", resetStats);
    $("s-back").addEventListener("click", backToMenu);

    // Keyboard
    document.addEventListener("keydown", function (e) {
      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          if (!answerShown) revealAnswer();
          break;
        case "ArrowRight":
          if (answerShown) markCorrect();
          break;
        case "ArrowLeft":
          if (answerShown) markWrong();
          break;
        case "ArrowUp":
          e.preventDefault();
          goPrev();
          break;
        case "Escape":
          closeAllSheets();
          break;
      }
    });
  }

  // --- Card Selection ---
  function pickNext() {
    if (words.length === 0) {
      $("word").textContent = "Kelime kalmadi!";
      $("examples").innerHTML = "";
      $("answer").textContent = "";
      $("btn-show").classList.add("hidden");
      $("result-btns").classList.add("hidden");
      return;
    }

    var pool;

    if (mode === "bilemediklerim") {
      var wrongIds = {};
      var sKeys = Object.keys(stats);
      for (var i = 0; i < sKeys.length; i++) {
        if (stats[sKeys[i]].last === "wrong") wrongIds[sKeys[i]] = true;
      }
      pool = words.filter(function (w) { return wrongIds[w.id]; });
      if (pool.length === 0) pool = words;

    } else if (mode === "sorulmayanlar") {
      var minCount = Infinity;
      var counts = {};
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        var s = stats[w.id];
        var c = s ? s.correct + s.wrong : 0;
        counts[w.id] = c;
        if (c < minCount) minCount = c;
      }
      pool = words.filter(function (w) { return counts[w.id] === minCount; });

    } else {
      pool = words;
    }

    var word = pool[Math.floor(Math.random() * pool.length)];
    histIndex++;
    history = history.slice(0, histIndex);
    history.push(word);
    answerShown = false;
    render();
  }

  function goPrev() {
    if (histIndex > 0) {
      histIndex--;
      answerShown = false;
      render();
    }
  }

  // --- Answer & Scoring ---
  function revealAnswer() {
    if (!answerShown) {
      answerShown = true;
      render();
    }
  }

  function markCorrect() {
    if (!answerShown) return;
    record("correct");
    pickNext();
  }

  function markWrong() {
    if (!answerShown) return;
    record("wrong");
    pickNext();
  }

  function record(result) {
    var wid = history[histIndex].id;
    if (!stats[wid]) stats[wid] = { correct: 0, wrong: 0, last: "-" };
    stats[wid][result]++;
    stats[wid].last = result;
    saveData("/api/stats", stats);
  }

  // --- Toggles ---
  function toggleDirection() {
    direction = direction === "A" ? "T" : "A";
    answerShown = false;
    render();
  }

  function toggleMode() {
    var i = MODES.indexOf(mode);
    mode = MODES[(i + 1) % MODES.length];
    pickNext();
  }

  // --- Menu ---
  function openMenu() {
    $("overlay").classList.add("active");
    $("menu-sheet").classList.add("active");
  }

  function closeAllSheets() {
    $("overlay").classList.remove("active");
    $("menu-sheet").classList.remove("active");
    $("stats-sheet").classList.remove("active");
  }

  function openStatsManager() {
    $("menu-sheet").classList.remove("active");
    renderProfiles();
    $("stats-sheet").classList.add("active");
  }

  function backToMenu() {
    $("stats-sheet").classList.remove("active");
    $("menu-sheet").classList.add("active");
  }

  // --- Report ---
  function reportWord() {
    var w = history[histIndex];
    if (!w) return;
    wrongWords[w.id] = { de: w.de, tr: w.tr, examples: w.examples };
    saveData("/api/wrong-words", wrongWords);
    showFeedback("m-report", "Kaydedildi!");
  }

  // --- Profile Management ---
  function resetStats() {
    var statKeys = Object.keys(stats);
    if (statKeys.length > 0) {
      var now = new Date();
      var months = ["Oca","Sub","Mar","Nis","May","Haz","Tem","Agu","Eyl","Eki","Kas","Ara"];
      var name = "Yedek - " + now.getDate() + " " + months[now.getMonth()] + " " + now.getFullYear();

      var baseName = name;
      var counter = 1;
      while (profiles[name]) {
        counter++;
        name = baseName + " (" + counter + ")";
      }

      profiles[name] = JSON.parse(JSON.stringify(stats));
      saveData("/api/profiles", profiles);
    }

    stats = {};
    saveData("/api/stats", stats);
    renderProfiles();
    render();
    showFeedback("s-reset", "Sifirlandı!");
  }

  function loadProfile(name) {
    stats = JSON.parse(JSON.stringify(profiles[name]));
    saveData("/api/stats", stats);
    closeAllSheets();
    render();
  }

  function deleteProfile(name) {
    delete profiles[name];
    saveData("/api/profiles", profiles);
    renderProfiles();
  }

  function renderProfiles() {
    var list = $("profiles-list");
    list.innerHTML = "";
    var names = Object.keys(profiles);

    if (names.length === 0) {
      list.style.display = "none";
      return;
    }

    list.style.display = "";

    for (var i = 0; i < names.length; i++) {
      (function (name) {
        var profileStats = profiles[name];
        var wordCount = Object.keys(profileStats).length;
        var totalAnswers = 0;
        var pKeys = Object.keys(profileStats);
        for (var j = 0; j < pKeys.length; j++) {
          totalAnswers += (profileStats[pKeys[j]].correct || 0) + (profileStats[pKeys[j]].wrong || 0);
        }

        var item = document.createElement("div");
        item.className = "profile-item";

        var info = document.createElement("div");
        info.className = "profile-info-col";

        var nameEl = document.createElement("div");
        nameEl.className = "profile-name";
        nameEl.textContent = name;

        var statsEl = document.createElement("div");
        statsEl.className = "profile-stats";
        statsEl.textContent = wordCount + " kelime, " + totalAnswers + " cevap";

        info.appendChild(nameEl);
        info.appendChild(statsEl);

        var actions = document.createElement("div");
        actions.className = "profile-actions";

        var loadBtn = document.createElement("button");
        loadBtn.className = "profile-btn profile-load";
        loadBtn.textContent = "Yukle";
        loadBtn.addEventListener("click", function () {
          loadProfile(name);
        });

        var delBtn = document.createElement("button");
        delBtn.className = "profile-btn profile-del";
        delBtn.textContent = "Sil";
        delBtn.addEventListener("click", function () {
          deleteProfile(name);
        });

        actions.appendChild(loadBtn);
        actions.appendChild(delBtn);

        item.appendChild(info);
        item.appendChild(actions);
        list.appendChild(item);
      })(names[i]);
    }
  }

  // --- Wrong Words Download ---
  function downloadWrongWords() {
    var ids = Object.keys(wrongWords);
    if (ids.length === 0) {
      showFeedback("m-wrong-download", "Liste bos!");
      return;
    }
    var exportData = {};
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var w = wrongWords[id];
      exportData[id] = {
        de: w.de,
        tr: w.tr,
        examples: w.examples
      };
    }
    var text = JSON.stringify(exportData, null, 2);
    var blob = new Blob([text], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "hatali_kelimeler.json";
    a.click();
    URL.revokeObjectURL(url);
    showFeedback("m-wrong-download", "Indirildi!");
  }

  // --- Helpers ---
  function saveData(url, data) {
    try {
      localStorage.setItem(STORE[url], JSON.stringify(data));
    } catch (e) {
      console.error(e);
    }
  }

  function showFeedback(btnId, msg) {
    var btn = $(btnId);
    var original = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = original; }, 1200);
  }

  // --- Render ---
  function setExamples(el, examples) {
    el.innerHTML = "";
    for (var i = 0; i < examples.length; i++) {
      var p = document.createElement("p");
      p.textContent = examples[i];
      el.appendChild(p);
    }
  }

  function render() {
    var w = history[histIndex];
    if (!w) return;

    var ws = stats[w.id] || { correct: 0, wrong: 0, last: "-" };
    var wordEl = $("word");
    var exEl = $("examples");
    var ansEl = $("answer");

    if (direction === "A") {
      wordEl.textContent = w.de;
      setExamples(exEl, w.examples);
      exEl.style.display = "";
      ansEl.textContent = answerShown ? w.tr : "";
    } else {
      wordEl.textContent = w.tr;
      if (answerShown) {
        setExamples(exEl, w.examples);
        exEl.style.display = "";
        ansEl.textContent = w.de;
      } else {
        exEl.innerHTML = "";
        exEl.style.display = "none";
        ansEl.textContent = "";
      }
    }

    if (answerShown) {
      ansEl.classList.add("visible");
    } else {
      ansEl.classList.remove("visible");
    }

    wordEl.classList.remove("word-animate");
    void wordEl.offsetWidth;
    wordEl.classList.add("word-animate");

    $("btn-show").classList.toggle("hidden", answerShown);
    $("result-btns").classList.toggle("hidden", !answerShown);

    var dirLabel = direction === "A" ? "DE \u2192 TR" : "TR \u2192 DE";
    $("mode-badge").textContent = MODE_LABELS[mode];
    $("dir-badge").textContent = dirLabel;
    $("btn-dir").textContent = dirLabel;
    $("btn-mode").textContent = MODE_LABELS[mode];

    $("progress-badge").textContent = Object.keys(stats).length + " / " + words.length;

    $("s-c").textContent = ws.correct;
    $("s-w").textContent = ws.wrong;

    var total = 0, hard = 0, correct = 0;
    var statValues = Object.values(stats);
    for (var i = 0; i < statValues.length; i++) {
      total += (statValues[i].correct || 0) + (statValues[i].wrong || 0);
      if (statValues[i].last === "wrong") hard++;
      if (statValues[i].last === "correct") correct++;
    }
    $("s-total").textContent = total;
    $("s-correct").textContent = correct;
    $("s-hard").textContent = hard;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
