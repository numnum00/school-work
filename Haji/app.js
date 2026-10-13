/* ============================================================
   app.js
   Renders profile, galleries, music, shop, and manages cart UI.
   Requires: config.js + supabase-client.js loaded first.
   ============================================================ */

(function () {
  'use strict';

  // ============================================================
  // HELPERS
  // ============================================================
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[m]);
  }

  function showError(msg) {
    const el = document.getElementById('apiError');
    if (!el) return;
    el.style.display = 'block';
    const detail = document.getElementById('apiErrorDetail');
    if (detail) detail.textContent = msg ? `(${msg})` : '';
  }

  function hideError() {
    const el = document.getElementById('apiError');
    if (el) el.style.display = 'none';
  }

  // Local video files shown inside each gallery (keyed by category slug).
  const GALLERY_VIDEOS = {
    motorcycle: ['vid/motor1.mp4', 'vid/motor2.mp4'],
    windsurfing: ['vid/wind1.mp4', 'vid/wind2.mp4'],
  };

  function videoSlot(src) {
    return `
      <div class="card video-card" title="Video">
        <video controls playsinline preload="metadata" src="${escapeHtml(src)}"></video>
      </div>`;
  }

  // ============================================================
  // PROFILE
  // ============================================================
  async function renderProfile() {
    try {
      const { user: u, social_links } = await window.HajiAPI.fetchProfile();

      const nameEl = document.getElementById('displayName');
      if (nameEl) nameEl.textContent = u.display_name || 'Haji Redogerio';

      // Tagline
      if (u.tagline) {
        const icons = {
          motorcycle: 'fas fa-motorcycle',
          windsurfer: 'fas fa-water',
          music: 'fas fa-compact-disc',
        };
        const parts = u.tagline.split('·').map((s) => s.trim()).filter(Boolean);
        const tagEl = document.getElementById('tagline');
        if (tagEl) {
          tagEl.innerHTML = parts
            .map((p) => {
              const key = Object.keys(icons).find((k) =>
                p.toLowerCase().includes(k)
              );
              const icon = icons[key] || 'fas fa-star';
              return `<span><i class="${icon}"></i> ${escapeHtml(p)}</span>`;
            })
            .join('');
        }
      }

      const bioEl = document.getElementById('bio');
      if (bioEl && u.bio) bioEl.textContent = u.bio;

      const quoteEl = document.getElementById('peaceQuote');
      if (quoteEl && u.peace_quote) {
        quoteEl.innerHTML = `<i class="fas fa-peace"></i> ${escapeHtml(u.peace_quote)}`;
      }

      const avatarEl = document.getElementById('avatarCircle');
      if (avatarEl && u.avatar_path) {
        avatarEl.style.backgroundImage = `url('${u.avatar_path}')`;
      }

      // Contact links
      const linksEl = document.getElementById('contactLinks');
      if (linksEl && Array.isArray(social_links) && social_links.length) {
        linksEl.innerHTML = social_links
          .map((l) => {
            const isEmail = l.platform === 'email';
            const cls = isEmail ? 'email-link' : '';
            const target = isEmail ? '' : 'target="_blank" rel="noopener"';
            return `<a href="${escapeHtml(l.url)}" class="${cls}" ${target}>
                      <i class="${l.icon_class || 'fas fa-link'}"></i> ${escapeHtml(l.label)}
                    </a>`;
          })
          .join('');
      }
    } catch (err) {
      console.warn('[Haji] Profile error:', err);
      showError('profile: ' + (err.message || err));
    }
  }

  // ============================================================
  // GALLERIES
  // ============================================================
  async function renderGalleries() {
    const container = document.getElementById('galleriesContainer');
    if (!container) return;

    try {
      const cats = await window.HajiAPI.fetchGalleries();
      if (!cats.length) throw new Error('No gallery categories');

      container.innerHTML = cats
        .map((cat) => {
          const isWindsurf = cat.slug === 'windsurfing';
          const cardClass = isWindsurf ? 'card windsurf-card' : 'card';

          const videos = GALLERY_VIDEOS[cat.slug] || [];

          const slots =
            cat.images && cat.images.length
              ? cat.images
                  .map(
                    (img) => `
                      <div class="${cardClass}" ${
                        img.title ? `title="${escapeHtml(img.title)}"` : ''
                      }>
                        <div class="card-img" style="background-image:url('${escapeHtml(
                          img.image_path
                        )}')"></div>
                      </div>`
                  )
                  .join('')
              : Array.from({ length: 6 })
                  .map(
                    () =>
                      `<div class="${cardClass}"><div class="card-img placeholder"></div></div>`
                  )
                  .join('');

          const videoSlots = videos.map((v) => videoSlot(v)).join('');

          const total = (cat.images ? cat.images.length : 0) + videos.length;

          return `
            <section class="gallery-section">
              <div class="section-header">
                <h2><i class="${escapeHtml(
                  cat.icon_class || 'fas fa-image'
                )}"></i> ${escapeHtml(cat.name)}</h2>
                <span class="badge">${total} slots</span>
              </div>
              <div class="grid-6">${slots}${videoSlots}</div>
            </section>`;
        })
        .join('');
    } catch (err) {
      console.warn('[Haji] Galleries error:', err);

      const fallback = [
        { slug: 'motorcycle', name: 'Motorcycle Gallery', icon: 'fas fa-motorcycle', cls: 'card' },
        { slug: 'windsurfing', name: 'Windsurfing Gallery', icon: 'fas fa-water', cls: 'card windsurf-card' },
      ];

      container.innerHTML = fallback
        .map(({ slug, name, icon, cls }) => {
          const videos = GALLERY_VIDEOS[slug] || [];
          const videoSlots = videos.map((v) => videoSlot(v)).join('');
          return `
          <section class="gallery-section">
            <div class="section-header">
              <h2><i class="${icon}"></i> ${name}</h2>
              <span class="badge">${6 + videos.length} slots</span>
            </div>
            <div class="grid-6">
              ${Array.from({ length: 6 })
                .map(() => `<div class="${cls}"><div class="card-img placeholder"></div></div>`)
                .join('')}
              ${videoSlots}
            </div>
          </section>`;
        })
        .join('');
    }
  }

  // ============================================================
  // MUSIC
  // ============================================================
  async function renderMusic() {
    const grid = document.getElementById('musicGrid');
    const badge = document.getElementById('musicBadge');
    if (!grid) return;

    try {
      const albums = await window.HajiAPI.fetchAlbums();
      if (!albums.length) throw new Error('No albums');

      if (badge) badge.textContent = `${albums.length} favourites`;

      grid.innerHTML = albums
        .map((a) => {
          const cover = a.cover_path
            ? `<div class="album-icon" style="background-image:url('${escapeHtml(
                a.cover_path
              )}')"></div>`
            : `<div class="album-icon"><i class="fas fa-compact-disc"></i></div>`;

          const track = a.tracks && a.tracks[0];
          const audio =
            track && track.audio_path
              ? `<audio controls preload="none">
                   <source src="${escapeHtml(track.audio_path)}" type="audio/mpeg">
                   Your browser doesn't support audio.
                 </audio>`
              : `<p style="color:#9a8c7a;font-size:0.85rem;">No audio yet</p>`;

          return `
            <div class="album-card">
              ${cover}
              <h3>${escapeHtml(a.title)}</h3>
              <p>${escapeHtml(a.emoji || '🎸')}</p>
              ${audio}
            </div>`;
        })
        .join('');
    } catch (err) {
      console.warn('[Haji] Music error:', err);
      // Keep the static players in index.html as a fallback instead of
      // wiping them out with an error message.
      if (badge) badge.textContent = 'offline';
    }
  }

  // ============================================================
  // SHOP
  // ============================================================
  async function renderShop() {
    const grid = document.getElementById('shopGrid');
    const badge = document.getElementById('shopBadge');
    if (!grid) return;

    try {
      const products = await window.HajiAPI.fetchProducts();
      if (!products.length) throw new Error('No products');

      if (badge) badge.textContent = `${products.length} items`;

      grid.innerHTML = products
        .map((p) => {
          const icon = p.image_path
            ? `<div class="product-icon" style="background-image:url('${escapeHtml(
                p.image_path
              )}')"></div>`
            : `<div class="product-icon"><i class="fas fa-box"></i></div>`;

          const price = Number(p.price || 0).toFixed(2);

          return `
            <div class="product-card">
              ${icon}
              <h3>${escapeHtml(p.name)}</h3>
              <p class="price">$${price}</p>
              <p>${escapeHtml(p.description || '')}</p>
              <button class="buy-btn"
                      data-id="${p.id}"
                      data-sku="${escapeHtml(p.sku)}"
                      data-price="${price}">
                Add to Cart
              </button>
            </div>`;
        })
        .join('');

      // Attach click listeners
      grid.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const price = parseFloat(btn.dataset.price);

          btn.disabled = true;
          const original = btn.textContent;
          btn.textContent = 'Adding…';

          try {
            const count = await window.HajiAPI.addToCart(id, price);
            updateCartBadge(count);
            btn.textContent = '✅ Added';
            setTimeout(() => {
              btn.textContent = original;
              btn.disabled = false;
            }, 1200);
          } catch (err) {
            console.error('[Haji] Add to cart error:', err);
            alert('Could not add to cart: ' + (err.message || err));
            btn.textContent = original;
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      console.warn('[Haji] Shop error:', err);
      grid.innerHTML = `<div class="loading">
        <i class="fas fa-triangle-exclamation"></i> Could not load products
      </div>`;
      if (badge) badge.textContent = 'offline';
    }
  }

  // ============================================================
  // CART BADGE
  // ============================================================
  function updateCartBadge(count) {
    const el = document.getElementById('cartCount');
    if (el) el.textContent = count != null ? count : 0;
  }

  async function refreshCartCount() {
    try {
      const c = await window.HajiAPI.cartCount();
      updateCartBadge(c);
    } catch {
      /* ignore */
    }
  }

  // ============================================================
  // VIEW CART (simple alert — upgrade to modal later)
  // ============================================================
  async function viewCart() {
    try {
      const { items } = await window.HajiAPI.fetchCart();
      if (!items.length) return alert('🛒 Your cart is empty.');

      const lines = items.map(
        (i) => `• ${i.product.name} × ${i.quantity} — $${(i.unit_price * i.quantity).toFixed(2)}`
      );
      const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

      alert(`🛒 Cart:\n\n${lines.join('\n')}\n\nTotal: $${total.toFixed(2)}`);
    } catch (err) {
      alert('Could not load cart: ' + (err.message || err));
    }
  }

  // ============================================================
  // BOOT
  // ============================================================
  async function boot() {
    console.log('[Haji] Booting app…');

    await Promise.allSettled([
      renderProfile(),
      renderGalleries(),
      renderMusic(),
      renderShop(),
    ]);

    await refreshCartCount();
    hideError();

    console.log('[Haji] App ready ✅');
  }

  // Expose to global (for onclick handlers in HTML)
  window.viewCart = viewCart;

  // Kick off when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();