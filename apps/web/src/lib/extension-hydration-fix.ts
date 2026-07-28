/**
 * Strips attributes injected by browser extensions (Bitdefender, Grammarly, etc.)
 * before React hydrates, preventing spurious hydration mismatch warnings.
 */
export const extensionHydrationFixScript = `
(function () {
  var exactAttrs = [
    "bis_skin_checked",
    "bis_register",
    "data-gr-ext-installed",
    "data-new-gr-c-s-check-loaded"
  ];
  var prefixAttrs = ["__processed_"];

  function shouldRemove(name) {
    if (!name) return false;
    for (var i = 0; i < exactAttrs.length; i++) {
      if (exactAttrs[i] === name) return true;
    }
    for (var j = 0; j < prefixAttrs.length; j++) {
      if (name.indexOf(prefixAttrs[j]) === 0) return true;
    }
    return false;
  }

  function stripTree(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.getAttributeNames) {
      var names = root.getAttributeNames();
      for (var i = 0; i < names.length; i++) {
        if (shouldRemove(names[i])) root.removeAttribute(names[i]);
      }
    }
    for (var c = 0; c < root.children.length; c++) {
      stripTree(root.children[c]);
    }
  }

  function run() {
    stripTree(document.documentElement);
  }

  run();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];
      if (mutation.type !== "attributes") continue;
      var target = mutation.target;
      var attr = mutation.attributeName;
      if (target && attr && shouldRemove(attr)) {
        target.removeAttribute(attr);
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true
  });

  window.addEventListener("load", function () {
    run();
    observer.disconnect();
  });
})();
`.trim();
