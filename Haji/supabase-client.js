/* ============================================================
   supabase-client.js
   All Supabase queries — profile, galleries, albums,
   products, and cart operations.
   ============================================================ */

(function () {
  'use strict';

  // ---- Guard: make sure config was loaded first ----
  if (!window.HAJI_CONFIG) {
    console.error('[Haji] config.js not loaded before supabase-client.js');
    return;
  }

  const { SUPABASE_URL, SUPABASE_ANON, PROFILE_USERNAME } = window.HAJI_CONFIG;

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[Haji] Missing SUPABASE_URL or SUPABASE_ANON in config.js');
    return;
  }
  if (!window.supabase) {
    console.error('[Haji] Supabase CDN not loaded. Add <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    return;
  }

  // ---- Create the Supabase client ----
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // ============================================================
  // SESSION TOKEN (for guest carts)
  // ============================================================
  const SESSION_KEY = 'hajiSession';

  function getSessionToken() {
    let token = localStorage.getItem(SESSION_KEY);
    if (!token) {
      token = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : ('sess-' + Date.now() + '-' + Math.random().toString(36).slice(2));
      localStorage.setItem(SESSION_KEY, token);
    }
    return token;
  }

  // ============================================================
  // PROFILE
  // ============================================================
  async function fetchProfile() {
    const { data: user, error: userErr } = await sb
      .from('users')
      .select('*')
      .eq('username', PROFILE_USERNAME)
      .single();

    if (userErr) throw userErr;
    if (!user) throw new Error('Profile user not found — run seed SQL');

    const { data: social_links, error: linkErr } = await sb
      .from('social_links')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('display_order');

    if (linkErr) throw linkErr;

    return { user, social_links: social_links || [] };
  }

  // ============================================================
  // GALLERIES
  // ============================================================
  async function fetchGalleries() {
    const { data: categories, error } = await sb
      .from('gallery_categories')
      .select(`
        id, slug, name, icon_class, badge_text, display_order,
        images:gallery_images ( id, image_path, title, description, alt_text, display_order, is_active )
      `)
      .order('display_order');

    if (error) throw error;

    return (categories || []).map((cat) => ({
      ...cat,
      images: (cat.images || [])
        .filter((img) => img.is_active !== false)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
    }));
  }

  // ============================================================
  // ALBUMS + TRACKS
  // ============================================================
  async function fetchAlbums() {
    const { data: albums, error } = await sb
      .from('albums')
      .select(`
        id, title, artist, cover_path, emoji, display_order,
        tracks: tracks ( id, title, audio_path, duration_sec, display_order )
      `)
      .order('display_order');

    if (error) throw error;

    return (albums || []).map((a) => ({
      ...a,
      tracks: (a.tracks || []).sort(
        (x, y) => (x.display_order || 0) - (y.display_order || 0)
      ),
    }));
  }

  // ============================================================
  // PRODUCTS
  // ============================================================
  async function fetchProducts() {
    const { data, error } = await sb
      .from('products')
      .select(`
        id, sku, name, description, price, currency, stock_qty, image_path,
        category: product_categories ( id, slug, name )
      `)
      .eq('is_active', true)
      .order('created_at');

    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // CART
  // ============================================================
  async function getOrCreateCart() {
    const token = getSessionToken();

    const { data: existing, error: findErr } = await sb
      .from('carts')
      .select('*')
      .eq('session_token', token)
      .maybeSingle();

    if (findErr) throw findErr;
    if (existing) return existing;

    const { data: created, error: insErr } = await sb
      .from('carts')
      .insert({ session_token: token })
      .select()
      .single();

    if (insErr) throw insErr;
    return created;
  }

  async function fetchCart() {
    const cart = await getOrCreateCart();

    const { data, error } = await sb
      .from('cart_items')
      .select(`
        id, quantity, unit_price, added_at,
        product: products ( id, sku, name, image_path )
      `)
      .eq('cart_id', cart.id)
      .order('added_at');

    if (error) throw error;
    return { cart, items: data || [] };
  }

  async function addToCart(productId, price) {
    const cart = await getOrCreateCart();

    const { data: existing, error: findErr } = await sb
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .maybeSingle();

    if (findErr) throw findErr;

    if (existing) {
      const { error } = await sb
        .from('cart_items')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await sb
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          product_id: productId,
          quantity: 1,
          unit_price: price,
        });
      if (error) throw error;
    }

    return await cartCount();
  }

  async function updateCartItem(itemId, qty) {
    if (qty <= 0) {
      const { error } = await sb
        .from('cart_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    } else {
      const { error } = await sb
        .from('cart_items')
        .update({ quantity: qty })
        .eq('id', itemId);
      if (error) throw error;
    }
    return await cartCount();
  }

  async function cartCount() {
    try {
      const cart = await getOrCreateCart();
      const { data, error } = await sb
        .from('cart_items')
        .select('quantity')
        .eq('cart_id', cart.id);
      if (error) return 0;
      return (data || []).reduce((s, r) => s + (r.quantity || 0), 0);
    } catch {
      return 0;
    }
  }

  // ============================================================
  // CONTACT (optional)
  // ============================================================
  async function sendContactMessage(payload) {
    const { error } = await sb.from('contact_messages').insert(payload);
    if (error) throw error;
    return true;
  }

  // ============================================================
  // EXPOSE PUBLIC API
  // ============================================================
  window.HajiAPI = {
    // profile
    fetchProfile,
    // galleries
    fetchGalleries,
    // music
    fetchAlbums,
    // shop
    fetchProducts,
    // cart
    fetchCart,
    addToCart,
    updateCartItem,
    cartCount,
    // contact
    sendContactMessage,
    // utility
    getSessionToken,
    // raw client (for future custom queries)
    _client: sb,
  };

  console.log('[Haji] Supabase client ready →', SUPABASE_URL);
})();