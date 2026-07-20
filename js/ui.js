/*
 * ui.js — small DOM helpers shared across views: element builder, modals,
 * toasts, and the goal celebration. No framework, just thin wrappers.
 */
(function () {
  "use strict";

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // tiny hyperscript: el("div", {class:"x"}, [child, "text"])
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      } else if (attrs[k] != null && attrs[k] !== false) {
        node.setAttribute(k, attrs[k]);
      }
    });
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        node.appendChild(typeof c === "string" || typeof c === "number"
          ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  }

  // Cover image (or a placeholder book glyph) for a book-like object.
  function coverEl(book, large) {
    var cls = "cover" + (large ? " cover--lg" : "");
    if (book.coverUrl) {
      var img = el("img", { class: cls, src: book.coverUrl, alt: "", loading: "lazy" });
      img.addEventListener("error", function () {
        var ph = placeholderCover(cls);
        if (img.parentNode) img.parentNode.replaceChild(ph, img);
      });
      return img;
    }
    return placeholderCover(cls);
  }

  function placeholderCover(cls) {
    return el("div", { class: cls + " cover--placeholder", html: "📖" });
  }

  // ---- modal --------------------------------------------------------------

  var modalRoot = null;
  function openModal(title, contentNode) {
    modalRoot = document.getElementById("modal-root");
    var backdrop = el("div", { class: "modal-backdrop" });
    var modal = el("div", { class: "modal" });
    modal.appendChild(el("div", { class: "modal__handle" }));
    if (title) modal.appendChild(el("h2", { class: "modal__title", text: title }));
    modal.appendChild(contentNode);
    backdrop.appendChild(modal);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeModal();
    });
    modalRoot.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    return { backdrop: backdrop, modal: modal };
  }
  function closeModal() {
    var root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
    document.body.style.overflow = "";
  }

  // ---- toast --------------------------------------------------------------

  function toast(msg, ms) {
    var root = document.getElementById("toast-root");
    var t = el("div", { class: "toast", text: msg });
    root.appendChild(t);
    setTimeout(function () {
      t.style.opacity = "0";
      t.style.transition = "opacity .3s";
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, ms || 1900);
  }

  // ---- celebration --------------------------------------------------------

  var CONFETTI_COLORS = ["#6B9080", "#D8A657", "#E9C07A", "#557567", "#B4685E", "#A3C4B4"];

  function celebrate(opts) {
    opts = opts || {};
    var overlay = document.getElementById("celebrate");
    document.getElementById("celebrate-emoji").textContent = opts.emoji || "🎉";
    document.getElementById("celebrate-title").textContent = opts.title || "Goal met!";
    document.getElementById("celebrate-body").textContent = opts.body || "Nice work today.";
    overlay.hidden = false;
    spawnConfetti();

    function close() {
      overlay.hidden = true;
      document.getElementById("confetti").innerHTML = "";
      document.getElementById("celebrate-close").removeEventListener("click", close);
      overlay.removeEventListener("click", onBackdrop);
    }
    function onBackdrop(e) { if (e.target === overlay) close(); }
    document.getElementById("celebrate-close").addEventListener("click", close);
    overlay.addEventListener("click", onBackdrop);
  }

  function spawnConfetti() {
    var host = document.getElementById("confetti");
    host.innerHTML = "";
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    for (var i = 0; i < 60; i++) {
      var piece = document.createElement("i");
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = (1.6 + Math.random() * 1.6) + "s";
      piece.style.animationDelay = (Math.random() * 0.5) + "s";
      piece.style.transform = "scale(" + (0.6 + Math.random()) + ")";
      host.appendChild(piece);
    }
  }

  // format helpers
  function fmtDuration(mins) {
    mins = Math.round(mins || 0);
    if (mins < 60) return mins + "m";
    var h = Math.floor(mins / 60), m = mins % 60;
    return m ? h + "h " + m + "m" : h + "h";
  }

  function fmtDateShort(dateStr) {
    var d = new Date(dateStr + "T00:00:00");
    var today = Store.localDateStr(new Date());
    var yest = Store.localDateStr(new Date(Date.now() - 86400000));
    if (dateStr === today) return "Today";
    if (dateStr === yest) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  window.UI = {
    esc: esc, el: el, coverEl: coverEl,
    openModal: openModal, closeModal: closeModal,
    toast: toast, celebrate: celebrate,
    fmtDuration: fmtDuration, fmtDateShort: fmtDateShort
  };
})();
