(function () {
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".menu a[data-nav], .nav a[data-nav]"));
  var sections = Array.prototype.slice.call(document.querySelectorAll("section[data-section]"));
  var currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  var pageToNav = {
    "": "home",
    "index.html": "home",
    "produkcje.html": "produkcje",
    "outsourcing.html": "outsourcing",
    "zespol.html": "zespol",
    "ezoteva.html": "ezoteva",
    "hiberman.html": "hiberman",
    "kontakt.html": "kontakt",
  };

  function setActive(key) {
    navLinks.forEach(function (link) {
      var isMatch = link.getAttribute("data-nav") === key;
      link.classList.toggle("is-active", isMatch);
      link.setAttribute("aria-current", isMatch ? "page" : "false");
    });
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      setActive(link.getAttribute("data-nav"));
    });
  });

  if (pageToNav[currentPage] && document.querySelector(".nav")) {
    setActive(pageToNav[currentPage]);
  }

  if ("IntersectionObserver" in window && sections.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            setActive(entry.target.getAttribute("data-section"));
          }
        });
      },
      {
        root: null,
        threshold: 0.45,
      }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }
})();
(function () {
  var memberGrid = document.querySelector(".member-grid");
  if (!memberGrid) {
    return;
  }

  var memberCards = Array.prototype.slice.call(memberGrid.querySelectorAll(".member-card"));
  if (memberCards.length < 2) {
    return;
  }

  var chooseButtons = Array.prototype.slice.call(memberGrid.querySelectorAll(".choose-btn"));
  var autoScrollMs = 8000;
  var autoScrollTimer = null;
  var isPausedByChoose = false;

  function getStepWidth() {
    var firstCard = memberCards[0];
    var styles = window.getComputedStyle(memberGrid);
    var gap = parseFloat(styles.columnGap || styles.gap || "0");
    return firstCard.getBoundingClientRect().width + gap;
  }

  function scrollRight() {
    if (isPausedByChoose) {
      return;
    }

    var step = getStepWidth();
    var maxScrollLeft = memberGrid.scrollWidth - memberGrid.clientWidth;
    var nearEnd = memberGrid.scrollLeft + step >= maxScrollLeft - 4;

    if (nearEnd) {
      memberGrid.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    memberGrid.scrollBy({ left: step, behavior: "smooth" });
  }

  function stopAutoScrollByChoose() {
    if (isPausedByChoose) {
      return;
    }
    isPausedByChoose = true;
    if (autoScrollTimer) {
      window.clearInterval(autoScrollTimer);
      autoScrollTimer = null;
    }
    memberGrid.classList.add("is-paused");
  }

  chooseButtons.forEach(function (button) {
    button.addEventListener("click", stopAutoScrollByChoose);
  });

  autoScrollTimer = window.setInterval(scrollRight, autoScrollMs);
})();

(function () {
  var aboutRoot = document.getElementById("o-nas");
  if (!aboutRoot) {
    return;
  }

  var aboutCharacter = aboutRoot.querySelector(".about-character");
  var thumbsRoot = document.getElementById("about-thumbs");
  var photo = document.getElementById("about-photo");
  var prevButton = document.getElementById("about-prev");
  var nextButton = document.getElementById("about-next");
  var levelEl = document.getElementById("about-lv");
  var nameEl = document.getElementById("about-member-name");
  var statLabelEls = Array.prototype.slice.call(aboutRoot.querySelectorAll("span[id^='about-stat-']"));
  var statValueEls = Array.prototype.slice.call(aboutRoot.querySelectorAll("strong[id^='about-stat-val-']"));
  var statBarEls = Array.prototype.slice.call(aboutRoot.querySelectorAll("i[id^='about-bar-']"));
  var nameplateEl = document.getElementById("about-nameplate");
  var indexEl = document.getElementById("about-index");
  var roleEl = document.getElementById("about-role");
  var skillEls = Array.prototype.slice.call(aboutRoot.querySelectorAll("[id^='about-skill-']"));
  var res1El = document.getElementById("about-res-1");
  var res2El = document.getElementById("about-res-2");
  var res3El = document.getElementById("about-res-3");
  var core1El = document.getElementById("about-core-1");
  var core2El = document.getElementById("about-core-2");
  var core3El = document.getElementById("about-core-3");
  var powerFillEl = document.getElementById("about-power-fill");
  var powerScoreEl = document.getElementById("about-power-score");
  var noteEl = document.getElementById("about-note");

  if (
    !aboutCharacter ||
    !photo ||
    !prevButton ||
    !nextButton ||
    !levelEl ||
    !nameEl ||
    statLabelEls.length < 6 ||
    statValueEls.length < 6 ||
    statBarEls.length < 6 ||
    !nameplateEl ||
    !indexEl ||
    !roleEl ||
    !skillEls.length ||
    !res1El ||
    !res2El ||
    !res3El ||
    !core1El ||
    !core2El ||
    !core3El ||
    !powerFillEl ||
    !powerScoreEl ||
    !noteEl
  ) {
    return;
  }

  var members = [
    {
      level: "LV. 99",
      name: "Jan Wójcik",
      displayName: "Jan\nWójcik",
      role: "Arthur Morgan (RDR2)",
      photo: "assets/team-jan-wojcik.png",
      stats: [
        { label: "AUDIO DESIGN", value: 94 },
        { label: "KOMPOZYCJA", value: 91 },
        { label: "LIVE OPS", value: 84 },
        { label: "E-SPORT", value: 88 },
        { label: "SOUNDTRACK", value: 90 },
        { label: "SOCIAL MEDIA", value: 86 },
      ],
      skills: ["MUZYKA", "E-SPORT", "SOCIAL", "FILM", "INDIE", "NAUCZANIE"],
      resources: ["233.8K", "204.6K", "93.5K"],
      core: ["1830", "1760", "1690"],
      power: { fill: 66, score: "3416" },
      note: "Tworzy muzykę do gier, łączy warsztat kompozytorski z doświadczeniem e-sportowym.",
    },
    {
      level: "LV. 99",
      name: "Karol Michalik",
      role: "Sephiroth / Jack Shephard",
      photo: "assets/team-karol-michalik.png",
      stats: [
        { label: "ART DIRECTION", value: 96 },
        { label: "VFX", value: 92 },
        { label: "LEVEL DESIGN", value: 89 },
        { label: "ANIMACJA", value: 91 },
        { label: "COLOR GRADING", value: 93 },
        { label: "PROCEDURAL WORLD", value: 90 },
      ],
      skills: ["2D/3D", "COLOR", "WORLD", "ANIMACJA", "MONTAŻ", "SZKOLENIA"],
      resources: ["236.1K", "207.9K", "98.2K"],
      core: ["1875", "1810", "1735"],
      power: { fill: 72, score: "3580" },
      note: "Ponad dekada doświadczenia w grafice, animacji i projektowaniu środowisk realtime.",
    },
    {
      level: "LV. 99",
      name: "Piotr Modliński",
      role: "Settlers",
      photo: "assets/team-piotr-modlinski.png",
      stats: [
        { label: "PRODUKCJA", value: 95 },
        { label: "OPERACJE", value: 93 },
        { label: "HR/MKT", value: 88 },
        { label: "BIZNES", value: 94 },
        { label: "STRATEGIA", value: 90 },
        { label: "LEADERSHIP", value: 92 },
      ],
      skills: ["BIZNES", "TEAM", "STRATEGIA", "HR", "PSYCHO", "MEDYCYNA"],
      resources: ["229.4K", "214.8K", "101.2K"],
      core: ["1910", "1880", "1788"],
      power: { fill: 75, score: "3694" },
      note: "Łączy kompetencje operacyjne, produkcyjne i biznesowe z praktyką zarządzania zespołami.",
    },
    {
      level: "LV. 99",
      name: "Mateusz Górny",
      role: "Bezimienny (Planescape Torment)",
      photo: "assets/team-mateusz-gorny.png",
      stats: [
        { label: "SOFTWARE", value: 97 },
        { label: "SYSTEMY", value: 95 },
        { label: "ARCHITEKTURA", value: 92 },
        { label: "SCALING", value: 94 },
        { label: "PROJECT FLOW", value: 90 },
        { label: "PROBLEM SOLVING", value: 93 },
      ],
      skills: ["KOD", "SCALING", "QA", "PROJEKTY", "FINANSE", "BIZNES"],
      resources: ["241.6K", "211.2K", "104.4K"],
      core: ["1940", "1905", "1840"],
      power: { fill: 79, score: "3820" },
      note: "Software developer z wieloletnim doświadczeniem, odpowiedzialny za stabilność systemów.",
    },
    {
      level: "LV. 99",
      name: "Janusz Komorowski",
      role: "Własna, jack-of-all-trades",
      photo: "assets/team-janusz-komorowski.jpg",
      stats: [
        { label: "NARRACJA", value: 93 },
        { label: "KONCEPT", value: 90 },
        { label: "VOICE", value: 87 },
        { label: "KOMIKS", value: 92 },
        { label: "FILM", value: 89 },
        { label: "WORLD BUILDING", value: 90 },
      ],
      skills: ["ART", "ACTING", "STORY", "KOMIKS", "FILM", "GŁOS"],
      resources: ["226.7K", "208.3K", "97.6K"],
      core: ["1860", "1790", "1742"],
      power: { fill: 69, score: "3512" },
      note: "Twórca łączący film, komiks i game dev; wspiera projekty wizualnie i narracyjnie.",
    },
  ];

  var index = 0;
  var thumbButtons = [];

  function asTwoDigits(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function syncThumbs() {
    if (!thumbButtons.length) {
      return;
    }

    thumbButtons.forEach(function (button, buttonIndex) {
      var isActive = buttonIndex === index;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function buildThumbs() {
    if (!thumbsRoot) {
      return;
    }

    thumbsRoot.innerHTML = "";
    thumbButtons = [];

    members.forEach(function (member, memberIndex) {
      var button = document.createElement("button");
      var image = document.createElement("img");
      var label = document.createElement("span");

      button.type = "button";
      button.className = "about-thumb";
      button.setAttribute("aria-label", "Wybierz profil: " + member.name);
      button.setAttribute("aria-pressed", "false");

      image.src = member.photo;
      image.alt = member.name;
      image.loading = "lazy";

      label.className = "about-thumb-name";
      label.textContent = member.displayName || member.name;

      button.appendChild(image);
      button.appendChild(label);

      button.addEventListener("click", function () {
        if (memberIndex === index) {
          return;
        }
        var direction = memberIndex < index ? "prev" : "next";
        index = memberIndex;
        render(direction);
      });

      thumbsRoot.appendChild(button);
      thumbButtons.push(button);
    });
  }

  function render(direction) {
    var item = members[index];
    var displayName = item.displayName || item.name;

    levelEl.textContent = item.level;
    nameEl.textContent = displayName;
    statLabelEls.forEach(function (statLabelEl, statIndex) {
      var stat = item.stats[statIndex] || item.stats[item.stats.length - 1];
      statLabelEl.textContent = stat.label;
    });
    statValueEls.forEach(function (statValueEl, statIndex) {
      var stat = item.stats[statIndex] || item.stats[item.stats.length - 1];
      statValueEl.textContent = String(stat.value);
    });
    statBarEls.forEach(function (statBarEl, statIndex) {
      var stat = item.stats[statIndex] || item.stats[item.stats.length - 1];
      statBarEl.style.setProperty("--v", stat.value + "%");
    });
    nameplateEl.textContent = displayName;
    indexEl.textContent = asTwoDigits(index + 1) + " / " + asTwoDigits(members.length);
    roleEl.textContent = item.role;
    skillEls.forEach(function (skillEl, skillIndex) {
      skillEl.textContent = item.skills[skillIndex] || "QFS";
    });
    res1El.textContent = item.resources[0];
    res2El.textContent = item.resources[1];
    res3El.textContent = item.resources[2];
    core1El.textContent = item.core[0];
    core2El.textContent = item.core[1];
    core3El.textContent = item.core[2];
    powerFillEl.style.width = item.power.fill + "%";
    powerScoreEl.textContent = item.power.score;
    noteEl.textContent = item.note;

    photo.src = item.photo;
    photo.alt = "Profil postaci - " + item.name;

    aboutCharacter.classList.remove("is-switch-next", "is-switch-prev");
    void aboutCharacter.offsetWidth;
    aboutCharacter.classList.add(direction === "prev" ? "is-switch-prev" : "is-switch-next");
    syncThumbs();
  }

  function move(step) {
    index = (index + step + members.length) % members.length;
    render(step < 0 ? "prev" : "next");
  }

  prevButton.addEventListener("click", function () {
    move(-1);
  });

  nextButton.addEventListener("click", function () {
    move(1);
  });

  buildThumbs();
  render("next");
})();

(function () {
  var params = new URLSearchParams(window.location.search);
  var status = params.get("brief");
  if (!status) {
    return;
  }

  var forms = Array.prototype.slice.call(document.querySelectorAll(".deploy-form"));
  if (!forms.length) {
    return;
  }

  var isSuccess = status === "sent";
  var message = isSuccess
    ? "Dziekujemy! Brief zostal bezpiecznie wyslany."
    : "Nie udalo sie wyslac briefu. Sprawdz pola i sprobuj ponownie.";

  forms.forEach(function (form) {
    var feedback = form.querySelector(".deploy-form-feedback");
    if (!feedback) {
      feedback = document.createElement("p");
      feedback.className = "deploy-form-feedback";
      form.appendChild(feedback);
    }

    feedback.textContent = message;
    feedback.classList.toggle("is-success", isSuccess);
    feedback.classList.toggle("is-error", !isSuccess);
    feedback.setAttribute("role", "status");
  });

  if (window.history && window.history.replaceState) {
    params.delete("brief");
    var query = params.toString();
    var cleanUrl = window.location.pathname + (query ? "?" + query : "") + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }
})();

/* Mobile hamburger: inject a toggle into the header and drive a full-screen
   overlay menu. Marks <html> with `nav-ready` so the overlay CSS only kicks in
   when JS is available; without JS the existing scroll menu stays. */
(function () {
  var header = document.querySelector(".chrome, .topbar");
  if (!header) {
    return;
  }

  var nav = header.querySelector(".menu, .nav");
  if (!nav) {
    return;
  }

  var root = document.documentElement;
  root.classList.add("nav-ready");

  if (!nav.id) {
    nav.id = "primary-nav";
  }

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "nav-toggle";
  toggle.setAttribute("aria-label", "Menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", nav.id);
  toggle.innerHTML = '<span class="nav-toggle-bars" aria-hidden="true"></span>';
  header.appendChild(toggle);

  function setOpen(open) {
    root.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  toggle.addEventListener("click", function () {
    setOpen(!root.classList.contains("nav-open"));
  });

  nav.addEventListener("click", function (event) {
    if (event.target === nav || event.target.closest("a")) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && root.classList.contains("nav-open")) {
      setOpen(false);
    }
  });
})();

/* Brief / formularz kontaktowy: wysyłka AJAX-em zamiast pełnego POST-a, żeby po
   wysłaniu pokazać duże potwierdzenie w miejscu formularza (bez przeładowania i
   bez przerzucania na /kontakt z mini-komunikatem na dole). Obsługuje każdy
   formularz .deploy-form (strona główna i podstrona kontakt). Serwer rozpoznaje
   nagłówek Accept: application/json i zwraca {ok,message}. */
(function () {
  var forms = document.querySelectorAll(".deploy-form");
  if (!forms.length) {
    return;
  }

  function removeError(form) {
    var existing = form.querySelector(".brief-error");
    if (existing) {
      existing.remove();
    }
  }

  function showError(form, message) {
    removeError(form);
    var note = document.createElement("p");
    note.className = "brief-error";
    note.setAttribute("role", "alert");
    note.textContent = message;
    form.appendChild(note);
  }

  function showSuccess(form, message) {
    var panel = document.createElement("div");
    panel.className = "brief-success";
    panel.setAttribute("role", "status");
    panel.innerHTML =
      '<span class="brief-success-icon" aria-hidden="true"></span>' +
      "<h3>Brief wysłany!</h3>" +
      "<p></p>";
    panel.querySelector("p").textContent =
      message || "Dziękujemy — odezwiemy się z planem wdrożenia.";
    form.replaceWith(panel);
  }

  Array.prototype.forEach.call(forms, function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');
      var prevLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Wysyłanie…";
      }
      removeError(form);

      function restore() {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = prevLabel || "Wyślij brief";
        }
      }

      fetch(form.getAttribute("action") || "/api/contact-brief", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams(new FormData(form)),
      })
        .then(function (response) {
          return response
            .json()
            .then(function (data) {
              return { ok: response.ok && data && data.ok !== false, data: data };
            })
            .catch(function () {
              return { ok: response.ok, data: null };
            });
        })
        .then(function (result) {
          if (result.ok) {
            showSuccess(form, result.data && result.data.message);
          } else {
            showError(
              form,
              (result.data && result.data.message) ||
                "Nie udało się wysłać briefu. Spróbuj ponownie."
            );
            restore();
          }
        })
        .catch(function () {
          showError(form, "Brak połączenia z serwerem. Spróbuj ponownie za chwilę.");
          restore();
        });
    });
  });

  // Linki kierujące do formularza mogą wstępnie wypełnić pole zakresu
  // (np. „Aplikuj do zespołu" zamiast osobnego maila rekrutacyjnego).
  Array.prototype.forEach.call(
    document.querySelectorAll("[data-brief-prefill]"),
    function (link) {
      link.addEventListener("click", function () {
        var scope = document.querySelector('.deploy-form [name="scope"]');
        if (!scope) {
          return;
        }
        var prefill = link.getAttribute("data-brief-prefill") || "";
        if (prefill && scope.value.indexOf(prefill) === -1) {
          scope.value = prefill;
        }
        window.setTimeout(function () {
          scope.focus();
          scope.setSelectionRange(scope.value.length, scope.value.length);
        }, 320);
      });
    }
  );
})();

