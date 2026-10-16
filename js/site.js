(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
})();

(function () {
  var form = document.getElementById("launch-notify");
  if (!form) return;
  var msg = document.getElementById("notify-msg");
  var btn = form.querySelector(".btn-submit");
  // Same-origin /api/subscribe once the apex is Cloudflare-proxied.
  // Fallback (DNS-only apex): set to "https://api.gofarva.run/subscribe".
  var ENDPOINT = "/api/subscribe";
  var CONSENT_VERSION = "launch-notify-v1";

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!msg || !btn) return;
    msg.textContent = "";
    msg.className = "newsletter-msg";

    var email = (form.email.value || "").trim();
    var consent = form.consent && form.consent.checked;
    var website = form.website ? form.website.value : "";

    if (!email || email.length > 254) {
      msg.textContent = "Please enter a valid email address.";
      msg.classList.add("err");
      return;
    }
    if (!consent) {
      msg.textContent = "Please tick the consent box to continue.";
      msg.classList.add("err");
      return;
    }

    btn.disabled = true;
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        email: email,
        consent: true,
        website: website,
        consent_text_version: CONSENT_VERSION,
        source: "gofarva.run/home"
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.ok) {
          msg.textContent = "Thanks! We'll email you when Go Farva launches.";
          msg.classList.add("ok");
          form.reset();
          return;
        }
        if (result.status === 429) {
          msg.textContent = "Too many tries from this network. Please wait an hour and try again.";
        } else if (result.data && result.data.error) {
          msg.textContent = result.data.error;
        } else {
          msg.textContent = "Something went wrong. Please try again in a moment.";
        }
        msg.classList.add("err");
      })
      .catch(function () {
        msg.textContent = "Couldn't reach the server. Check your connection and try again.";
        msg.classList.add("err");
      })
      .finally(function () {
        btn.disabled = false;
      });
  });
})();
