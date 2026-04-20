(function () {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.matchMedia("(max-width: 900px)").matches;

  const topbar = document.querySelector(".chrome, .alt-topbar");
  const hero = document.getElementById("top");
  const services = document.getElementById("services");
  const laptop = document.getElementById("hero-laptop");
  const laptopBase = document.getElementById("hero-laptop-base");
  const heroCopy = document.querySelector(".hero-copy");
  const heroScreen = document.getElementById("hero-screen");
  const heroScreenOverlay = document.getElementById("hero-screen-overlay");
  const heroHint = document.getElementById("hero-enter-hint");

  const diveLayer = document.getElementById("monitor-dive-layer");
  const diveViewport = document.getElementById("monitor-dive-viewport");
  const diveHud = document.querySelector(".dive-hud");

  const SERVICE_STORAGE_KEY = "qfs-outsourcing-services-v1";
  const STORYTELLING_IMAGE_URL = "assets/outsourcing/storytelling.webp";
  const MODELING_IMAGE_URL = "assets/outsourcing/modeling-2d.png";
  const SFX_VFX_VIDEO_URL = "assets/outsourcing/vfx.mp4";
  const PRODUCTION_RELEASE_IMAGE_URL = "assets/hiberman.png";
  const PRODUCTION_RELEASE_IMAGE_SECONDARY_URL = "assets/ezoteva.jpg";
  const LEVEL_DESIGN_VIDEO_URL = "https://www.youtube.com/embed/5HGbW4pt8VQ";
  const LEGACY_LEVEL_DESIGN_VIDEO_URLS = new Set([
    "https://www.youtube.com/embed/bzLGNP6pr2E",
    "https://www.youtube.com/watch?v=bzLGNP6pr2E",
    "https://youtu.be/bzLGNP6pr2E",
    "https://www.youtube.com/embed/_hivK4Kh9pUi",
    "https://www.youtube.com/watch?v=_hivK4Kh9pUi",
    "https://youtu.be/_hivK4Kh9pUi",
  ]);
  const DEFAULT_SERVICES = [
    { id: "game-design", title: "Game Design", description: "Projektujemy petle rozgrywki, systemy, ekonomie i dokumentacje GDD/TDD.", image: "", video: LEVEL_DESIGN_VIDEO_URL, examples: ["Core loop design", "Balans systemow", "Dokumentacja GDD/TDD"] },
    { id: "animacja", title: "Animacja", description: "Tworzymy animacje gameplayowe, cutsceny i interakcje srodowiskowe.", image: "", video: "", examples: ["Animacje gameplayowe", "Cutsceny", "Interakcje srodowiskowe"] },
    { id: "storytelling", title: "Storytelling", description: "Budujemy narracje, questy i pacing, ktory wzmacnia immersje gracza.", image: STORYTELLING_IMAGE_URL, video: "", examples: ["Narracja questowa", "Dialogi i pacing", "Dokumentacja lore"] },
    { id: "programming", title: "Programming", description: "Implementujemy mechaniki, AI, fizyke i stabilne systemy technologiczne.", image: "assets/outsourcing/programming.jpg", video: "", examples: ["Mechaniki gameplay", "AI i zachowania", "Integracja systemow"] },
    { id: "modeling", title: "3D / 2D Modeling", description: "Dostarczamy assety zgodne ze stylem projektu i wymaganiami wydajnosci.", image: MODELING_IMAGE_URL, video: "", examples: ["Assety 3D", "Elementy 2D", "Optymalizacja assetow"] },
    { id: "sfx-vfx", title: "SFX / VFX", description: "Tworzymy warstwe dzwieku i efektow, ktora wzmacnia feedback i klimat gry.", image: "", video: SFX_VFX_VIDEO_URL, examples: ["Efekty dzwiekowe", "VFX gameplayowe", "Mix pod platforme"] },
    { id: "level-design", title: "Level Design", description: "Projektujemy mapy, flow i punkty zainteresowania pod konkretne cele gracza.", image: "assets/outsourcing/level-design.jpg", video: LEVEL_DESIGN_VIDEO_URL, examples: ["Greybox i layout", "Flow gracza", "Balans eksploracji"] },
    { id: "production-release", title: "Produkcja i wydanie", description: "Prowadzimy QA, optymalizacje i wsparcie release pod realne terminy.", image: PRODUCTION_RELEASE_IMAGE_URL, imageGallery: [PRODUCTION_RELEASE_IMAGE_URL, PRODUCTION_RELEASE_IMAGE_SECONDARY_URL], video: "", examples: ["QA passy", "Stabilizacja buildu", "Release checklist"] },
  ];

  initReveal();
  initNavState();
  initSmoothAnchors();
  initServicesWorkspace();
  initDashboardCanvas("screen-canvas", 1);
  const useDiveTransition = !prefersReduced && !isMobile;
  if (useDiveTransition) {
    initDashboardCanvas("dive-canvas", 1.15);
    initHeroScrollTransition();
  } else {
    initStaticMonitorMode();
  }
  initStaticBackground();

  function getTopbarHeight() {
    return topbar ? topbar.offsetHeight : 72;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function initStaticBackground() {
    const bg = document.getElementById("webgl-bg");
    if (!bg) return;
    const ctx = bg.getContext("2d");
    const draw = () => {
      bg.width = window.innerWidth;
      bg.height = window.innerHeight;
      const g = ctx.createLinearGradient(0, 0, bg.width, bg.height);
      g.addColorStop(0, "#050916");
      g.addColorStop(0.6, "#0a1230");
      g.addColorStop(1, "#060a18");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, bg.width, bg.height);
    };
    draw();
    window.addEventListener("resize", draw);
  }

  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length || !window.IntersectionObserver) {
      items.forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.style.opacity = "1";
          entry.target.style.transform = "none";
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1 }
    );

    items.forEach((el) => observer.observe(el));
  }

  function initNavState() {
    const links = Array.from(document.querySelectorAll(".alt-nav a[href^='#']"));
    if (!links.length || !services) return;

    const update = () => {
      const marker = window.scrollY + getTopbarHeight() + 120;
      const activeId = marker >= services.offsetTop ? "services" : "top";
      links.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
      });
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function initSmoothAnchors() {
    let scrollAnimationFrame = null;

    const stopAnimatedScroll = () => {
      if (scrollAnimationFrame) {
        window.cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationFrame = null;
      }
    };

    const animateScrollTo = (targetTop, durationMs) => {
      if (prefersReduced) {
        window.scrollTo(0, targetTop);
        return;
      }

      stopAnimatedScroll();
      const startTop = window.scrollY;
      const distance = targetTop - startTop;
      if (Math.abs(distance) < 1) return;
      const startedAt = performance.now();

      const step = (now) => {
        const progress = clamp((now - startedAt) / durationMs, 0, 1);
        const eased = easeInOutCubic(progress);
        window.scrollTo(0, startTop + distance * eased);
        if (progress < 1) {
          scrollAnimationFrame = window.requestAnimationFrame(step);
        } else {
          scrollAnimationFrame = null;
        }
      };

      scrollAnimationFrame = window.requestAnimationFrame(step);
    };

    document.querySelectorAll("a[href^='#']").forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("href");
        if (!targetId || targetId === "#") return;

        const target = document.querySelector(targetId);
        if (!target) return;

        event.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - (targetId === "#services" ? getTopbarHeight() : 0);
        // We intentionally slow down the travel to the monitor section to make the transition more cinematic.
        if (targetId === "#services") {
          animateScrollTo(top, 2600);
          return;
        }
        window.scrollTo({ top, behavior: "smooth" });
      });
    });
  }

  function slugify(value, fallback) {
    const raw = String(value || fallback || "service").toLowerCase().trim();
    const slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
    return slug || String(fallback || "service");
  }

  function normalizeVideoUrl(value) {
    const input = String(value || "").trim();
    if (!input) return "";

    if (input.includes("youtube.com/watch")) {
      try {
        const url = new URL(input);
        const id = url.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}`;
      } catch (error) {}
    }

    if (input.includes("youtu.be/")) {
      const id = input.split("youtu.be/")[1]?.split(/[?&]/)[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    return input;
  }

  function isDirectVideoFile(value) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(value || "").trim());
  }

  function sanitizeServiceEntry(entry, index) {
    const fallbackTitle = `Usluga ${index + 1}`;
    const title = String(entry?.title || fallbackTitle).trim().slice(0, 80);
    const description = String(entry?.description || "").trim().slice(0, 600);
    const image = String(entry?.image || "").trim().slice(0, 240);
    const imageSecondary = String(entry?.imageSecondary || "").trim().slice(0, 240);
    const video = normalizeVideoUrl(String(entry?.video || "").slice(0, 240));
    const id = slugify(entry?.id || title, `service-${index + 1}`);
    const imageGallery = Array.isArray(entry?.imageGallery)
      ? entry.imageGallery
          .map((item) => String(item || "").trim().slice(0, 240))
          .filter(Boolean)
          .slice(0, 8)
      : [];
    const videoGallery = Array.isArray(entry?.videoGallery)
      ? entry.videoGallery
          .map((item) => normalizeVideoUrl(String(item || "").trim().slice(0, 240)))
          .filter(Boolean)
          .slice(0, 8)
      : [];
    const examples = Array.isArray(entry?.examples)
      ? entry.examples.map((item) => String(item || "").trim().slice(0, 90)).filter(Boolean).slice(0, 6)
      : [];

    return {
      id,
      title: title || fallbackTitle,
      description,
      image,
      imageSecondary,
      imageGallery,
      video,
      videoGallery,
      examples,
    };
  }

  function cloneServices(sourceList) {
    return sourceList.map((entry, index) => sanitizeServiceEntry(entry, index));
  }

  function loadServicesFromStorage() {
    try {
      const raw = window.localStorage.getItem(SERVICE_STORAGE_KEY);
      if (!raw) return cloneServices(DEFAULT_SERVICES);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return cloneServices(DEFAULT_SERVICES);
      const sanitized = parsed.map((entry, index) => sanitizeServiceEntry(entry, index));
      let migrated = false;
      const migratedServices = sanitized.map((service) => {
        if (service.id === "storytelling" && !service.image) {
          migrated = true;
          return { ...service, image: STORYTELLING_IMAGE_URL };
        }
        if (service.id === "game-design" && !service.video) {
          migrated = true;
          return { ...service, video: LEVEL_DESIGN_VIDEO_URL };
        }
        if (service.id === "modeling" && (!service.image || service.image === "assets/outsourcing/3d2d.jpg")) {
          migrated = true;
          return { ...service, image: MODELING_IMAGE_URL };
        }
        if (service.id === "sfx-vfx" && !service.video) {
          migrated = true;
          return { ...service, video: SFX_VFX_VIDEO_URL };
        }
        if (service.id === "production-release" && (!service.image || !service.imageSecondary)) {
          migrated = true;
          return {
            ...service,
            image: service.image || PRODUCTION_RELEASE_IMAGE_URL,
            imageSecondary: service.imageSecondary || PRODUCTION_RELEASE_IMAGE_SECONDARY_URL,
            imageGallery: Array.isArray(service.imageGallery) && service.imageGallery.length
              ? service.imageGallery
              : [service.image || PRODUCTION_RELEASE_IMAGE_URL, service.imageSecondary || PRODUCTION_RELEASE_IMAGE_SECONDARY_URL].filter(Boolean),
          };
        }
        if (service.id === "level-design" && LEGACY_LEVEL_DESIGN_VIDEO_URLS.has(service.video)) {
          migrated = true;
          return { ...service, video: LEVEL_DESIGN_VIDEO_URL };
        }
        return service;
      });
      if (migrated) {
        persistServicesToStorage(migratedServices);
      }
      return migratedServices;
    } catch (error) {
      return cloneServices(DEFAULT_SERVICES);
    }
  }

  function persistServicesToStorage(servicesList) {
    try {
      window.localStorage.setItem(SERVICE_STORAGE_KEY, JSON.stringify(servicesList));
    } catch (error) {}
  }

  function initServicesWorkspace() {
    const listNode = document.getElementById("services-list");
    const form = document.getElementById("service-editor-form");
    const editorWrap = document.querySelector(".service-editor-wrap");
    const resetButton = document.getElementById("service-reset-button");
    const statusNode = document.getElementById("service-editor-status");
    const titleInput = document.getElementById("service-title-input");
    const descriptionInput = document.getElementById("service-description-input");
    const previewTitle = document.getElementById("service-preview-title");
    const previewDescription = document.getElementById("service-preview-description");
    const previewImageCarousel = document.getElementById("service-preview-image-carousel");
    const previewImagePrev = document.getElementById("service-preview-image-prev");
    const previewImageNext = document.getElementById("service-preview-image-next");
    const previewImage = document.getElementById("service-preview-image");
    const previewImageFallback = document.getElementById("service-preview-image-fallback");
    const previewImageEmpty = document.getElementById("service-preview-image-empty");
    const previewVideoWrap = document.getElementById("service-preview-video-wrap");
    const previewVideoPrev = document.getElementById("service-preview-video-prev");
    const previewVideoNext = document.getElementById("service-preview-video-next");
    const previewVideoFallback = document.getElementById("service-preview-video-fallback");
    const previewVideo = document.getElementById("service-preview-video");
    const previewVideoFile = document.getElementById("service-preview-video-file");
    const previewVideoEmpty = document.getElementById("service-preview-video-empty");
    const previewExamples = document.getElementById("service-preview-examples");

    if (!listNode || !form || !resetButton || !titleInput || !descriptionInput || !previewTitle || !previewDescription || !previewImageCarousel || !previewImagePrev || !previewImageNext || !previewImage || !previewImageFallback || !previewImageEmpty || !previewVideoWrap || !previewVideoPrev || !previewVideoNext || !previewVideoFallback || !previewVideo || !previewVideoFile || !previewVideoEmpty || !previewExamples) {
      return;
    }

    let servicesData = loadServicesFromStorage();
    let selectedId = servicesData[0]?.id || "";
    let currentPreviewService = null;
    let currentImageIndex = 0;
    let currentVideoIndex = 0;

    const getCurrentService = () => servicesData.find((entry) => entry.id === selectedId) || servicesData[0] || null;
    if (editorWrap) {
      editorWrap.open = true;
      editorWrap.addEventListener("toggle", () => {
        if (!editorWrap.open) editorWrap.open = true;
      });
    }

    const renderServiceList = () => {
      listNode.innerHTML = "";
      servicesData.forEach((service) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "service-nav-item";
        if (service.id === selectedId) button.classList.add("is-active");
        button.textContent = service.title;
        button.addEventListener("click", () => {
          selectedId = service.id;
          renderServiceList();
          fillFormFromCurrent();
          renderPreviewFromCurrent();
          if (statusNode) statusNode.textContent = "";
        });
        li.appendChild(button);
        listNode.appendChild(li);
      });
    };

    const fillFormFromCurrent = () => {
      const current = getCurrentService();
      if (!current) return;
      titleInput.value = current.title;
      descriptionInput.value = current.description;
    };

    const showImageFallback = () => {
      previewImageCarousel.hidden = true;
      previewImage.removeAttribute("src");
      previewImageFallback.hidden = false;
      previewImageEmpty.hidden = true;
    };

    const showVideoFallback = () => {
      previewVideoWrap.hidden = true;
      previewVideo.src = "";
      previewVideo.hidden = true;
      previewVideoFile.pause();
      previewVideoFile.hidden = true;
      previewVideoFile.removeAttribute("src");
      previewVideoFallback.hidden = false;
      previewVideoEmpty.hidden = true;
    };

    const getImageList = (service) => {
      const list = [];
      if (Array.isArray(service?.imageGallery)) {
        service.imageGallery.forEach((item) => {
          const value = String(item || "").trim();
          if (value) list.push(value);
        });
      }
      if (service?.image) list.push(String(service.image).trim());
      if (service?.imageSecondary) list.push(String(service.imageSecondary).trim());
      return Array.from(new Set(list.filter(Boolean)));
    };

    const getVideoList = (service) => {
      const list = [];
      if (Array.isArray(service?.videoGallery)) {
        service.videoGallery.forEach((item) => {
          const value = normalizeVideoUrl(String(item || "").trim());
          if (value) list.push(value);
        });
      }
      if (service?.video) list.push(normalizeVideoUrl(String(service.video).trim()));
      return Array.from(new Set(list.filter(Boolean)));
    };

    const configureArrowState = (carouselEl, prevButton, nextButton, count) => {
      const showArrows = count > 1;
      carouselEl.classList.toggle("is-multi", showArrows);
      prevButton.hidden = !showArrows;
      nextButton.hidden = !showArrows;
    };

    const renderPreview = (service, preserveIndices = false) => {
      previewTitle.textContent = service.title;
      previewDescription.textContent = service.description || "Brak opisu.";
      currentPreviewService = service;

      const imageList = getImageList(service);
      const videoList = getVideoList(service);

      if (!preserveIndices) {
        currentImageIndex = 0;
        currentVideoIndex = 0;
      }

      if (imageList.length) {
        currentImageIndex = ((currentImageIndex % imageList.length) + imageList.length) % imageList.length;
      } else {
        currentImageIndex = 0;
      }

      if (imageList.length) {
        const imageSrc = imageList[currentImageIndex];
        previewImage.onerror = null;
        previewImageCarousel.hidden = false;
        previewImage.src = imageSrc;
        previewImage.alt = service.title;
        configureArrowState(previewImageCarousel, previewImagePrev, previewImageNext, imageList.length);
        previewImageFallback.hidden = true;
        previewImageEmpty.hidden = true;
        previewImage.onerror = () => {
          previewImage.onerror = null;
          showImageFallback();
        };
      } else {
        showImageFallback();
      }

      if (videoList.length) {
        currentVideoIndex = ((currentVideoIndex % videoList.length) + videoList.length) % videoList.length;
        const videoSrc = videoList[currentVideoIndex];
        previewVideoWrap.hidden = false;
        configureArrowState(previewVideoWrap, previewVideoPrev, previewVideoNext, videoList.length);
        if (isDirectVideoFile(videoSrc)) {
          previewVideoFile.onerror = null;
          previewVideo.hidden = true;
          previewVideo.src = "";
          previewVideoFile.hidden = false;
          previewVideoFile.src = videoSrc;
          previewVideoFile.onerror = () => {
            previewVideoFile.onerror = null;
            showVideoFallback();
          };
        } else {
          previewVideo.hidden = false;
          previewVideo.src = videoSrc;
          previewVideoFile.pause();
          previewVideoFile.hidden = true;
          previewVideoFile.removeAttribute("src");
        }
        previewVideoFallback.hidden = true;
        previewVideoEmpty.hidden = true;
      } else {
        showVideoFallback();
      }

      previewExamples.innerHTML = "";
      const examplesToRender = Array.isArray(service.examples) && service.examples.length ? service.examples : ["Zakres do ustalenia podczas kick-offu."];
      examplesToRender.forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = entry;
        previewExamples.appendChild(li);
      });
    };

    const renderPreviewFromCurrent = () => {
      const current = getCurrentService();
      if (!current) return;
      renderPreview(current);
    };

    const previewFromForm = () => {
      const current = getCurrentService();
      if (!current) return;
      renderPreview(
        sanitizeServiceEntry(
          {
            id: current.id,
            title: titleInput.value,
            description: descriptionInput.value,
            image: current.image || "",
            imageSecondary: current.imageSecondary || "",
            imageGallery: current.imageGallery || [],
            video: current.video || "",
            videoGallery: current.videoGallery || [],
            examples: current.examples,
          },
          0
        )
      );
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const current = getCurrentService();
      if (!current) return;

      const idx = servicesData.findIndex((entry) => entry.id === current.id);
      if (idx === -1) return;

      const next = sanitizeServiceEntry(
        {
          id: current.id,
          title: titleInput.value,
          description: descriptionInput.value,
          image: current.image || "",
          imageSecondary: current.imageSecondary || "",
          imageGallery: current.imageGallery || [],
          video: current.video || "",
          videoGallery: current.videoGallery || [],
          examples: current.examples,
        },
        idx
      );

      servicesData[idx] = next;
      persistServicesToStorage(servicesData);
      renderServiceList();
      renderPreview(next);
      if (statusNode) statusNode.textContent = "Zmiany zapisane lokalnie.";
    });

    ["input", "change"].forEach((eventName) => form.addEventListener(eventName, previewFromForm));

    resetButton.addEventListener("click", () => {
      servicesData = cloneServices(DEFAULT_SERVICES);
      selectedId = servicesData[0]?.id || "";
      try {
        window.localStorage.removeItem(SERVICE_STORAGE_KEY);
      } catch (error) {}
      renderServiceList();
      fillFormFromCurrent();
      renderPreviewFromCurrent();
      if (statusNode) statusNode.textContent = "Przywrocono domyslne uslugi.";
    });

    previewImagePrev.addEventListener("click", () => {
      if (!currentPreviewService) return;
      const imageList = getImageList(currentPreviewService);
      if (imageList.length <= 1) return;
      currentImageIndex = (currentImageIndex - 1 + imageList.length) % imageList.length;
      renderPreview(currentPreviewService, true);
    });

    previewImageNext.addEventListener("click", () => {
      if (!currentPreviewService) return;
      const imageList = getImageList(currentPreviewService);
      if (imageList.length <= 1) return;
      currentImageIndex = (currentImageIndex + 1) % imageList.length;
      renderPreview(currentPreviewService, true);
    });

    previewVideoPrev.addEventListener("click", () => {
      if (!currentPreviewService) return;
      const videoList = getVideoList(currentPreviewService);
      if (videoList.length <= 1) return;
      currentVideoIndex = (currentVideoIndex - 1 + videoList.length) % videoList.length;
      renderPreview(currentPreviewService, true);
    });

    previewVideoNext.addEventListener("click", () => {
      if (!currentPreviewService) return;
      const videoList = getVideoList(currentPreviewService);
      if (videoList.length <= 1) return;
      currentVideoIndex = (currentVideoIndex + 1) % videoList.length;
      renderPreview(currentPreviewService, true);
    });

    renderServiceList();
    fillFormFromCurrent();
    renderPreviewFromCurrent();
  }

  function initHeroScrollTransition() {
    if (!hero || !services || !laptop || !heroCopy || !heroScreen || !diveLayer || !diveViewport) return;

    let startRect = heroScreen.getBoundingClientRect();

    const recalc = () => {
      if (window.scrollY < hero.offsetTop + 40) {
        startRect = heroScreen.getBoundingClientRect();
      }
    };

    const updateDiveOverlay = (progress) => {
      const p = clamp(progress, 0, 1);
      const e = easeInOutCubic(p);
      const shouldShow = p > 0.03;
      const isEntered = p >= 0.9;

      if (!shouldShow) {
        diveLayer.classList.remove("is-active");
        diveLayer.classList.remove("is-entered");
        if (diveHud) diveHud.style.opacity = "0";
        diveViewport.style.opacity = "0";
        return;
      }

      const topbarHeight = getTopbarHeight();
      const endRect = {
        left: 0,
        top: topbarHeight,
        width: window.innerWidth,
        height: window.innerHeight - topbarHeight,
      };

      const left = lerp(startRect.left, endRect.left, e);
      const top = lerp(startRect.top, endRect.top, e);
      const width = lerp(startRect.width, endRect.width, e);
      const height = lerp(startRect.height, endRect.height, e);
      const radius = lerp(14, 0, e);

      diveViewport.style.left = `${left}px`;
      diveViewport.style.top = `${top}px`;
      diveViewport.style.width = `${width}px`;
      diveViewport.style.height = `${height}px`;
      diveViewport.style.borderRadius = `${radius}px`;
      diveViewport.style.opacity = String(clamp((p - 0.02) / 0.98, 0, 1));

      if (diveHud) {
        diveHud.style.opacity = String(clamp((p - 0.08) / 0.92, 0, 1));
      }

      diveLayer.classList.add("is-active");
      diveLayer.classList.toggle("is-entered", isEntered);
    };

    const update = () => {
      const total = Math.max(1, hero.offsetHeight - window.innerHeight);
      const raw = (window.scrollY - hero.offsetTop) / total;
      const p = clamp(raw, 0, 1);
      const e = easeInOutCubic(p);

      const rx = lerp(14, 0, e);
      const ry = lerp(-18, 0, e);
      const rz = lerp(2, 0, e);
      const scale = lerp(1, 5.1, e);
      const ty = lerp(0, -window.innerHeight * 0.22, e);

      laptop.style.transform = `translate3d(0, ${ty}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`;
      heroCopy.style.opacity = String(clamp(1 - e * 1.25, 0, 1));

      if (laptopBase) {
        laptopBase.style.opacity = String(clamp(1 - clamp((p - 0.22) / 0.28, 0, 1), 0, 1));
      }
      if (heroScreenOverlay) {
        heroScreenOverlay.style.opacity = String(clamp(1 - clamp((p - 0.34) / 0.22, 0, 1), 0, 1));
      }
      if (heroHint) {
        heroHint.style.opacity = String(clamp(1 - clamp((p - 0.28) / 0.2, 0, 1), 0, 1));
      }

      const diveProgress = clamp((p - 0.12) / 0.78, 0, 1);
      updateDiveOverlay(diveProgress);

      if (p < 0.03) recalc();
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", () => {
      recalc();
      update();
    });

    setTimeout(() => {
      recalc();
      update();
    }, 120);
  }

  function initStaticMonitorMode() {
    if (!services || !diveLayer) return;
    const monitorShell = document.getElementById("monitor-shell-screen");
    if (!monitorShell) return;

    document.body.classList.add("monitor-static-mode");

    const spacer = services.querySelector(".monitor-scroll-spacer");
    if (spacer) spacer.remove();

    const wrap = document.createElement("div");
    wrap.className = "monitor-static-wrap";
    wrap.appendChild(monitorShell);
    services.appendChild(wrap);

    diveLayer.remove();
  }

  function initDashboardCanvas(canvasId, intensity) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    const pointsA = Array.from({ length: 56 }, (_, i) => ({ x: (i / 55) * (w * 0.52), seed: Math.random() * 10 }));
    const pointsB = Array.from({ length: 56 }, (_, i) => ({ x: (i / 55) * (w * 0.52), seed: Math.random() * 10 }));

    const loop = (ts) => {
      const t = ts * 0.001;
      drawDashboardFrame(ctx, w, h, t, pointsA, pointsB, intensity);
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawSeries(ctx, points, t, baseY, amp, color) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    points.forEach((point, idx) => {
      const y = baseY + Math.sin(t * 1.4 + point.seed + idx * 0.18) * amp + Math.cos(t * 1.05 + point.seed + idx * 0.09) * 7;
      if (idx === 0) ctx.moveTo(point.x, y);
      else ctx.lineTo(point.x, y);
    });
    ctx.stroke();
  }

  function drawDashboardFrame(ctx, w, h, t, pointsA, pointsB, intensity) {
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#061023");
    bg.addColorStop(0.55, "#090f24");
    bg.addColorStop(1, "#040913");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const haze = ctx.createRadialGradient(w * 0.72, h * 0.2, 10, w * 0.72, h * 0.2, w * 0.65);
    haze.addColorStop(0, `rgba(116,133,255,${0.26 * intensity})`);
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(9,16,33,0.88)";
    ctx.fillRect(0, 0, w, 58);

    const dots = ["#ff6a7f", "#ffd26f", "#7bffb0"];
    dots.forEach((color, idx) => {
      ctx.beginPath();
      ctx.arc(28 + idx * 18, 29, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    const sidebarW = w * 0.2;
    ctx.fillStyle = "rgba(10,18,36,0.88)";
    ctx.fillRect(0, 58, sidebarW, h - 58);

    for (let i = 0; i < 6; i += 1) {
      roundedRect(ctx, 20, 88 + i * 66, sidebarW - 40, 40, 8);
      ctx.fillStyle = i === 1 ? "rgba(74,213,255,0.26)" : "rgba(121,146,210,0.12)";
      ctx.fill();
      ctx.strokeStyle = i === 1 ? "rgba(76,216,255,0.85)" : "rgba(126,152,214,0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const mainX = sidebarW + 22;
    const mainW = w - mainX - 20;
    const chartW = mainW * 0.58;
    const chartH = h * 0.38;

    roundedRect(ctx, mainX, 86, chartW, chartH, 12);
    ctx.fillStyle = "rgba(11,22,43,0.8)";
    ctx.fill();
    ctx.strokeStyle = "rgba(120,160,240,0.34)";
    ctx.stroke();

    ctx.save();
    ctx.translate(mainX + 18, 104);

    ctx.strokeStyle = "rgba(106,140,212,0.2)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i += 1) {
      const y = (chartH - 42) * (i / 6);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartW - 36, y);
      ctx.stroke();
    }

    drawSeries(ctx, pointsA, t, chartH * 0.34, 18, "rgba(76,215,255,0.95)");
    drawSeries(ctx, pointsB, t + 1.1, chartH * 0.52, 20, "rgba(137,126,255,0.9)");
    ctx.restore();

    const cardX = mainX + chartW + 18;
    const cardW = mainW - chartW - 18;
    roundedRect(ctx, cardX, 86, cardW, chartH, 12);
    ctx.fillStyle = "rgba(11,22,43,0.8)";
    ctx.fill();
    ctx.strokeStyle = "rgba(120,160,240,0.34)";
    ctx.stroke();

    const centerX = cardX + cardW * 0.5;
    const centerY = 86 + chartH * 0.52;
    const radius = Math.min(cardW, chartH) * 0.22;
    const start = -Math.PI / 2;
    const arc = Math.PI * (1.45 + 0.22 * Math.sin(t * 1.8));

    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(88,112,173,0.32)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(76,216,255,0.95)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, start, start + arc);
    ctx.stroke();

    ctx.fillStyle = "rgba(202,228,255,0.9)";
    ctx.font = "700 22px Inter";
    ctx.textAlign = "center";
    ctx.fillText("97%", centerX, centerY + 8);

    ctx.textAlign = "left";
  }
})();
