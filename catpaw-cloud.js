/* CatPaw 原型 · 云同步层（WorkBuddy Cloud Service：Auth + Database）。
 *
 * 职责：
 *  1. 用 publicConfig 初始化唯一的云客户端（CDN 形态，全局 WorkBuddyCloud）。
 *  2. WorkBuddy 账号登录（signInWithOAuth + handleWorkBuddyCallback），回调后清理 code/state/provider、
 *     保留 sharecode 等业务参数。
 *  3. 把原本仅存 localStorage 的四类数据（资料库文件 / NoCode 应用 / 能力市场自定义项 / 我的模版）
 *     同步到云数据库 user_store 表（owner-only RLS，按 owner_id 隔离，行级 last-write-wins）。
 *  4. 登录态下拉取云端合并到 localStorage 之后再注入应用脚本，保证页面模块读到合并后的数据；
 *     未登录 / 云不可用时立即注入脚本，原型照常可用。
 *  5. 左下角「云同步」状态胶囊：登录入口、同步状态、手动同步、退出登录。
 */
(function (root) {
  'use strict';

  var config = root.CATPAW_CLOUD_CONFIG || {};
  var SDK_OK = !!(root.WorkBuddyCloud && typeof root.WorkBuddyCloud.createWorkBuddyCloud === 'function');
  var CONFIG_OK = !!(config.endpoint && config.publishableKey);

  /* 应用脚本清单：与原 index.html 静态脚本完全一致（顺序敏感）。 */
  var APP_SCRIPTS = [
    './ppt-workbar.js',
    './artifact-editing-demo.js',
    './strategy-scenes.js',
    './supplier-conversation-demo.js?v=ds003',
    './conversation-queue-demo.js',
    './recovery-conversation-demo.js?v=20261110-continuous-retry',
    './clarification-demo.js?v=20261110-question-icon',
    './capability-market.js',
    './nocode-page.js',
    './library-page.js',
    './widget-value-cases.js?v=20261110-current',
    './app.js?v=20261110-remove-budget-conversation',
    './credits-demo.js',
  ];

  /* 参与云同步的 localStorage 数据源。idOf 生成云端 item_id（market 条目无自带 id，用 kind|name）。 */
  var STORES = [
    { key: 'catpaw-library-files', store: 'library', idOf: function (item) { return item && typeof item.id === 'string' ? item.id : null; } },
    { key: 'catpaw-nocode-items', store: 'nocode', idOf: function (item) { return item && typeof item.id === 'string' ? item.id : null; } },
    { key: 'catpaw-market-custom', store: 'market', idOf: function (item) { return item && item.kind && item.name ? item.kind + '|' + item.name : null; } },
    { key: 'catpaw-custom-templates-v1', store: 'templates', idOf: function (item) { return item && typeof item.id === 'string' ? item.id : null; } },
  ];
  var MANIFEST_KEY = 'catpaw-cloud-sync-manifest';
  var TABLE = 'user_store';

  var cloud = null;
  var session = null;
  var booted = false;
  var syncing = false;
  var syncError = null;
  var lastSyncAt = null;
  var manifest = readManifest();
  var lastSeen = {};
  var pollTimer = null;

  /* ---------------- 启动门：保证应用脚本在云端合并完成后才执行 ---------------- */

  function bootApp() {
    if (booted) return;
    booted = true;
    APP_SCRIPTS.forEach(function (src) {
      var el = document.createElement('script');
      el.src = src;
      el.async = false; /* 动态插入脚本保持插入顺序执行 */
      document.body.appendChild(el);
    });
  }

  var bootTimeout = setTimeout(function () {
    /* 云端无响应也不能拖死原型 */
    bootApp();
  }, 8000);
  function bootAndClear() { clearTimeout(bootTimeout); bootApp(); }

  /* ---------------- 基础工具 ---------------- */

  function readManifest() {
    try {
      var parsed = JSON.parse(localStorage.getItem(MANIFEST_KEY));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
  }
  function writeManifest() {
    try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest)); } catch (_) { /* 忽略 */ }
  }
  function readLocal(def) {
    try {
      var value = JSON.parse(localStorage.getItem(def.key));
      return Array.isArray(value) ? value : null;
    } catch (_) { return null; }
  }
  function writeLocal(def, items) {
    try { localStorage.setItem(def.key, JSON.stringify(items)); } catch (_) { return false; }
    return true;
  }

  /* ---------------- 云同步核心 ---------------- */

  function cloudRows() {
    return cloud.database.from(TABLE).select('item_id, payload, updated');
  }

  async function pullStore(def) {
    var result = await cloudRows().eq('store', def.store);
    if (result.error) throw result.error;
    var rows = Array.isArray(result.data) ? result.data : [];
    var local = readLocal(def) || [];
    var indexById = new Map();
    local.forEach(function (item, i) { indexById.set(def.idOf(item), i); });
    var merged = local.slice();
    var changed = false;
    rows.forEach(function (row) {
      var payload = row && row.payload;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
      if (!def.idOf(payload)) return;
      var idx = indexById.get(row.item_id);
      if (idx === undefined) {
        merged.unshift(payload); /* 云端新增条目放到列表最前，贴近页面「最近在前」的排序习惯 */
        changed = true;
      } else if ((Number(row.updated) || 0) > (Number(merged[idx] && merged[idx].updated) || 0)) {
        merged[idx] = payload; /* 云端更新 */
        changed = true;
      }
    });
    if (changed) writeLocal(def, merged);
    return rows;
  }

  async function pushStore(def, cloudRowsForStore) {
    var local = readLocal(def);
    if (!local) return;
    var entry = manifest[def.store] = manifest[def.store] || { pushed: {} };
    var pushed = entry.pushed;
    var cloudUpdated = new Map();
    (cloudRowsForStore || []).forEach(function (row) { cloudUpdated.set(row.item_id, Number(row.updated) || 0); });

    var rows = [];
    local.forEach(function (item) {
      var id = def.idOf(item);
      if (!id) return;
      var updated = Number(item && item.updated) || 0;
      var alreadyPushed = pushed[id] === updated;
      var cloudNewer = (cloudUpdated.get(id) || 0) >= updated && cloudUpdated.has(id);
      if (alreadyPushed && cloudNewer) return;
      rows.push({
        owner_id: session.user.id,
        owner_name: session.user.name || null,
        store: def.store,
        item_id: id,
        payload: item,
        updated: updated,
      });
      pushed[id] = updated;
    });

    var localIds = new Set(local.map(def.idOf).filter(Boolean));
    var removed = Object.keys(pushed).filter(function (id) { return !localIds.has(id); });

    if (rows.length) {
      var result = await cloud.database.from(TABLE).upsert(rows, { onConflict: 'owner_id,store,item_id' });
      if (result.error) throw result.error;
    }
    if (removed.length) {
      var del = await cloud.database.from(TABLE).delete().eq('store', def.store).in('item_id', removed.slice(0, 50));
      if (del.error) throw del.error;
      removed.forEach(function (id) { delete pushed[id]; });
    }
    if (rows.length || removed.length) writeManifest();
  }

  async function syncOnce(reason) {
    if (!cloud || !session || syncing) return;
    syncing = true;
    renderChip();
    try {
      for (var i = 0; i < STORES.length; i++) {
        var def = STORES[i];
        var rows = await pullStore(def);
        await pushStore(def, rows);
      }
      syncError = null;
      lastSyncAt = Date.now();
    } catch (error) {
      syncError = (error && error.message) || '同步失败';
      if (reason !== 'poll') console.warn('[CatPawCloud] sync failed (' + reason + '):', syncError);
    } finally {
      syncing = false;
      snapshotLocal();
      renderChip();
    }
  }

  function snapshotLocal() {
    STORES.forEach(function (def) {
      lastSeen[def.key] = readLocal(def) ? localStorage.getItem(def.key) : null;
    });
  }
  function localChanged() {
    return STORES.some(function (def) {
      var current = readLocal(def) ? localStorage.getItem(def.key) : null;
      return current !== lastSeen[def.key];
    });
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (!session) return;
      if (localChanged()) { snapshotLocal(); syncOnce('change'); }
    }, 5000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && session) syncOnce('visible');
    });
  }

  /* ---------------- 登录 ---------------- */

  async function signIn() {
    if (!cloud) return;
    setChip('登录跳转中…');
    var back = new URL(root.location.href);
    back.pathname = '/';
    ['code', 'state', 'provider'].forEach(function (key) { back.searchParams.delete(key); });
    var result = await cloud.auth.signInWithOAuth({ provider: 'workbuddy', redirectTo: back.toString() });
    if (result.error) {
      setChip('登录失败：' + result.error.message);
      renderChip();
      return;
    }
    root.location.assign(result.data.url);
  }

  async function signOut() {
    if (!cloud) return;
    try { await cloud.auth.signOut(); } catch (_) { /* 忽略 */ }
    session = null;
    manifest = readManifest();
    renderChip();
  }

  async function restoreAuth() {
    var url = new URL(root.location.href);
    if (url.searchParams.has('code') || url.searchParams.has('error')) {
      var provider = url.searchParams.get('provider');
      if (provider === 'workbuddy' && typeof cloud.auth.handleWorkBuddyCallback === 'function') {
        var callback = await cloud.auth.handleWorkBuddyCallback.call(cloud.auth);
        if (callback.error) {
          syncError = '登录失败：' + callback.error.message;
        } else if (callback.data && callback.data.session) {
          /* 成功：清理回调参数，保留 sharecode 等业务参数 */
          ['code', 'state', 'provider'].forEach(function (key) { url.searchParams.delete(key); });
          root.history.replaceState(null, '', url.pathname + url.search + url.hash);
        }
      } else if (provider !== 'workbuddy') {
        ['code', 'state', 'provider'].forEach(function (key) { url.searchParams.delete(key); });
        root.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    }
    var result = await cloud.auth.getSession();
    session = (result && result.data && result.data.session) ? result.data.session : null;
    if (session) {
      renderChip();
      await syncOnce('signin');
      startPolling();
    }
    bootAndClear();
  }

  /* ---------------- 状态胶囊 UI ---------------- */

  var chip = null;
  var chipMenu = null;

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#catpawCloudChip{position:fixed;left:16px;bottom:16px;z-index:99999;display:flex;align-items:center;gap:8px;',
      'padding:8px 14px;border-radius:999px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#333;',
      'font:12px/1.4 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;',
      'box-shadow:0 4px 16px rgba(0,0,0,.10);cursor:pointer;user-select:none;max-width:340px;}',
      '#catpawCloudChip:hover{border-color:rgba(0,0,0,.25)}',
      '#catpawCloudChip .cloud-dot{width:8px;height:8px;border-radius:50%;background:#9aa0a6;flex:none}',
      '#catpawCloudChip.is-on .cloud-dot{background:#34a853}',
      '#catpawCloudChip.is-err .cloud-dot{background:#ea4335}',
      '#catpawCloudChip.is-busy .cloud-dot{background:#fbbc05}',
      '#catpawCloudChip .cloud-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#catpawCloudMenu{position:fixed;left:16px;bottom:52px;z-index:99999;background:#fff;border:1px solid rgba(0,0,0,.12);',
      'border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:6px;min-width:150px;',
      'font:13px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#333}',
      '#catpawCloudMenu button{display:block;width:100%;text-align:left;padding:7px 12px;border:0;background:none;',
      'border-radius:8px;cursor:pointer;color:#333;font:inherit}',
      '#catpawCloudMenu button:hover{background:rgba(0,0,0,.06)}',
      '#catpawCloudMenu .cloud-user{padding:6px 12px 2px;font-weight:600;border-bottom:1px solid rgba(0,0,0,.08);margin-bottom:4px}',
    ].join('');
    document.head.appendChild(style);
  }

  function ensureChip() {
    if (chip) return;
    injectStyles();
    chip = document.createElement('div');
    chip.id = 'catpawCloudChip';
    chip.setAttribute('role', 'status');
    chip.innerHTML = '<span class="cloud-dot"></span><span class="cloud-text">云同步</span>';
    document.body.appendChild(chip);
    chip.addEventListener('click', onChipClick);
    document.addEventListener('click', function (event) {
      if (chipMenu && !chipMenu.contains(event.target) && event.target !== chip) closeMenu();
    });
  }

  function closeMenu() {
    if (chipMenu) { chipMenu.remove(); chipMenu = null; }
  }

  function onChipClick(event) {
    event.stopPropagation();
    if (!session) { signIn(); return; }
    if (chipMenu) { closeMenu(); return; }
    chipMenu = document.createElement('div');
    chipMenu.id = 'catpawCloudMenu';
    var name = (session.user && (session.user.name || '已登录用户')) || '已登录用户';
    chipMenu.innerHTML =
      '<div class="cloud-user">' + escapeHtml(String(name)) + '</div>' +
      '<button type="button" data-cloud-sync>立即同步</button>' +
      '<button type="button" data-cloud-signout>退出登录</button>';
    chipMenu.querySelector('[data-cloud-sync]').onclick = function () { closeMenu(); syncOnce('manual'); };
    chipMenu.querySelector('[data-cloud-signout]').onclick = function () { closeMenu(); signOut(); };
    document.body.appendChild(chipMenu);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setChip(text) {
    ensureChip();
    chip.querySelector('.cloud-text').textContent = text;
  }

  function renderChip() {
    ensureChip();
    var dot = chip.querySelector('.cloud-dot');
    chip.classList.remove('is-on', 'is-err', 'is-busy');
    var text;
    if (!SDK_OK || !CONFIG_OK) {
      text = '云服务不可用（原型仅本地保存）';
    } else if (!session) {
      text = syncError ? syncError : '云同步 · 未登录（点击登录）';
    } else if (syncing) {
      chip.classList.add('is-busy');
      text = '云同步 · 同步中…';
    } else if (syncError) {
      chip.classList.add('is-err');
      text = '云同步 · ' + syncError + '（点击重试）';
    } else {
      chip.classList.add('is-on');
      var at = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('zh-CN', { hour12: false }) : '';
      text = '云同步 · 已同步' + (at ? ' ' + at : '');
    }
    chip.querySelector('.cloud-text').textContent = text;
  }

  /* ---------------- 入口 ---------------- */

  function init() {
    if (!SDK_OK || !CONFIG_OK) {
      /* SDK 或配置缺失：原型按本地模式照常启动，不静默伪装云同步。 */
      console.warn('[CatPawCloud] cloud unavailable, running local-only.');
      renderChip();
      bootAndClear();
      return;
    }
    try {
      cloud = root.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: config.endpoint,
        oauthRelayBaseUrl: config.oauthRelayBaseUrl,
        publishableKey: config.publishableKey,
      });
    } catch (error) {
      console.warn('[CatPawCloud] init failed:', error);
      renderChip();
      bootAndClear();
      return;
    }
    root.CatPawCloud = {
      sync: function () { return syncOnce('api'); },
      getSession: function () { return session; },
    };
    renderChip();
    restoreAuth().catch(function (error) {
      console.warn('[CatPawCloud] restore failed:', error);
      bootAndClear();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
