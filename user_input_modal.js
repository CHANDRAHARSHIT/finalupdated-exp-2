/* Shared user input modal for experiment pages */
(function () {
  const modalId = "sharedUserInputModal";
  if (document.getElementById(modalId)) return;

  const defaultReturn = (function () {
    const path = window.location.pathname.split("/").pop();
    return path ? path : "aim.html";
  })();

  function sanitizeReturn(value) {
    if (!value) return null;
    const candidate = value.trim();
    if (/^[a-z0-9_\\-\\/]+\\.html$/i.test(candidate)) {
      return candidate;
    }
    return null;
  }

  const markup = `
    <div id="${modalId}" class="hidden fixed inset-0 z-[100000] bg-black/70 px-4 py-8 items-center justify-center">
      <div class="relative w-full max-w-4xl h-[85vh] flex flex-col bg-white shadow-2xl rounded-3xl border border-slate-200 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 class="text-lg font-semibold text-slate-900">User Input Form</h3>
          <button type="button" class="text-slate-600 hover:text-slate-900 rounded-full focus:outline-none" data-user-input-close>
            <span aria-hidden="true" class="text-2xl leading-none">&times;</span>
            <span class="sr-only">Close user form</span>
          </button>
        </div>
        <iframe id="sharedUserInputIframe" class="w-full flex-1 border-0" title="User Input Form"></iframe>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", markup);
  const modal = document.getElementById(modalId);
  const iframe = document.getElementById("sharedUserInputIframe");
  const closeBtn = modal?.querySelector("[data-user-input-close]");
  const links = Array.from(document.querySelectorAll("[data-user-input-link]"));

  function setIframeSrc(returnUrl) {
    if (!iframe) return;
    const params = new URLSearchParams();
    if (returnUrl) {
      params.set("return", returnUrl);
    }
    iframe.src = `user_input.html${params.toString() ? `?${params}` : ""}`;
  }

  function openUserInputModal(returnUrl) {
    if (!modal) return;
    const target = sanitizeReturn(returnUrl) || defaultReturn;
    setIframeSrc(target);
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.classList.add("overflow-hidden");
  }

  function closeUserInputModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
    if (iframe) {
      iframe.src = "about:blank";
    }
  }

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = link.dataset.redirectReturn || link.getAttribute("href");
      openUserInputModal(target);
    });
  });

  closeBtn?.addEventListener("click", () => {
    closeUserInputModal();
  });

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeUserInputModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal?.classList.contains("flex")) {
      closeUserInputModal();
    }
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.type !== "vlab:user_input_submitted") return;
    closeUserInputModal();
    const target = sanitizeReturn(data.returnUrl) || defaultReturn;
    if (!target) return;
    try {
      if (window.top && window.top !== window) {
        window.top.postMessage({ type: "vlab:user_input_submitted", returnUrl: target }, window.location.origin);
        return;
      }
    } catch (err) {
      console.error(err);
    }
    window.location.href = target;
  });

  window.openSharedUserInputModal = openUserInputModal;
})();
