/**
 * =============================================================================
 *  BC ChatRoomButtons Order (BC_ChatRoomButtons.js)
 * =============================================================================
 *
 *  多個插件都往 BC 的 #chat-room-buttons 加自訂按鈕時，用來協調彼此的排列順序。
 *
 *  #chat-room-buttons 是 CSS Grid（display:grid; direction:rtl），grid 項目會遵守
 *  CSS `order` 屬性 —— 所以每個插件只要對「自己的按鈕」設 style.order = N，瀏覽器就會
 *  照 N 由小到大排版，完全不受 DOM 插入順序或載入時機影響（無競態、無需集中重排）。
 *  BC 原生按鈕沒有 order → 視為 0；正數排在原生按鈕之後（rtl 下＝偏左），負數排在之前。
 *
 *  API（掛在 window.Liko.__Sys_ChatRoomButtons__）：
 *    register(id, order, el)  記錄某插件的順位並套到按鈕上（回傳 order）
 *    get(id)                  查某插件已宣告的順位（沒有則 undefined）
 *    reapply(id, el)          BC 重建按鈕列後，把記錄的順位重新套回新按鈕
 *
 *  用法：當一般 <script> 載入即可，無依賴。契約刻意極簡且凍結 —— 任何插件都能內嵌同一份
 *  bootstrap 自行建立，版本守衛保證先到的或較新的版本生效、且保留已登記的順位，多份副本不會打架。
 * =============================================================================
 */
(function (global) {
  'use strict';

  global.Liko = global.Liko ?? {};

  // 版本守衛：已存在且版本 >= 本檔就跳過；升級時沿用舊的 slots，不清掉別人登記過的順位。
  const V = 1;
  const cur = global.Liko.__Sys_ChatRoomButtons__;
  if (cur && cur.v >= V) return;

  global.Liko.__Sys_ChatRoomButtons__ = {
    v: V,
    slots: cur?.slots ?? {},                      // id -> order（純數字，供 introspection）
    register(id, order, el) {
      this.slots[id] = order;
      if (el) el.style.order = String(order);
      return order;
    },
    get(id) { return this.slots[id]; },
    reapply(id, el) { if (el && id in this.slots) el.style.order = String(this.slots[id]); },
  };
})(window);
