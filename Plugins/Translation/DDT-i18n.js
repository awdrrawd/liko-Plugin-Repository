// Liko - DDT (DrawDetectionTool) i18n 字庫
// 由 DDT 主插件動態載入（ensure），不需手動安裝；載入後 register 到共用引擎 BC_i18n。
// 佔位符 {name} 由 t(ns,key,vars) 代入。值可含行內 HTML（面板以 innerHTML 注入）。
// 目前只放 TW（原文）+ EN。CN 若要補，照 Prank-i18n.js 逐鍵加 CN 即可（引擎 CJK 缺字會自動退 TW）。

(function () {
    if (!window.Liko?.__Sys_i18n__?.register) {
        console.error('[Liko DDT strings] i18n engine not loaded');
        return;
    }
    window.Liko.__Sys_i18n__.register('DDT', {

        // ── 氣球 / 選單 / 全域 ────────────────────────────────────────────
        balloon_title: { TW: "點一下展開工具（Pen / Ruler / Setting）；可拖曳搬家", EN: "Click to open tools (Pen / Ruler / Setting); drag to move" },
        chat_btn_label: { TW: "繪圖檢測工具", EN: "Draw Detection Tool" },
        chat_btn_title: { TW: "點一下叫出／收起 DDT 氣球", EN: "Click to show / hide the DDT balloon" },
        menu_pen: { TW: "Pen — 繪圖工具箱", EN: "Pen — drawing toolbox" },
        menu_ruler: { TW: "Ruler — 偵測 / 檢視 / 編輯", EN: "Ruler — inspect / view / edit" },
        menu_hidden: { TW: "DDT-Hidden — 全部虛線 / 全部隱藏 / 正常", EN: "DDT-Hidden — all outlined / all hidden / normal" },
        menu_clean: { TW: "DDT-Clean — 清除所有繪製物件與偵測狀態", EN: "DDT-Clean — clear all drawn objects and inspection state" },
        menu_setting: { TW: "Setting — 匯出/匯入/隱藏", EN: "Setting — export / import / hide" },
        hidden_state1: { TW: "DDT-Hidden — 目前：全部虛線（再按=全部隱藏含底圖）", EN: "DDT-Hidden — now: all outlined (click again = hide all incl. backdrop)" },
        hidden_state2: { TW: "DDT-Hidden — 目前：全部隱藏含底圖（再按=正常）", EN: "DDT-Hidden — now: all hidden incl. backdrop (click again = normal)" },
        clean_confirm: { TW: "清除所有繪製物件與偵測狀態？", EN: "Clear all drawn objects and inspection state?" },

        // ── 共用標籤 / 按鈕 ───────────────────────────────────────────────
        close: { TW: "關閉", EN: "Close" },
        variant_button: { TW: "按鈕", EN: "Button" },
        variant_text: { TW: "文字", EN: "Text" },
        variant_frame: { TW: "純框", EN: "Frame" },
        box: { TW: "框", EN: "Box" },
        char_paren: { TW: "(角色)", EN: "(character)" },
        char_fallback: { TW: "角色", EN: "character" },
        lbl_color: { TW: "顏色", EN: "Color" },
        lbl_text: { TW: "文字", EN: "Text" },
        lbl_size: { TW: "尺寸", EN: "Size" },
        lbl_rot: { TW: "旋轉°", EN: "Rotation°" },
        not_colorable: { TW: "（不可染色）", EN: " (not dyeable)" },
        orig_val: { TW: "原始 {v}", EN: "orig {v}" },

        // ── Ruler 面板頭 / 頁籤 ───────────────────────────────────────────
        ruler_title: { TW: "📏 Ruler · 偵測", EN: "📏 Ruler · Inspect" },
        fs_down: { TW: "縮小文字", EN: "Smaller text" },
        fs_up: { TW: "放大文字", EN: "Larger text" },
        tab_select: { TW: "選取", EN: "Select" },
        tab_props: { TW: "屬性", EN: "Properties" },
        tab_frame: { TW: "幀", EN: "Frame" },
        hint_detect: { TW: '按 🎈→📏 或 <kbd>F2</kbd> 偵測游標下的物件', EN: 'Press 🎈→📏 or <kbd>F2</kbd> to inspect the object under the cursor' },

        // ── Pen 面板頭 / 頁籤 ─────────────────────────────────────────────
        pen_title: { TW: "🖊 Pen · 繪圖", EN: "🖊 Pen · Draw" },
        pen_adsorb: { TW: "自動貼齊（網格＋物件邊/中對齊）", EN: "Auto-snap (grid + object edge/center alignment)" },
        pen_clean: { TW: "清除所有繪製的物件", EN: "Clear all drawn objects" },
        pen_clean_confirm: { TW: "清除所有繪製的物件？", EN: "Clear all drawn objects?" },
        ptab_layers: { TW: "圖層", EN: "Layers" },
        ptab_edit: { TW: "編輯", EN: "Edit" },
        ptab_draw: { TW: "繪製", EN: "Draw" },
        ptab_bg: { TW: "背景", EN: "Background" },
        layers_panel_title: { TW: "🗂 圖層", EN: "🗂 Layers" },
        close_layers: { TW: "關閉圖層面板", EN: "Close layers panel" },

        // ── 編輯頁 + 底部工具列 ───────────────────────────────────────────
        edit_hint: { TW: '點畫布上的物件、或到「圖層」面板挑一個，即可在這裡編輯它的類型 / 座標 / 尺寸 / 旋轉 / 文字 / 顏色。拖動時原位虛線、新位實線。', EN: 'Click an object on the canvas, or pick one in the "Layers" panel, to edit its type / position / size / rotation / text / color here. While dragging, the original position shows dashed and the new one solid.' },
        lbl_type: { TW: "類型", EN: "Type" },
        lbl_wh: { TW: "寬 / 高", EN: "W / H" },
        lbl_fontcolor: { TW: "字級 / 色", EN: "Size / Color" },
        chk_left: { TW: "靠左", EN: "Left" },
        chk_fill: { TW: "填色", EN: "Fill" },
        chk_border: { TW: "外框", EN: "Border" },
        footbar_none: { TW: "未選取物件", EN: "No object selected" },
        fhide_title: { TW: "顯示 → 只留外框 → 完全隱藏", EN: "Show → outline only → fully hidden" },
        flock_title: { TW: "鎖定 / 解鎖", EN: "Lock / unlock" },
        fdel_title: { TW: "刪除此物件", EN: "Delete this object" },

        // ── 繪製頁 ────────────────────────────────────────────────────────
        draw_hint: { TW: '選好類型後在畫布上拖出一個框（點一下 = 用下面的「預設尺寸」）；框裡都能打字。點既有物件會自動變成拖移。下方是「{type}」的預設樣式，之後畫的都會套用，不必反覆調整。', EN: 'Pick a type, then drag out a box on the canvas (a single click = use the "Default size" below); every box can hold text. Clicking an existing object switches to move. Below is the default style for "{type}", applied to everything you draw next — no need to keep re-adjusting.' },
        draw_defaults: { TW: "預設樣式 · {type}", EN: "Default style · {type}" },
        chk_fillbg: { TW: "底色", EN: "Fill" },
        lbl_edge: { TW: "邊線", EN: "Line" },
        lbl_deftext: { TW: "預設文字", EN: "Default text" },
        lbl_defsize: { TW: "預設尺寸", EN: "Default size" },
        lbl_wxh: { TW: "寬 × 高", EN: "W × H" },
        draw_note_defsize: { TW: '「預設尺寸」= 在畫布上只點一下（不拖曳）時新物件的寬高；拖曳時仍以拉出的大小為準。設定會自動存本地。', EN: '"Default size" = the width/height of a new object when you just click (without dragging) on the canvas; dragging still uses the size you draw. Settings are saved locally automatically.' },

        // ── 背景頁 ────────────────────────────────────────────────────────
        bg_grid: { TW: "網格", EN: "Grid" },
        chk_showgrid: { TW: "顯示網格", EN: "Show grid" },
        lbl_gap: { TW: "間距", EN: "Spacing" },
        lbl_thick: { TW: "粗細", EN: "Thickness" },
        lbl_shade: { TW: "深淺", EN: "Shade" },
        bg_sheet: { TW: "Sheet.jpg 底圖", EN: "Sheet.jpg backdrop" },
        chk_sheet: { TW: "覆蓋 Backgrounds/Sheet.jpg", EN: "Overlay Backgrounds/Sheet.jpg" },
        lbl_opacity: { TW: "透明度", EN: "Opacity" },
        bg_solid: { TW: "純色背景", EN: "Solid background" },
        chk_fillsolid: { TW: "填滿純色", EN: "Fill solid color" },
        bg_note: { TW: '由下到上疊：純色背景 → Sheet 底圖 → 網格 → 繪製物件，三者可同時開。BAR 每格為 5。', EN: 'Stacked bottom to top: solid background → Sheet backdrop → grid → drawn objects; all can be on at once. Each slider step = 5.' },

        // ── 圖層側邊面板 ──────────────────────────────────────────────────
        layers_empty: { TW: '還沒有物件。到「繪製」頁選類型後在畫布上拖出來。', EN: 'No objects yet. Pick a type on the "Draw" tab, then drag one out on the canvas.' },
        layers_legend: { TW: '👁顯示/外框/隱藏 · 🔒鎖定 · 🗑刪除', EN: '👁 show/outline/hide · 🔒 lock · 🗑 delete' },
        lock_title: { TW: "鎖定/解鎖", EN: "Lock / unlock" },
        del_title: { TW: "刪除", EN: "Delete" },

        // ── Setting 面板 ─────────────────────────────────────────────────
        set_title: { TW: "⚙ Setting", EN: "⚙ Setting" },
        set_h_io: { TW: "Pen 座標匯出 / 匯入", EN: "Pen coordinate export / import" },
        btn_exportfile: { TW: "匯出成檔案", EN: "Export to file" },
        btn_showjson: { TW: "顯示 JSON", EN: "Show JSON" },
        btn_copy: { TW: "複製", EN: "Copy" },
        io_placeholder: { TW: '按「匯出」把座標填到這裡，或貼上 JSON 後按「匯入」', EN: 'Click "Export" to fill coordinates here, or paste JSON and click "Import"' },
        btn_import: { TW: "從上框匯入", EN: "Import from box above" },
        btn_importfile: { TW: "選檔匯入…", EN: "Import from file…" },
        set_note_export: { TW: '匯出目前 <b>{n}</b> 個 Pen 物件（型別/座標/尺寸/字級/顏色/旋轉/隱藏/鎖定）。<span class="warn">匯入會取代目前全部物件。</span>', EN: 'Exports the current <b>{n}</b> Pen object(s) (type / position / size / font size / color / rotation / hidden / locked). <span class="warn">Importing replaces all current objects.</span>' },
        import_bad_format: { TW: "格式不符（找不到 objects 陣列）", EN: 'Invalid format (no "objects" array found)' },
        import_fail: { TW: "匯入失敗：{msg}", EN: "Import failed: {msg}" },
        export_fail: { TW: "匯出檔案失敗：{msg}", EN: "Export to file failed: {msg}" },

        // ── 幀（事件瀏覽器 + 回放）────────────────────────────────────────
        frozen_on: { TW: "◼ 已凍結", EN: "◼ Frozen" },
        frozen_off: { TW: "❚❚ 凍結這一幀", EN: "❚❚ Freeze this frame" },
        frozen_status_on: { TW: "清單已停住", EN: "List paused" },
        frozen_status_off: { TW: "清單每幀更新", EN: "List updates each frame" },
        h_replay: { TW: "逐呼叫回放", EN: "Per-call replay" },
        btn_drawall: { TW: "畫回全部", EN: "Draw all again" },
        replay_note: { TW: '拉滑桿 = 只畫前 N 個頂層繪製呼叫，畫面會停在「畫到一半」的狀態，可以看出每個東西是誰畫的、蓋在誰上面。<span class="warn">這是把「當下這一幀」切斷重畫，不是重播擷取到的舊幀</span> —— 靜態畫面兩者等價，會動的畫面（動畫、hover）就不是。', EN: 'Drag the slider = draw only the first N top-level calls, freezing the frame "half-drawn" so you can see who drew what and what covers what. <span class="warn">This cuts and redraws the current frame, it is not a replay of a captured old frame</span> — equivalent for a static image, but not for anything animated (animation, hover).' },
        frame_empty: { TW: "還沒有繪製資料，等一幀。", EN: "No draw data yet, wait a frame." },
        h_drawcalls: { TW: "繪製呼叫（{count}，頂層 {total}）", EN: "Draw calls ({count}, top-level {total})" },
        filter_placeholder: { TW: "過濾：函式名 / 文字 / 圖檔", EN: "Filter: function / text / image" },
        frame_note: { TW: '左邊數字是頂層呼叫序號（滑桿就是切在這個數字上）。有縮排的是子呼叫，屬於它上面那個頂層呼叫，跟著父層一起被切掉。灰掉的 = 目前被回放切掉、沒有畫出來。時間含子呼叫。點任一筆可跳到「選取」頁看它的細節。', EN: 'The left number is the top-level call index (the slider cuts on this number). Indented rows are sub-calls belonging to the top-level call above them, cut together with their parent. Greyed = currently cut by replay, not drawn. Time includes sub-calls. Click any row to jump to the "Select" tab for its details.' },

        // ── Canvas 資訊 ──────────────────────────────────────────────────
        lbl_click_coord: { TW: "點擊座標", EN: "Click coord" },
        lbl_actual_px: { TW: "實際像素", EN: "Actual pixel" },
        pixel_error: { TW: "取色失敗（畫布被跨域圖片污染）：{msg}", EN: "Color read failed (canvas tainted by a cross-origin image): {msg}" },
        no_record_note: { TW: '這個位置沒有任何被記錄到的繪製呼叫。可能是直接畫在背景上，或是由未被 hook 的函式繪製的。', EN: 'No recorded draw call at this position. It may be drawn straight onto the background, or by a function that is not hooked.' },
        h_selected_call: { TW: "選中的繪製呼叫", EN: "Selected draw call" },
        lbl_fn: { TW: "函式", EN: "Function" },
        lbl_rect: { TW: "矩形", EN: "Rect" },
        lbl_image: { TW: "圖片", EN: "Image" },
        lbl_tip: { TW: "提示", EN: "Tooltip" },
        lbl_decl_color: { TW: "宣告顏色", EN: "Declared color" },
        lbl_time: { TW: "耗時", EN: "Time" },
        suffix_subcalls: { TW: "(含子呼叫)", EN: "(incl. sub-calls)" },
        lbl_call_order: { TW: "呼叫序號", EN: "Call index" },
        suffix_toplevel: { TW: "(頂層)", EN: "(top-level)" },
        props_entry_note: { TW: '要改尺寸/字級/座標/顏色/旋轉{t} → 切到上方「屬性」頁。', EN: 'To change size / font size / position / color / rotation{t} → switch to the "Properties" tab above.' },
        props_entry_text: { TW: "/文字", EN: " / text" },

        // ── 圖層區塊（像素級命中）────────────────────────────────────────
        layer_unknown: { TW: "(未知圖層)", EN: "(unknown layer)" },
        h_layers_pixel: { TW: "圖層（像素級命中）", EN: "Layers (pixel-level hit)" },
        layer_no_blit: { TW: '抓不到角色的貼圖參數，無法換算座標。這通常表示這個畫面用了非標準的角色繪製路徑。', EN: 'Cannot read the character blit parameters, so coordinates cannot be converted. This usually means the frame used a non-standard character draw path.' },
        layer_no_record: { TW: "這個角色沒有圖層繪製紀錄。", EN: "This character has no layer draw records." },
        layer_no_hit: { TW: '游標下沒有任何不透明的圖層（點到的是全透明區域或角色以外的地方）。', EN: 'No opaque layer under the cursor (you clicked a fully transparent area or somewhere off the character).' },
        lbl_topmost: { TW: "最上層", EN: "Topmost" },
        suffix_sort_int: { TW: "(圖層排序用的 int)", EN: "(int used for layer ordering)" },
        lbl_alpha_at: { TW: "該點 alpha", EN: "Alpha here" },
        alpha_unreadable: { TW: "讀不到（跨域）", EN: "unreadable (cross-origin)" },
        lbl_layer_coord: { TW: "圖層座標", EN: "Layer coord" },
        suffix_char_canvas: { TW: "(角色畫布)", EN: "(character canvas)" },
        h_dye_one: { TW: '單獨染這一層 <span style="color:#777;font-weight:400">（item.Color[ColorIndex]）</span>', EN: 'Dye this single layer <span style="color:#777;font-weight:400">(item.Color[ColorIndex])</span>' },
        dye_one_note: { TW: '◆ = 游標下實際命中（已排除透明像素）。P 數字就是 layer.Priority，BC 靠它決定誰蓋誰；道具的 <code>Property.OverridePriority</code> 會覆蓋它。單層染色會把 item.Color 攤成陣列再改指定那一格。', EN: '◆ = actual hit under the cursor (transparent pixels excluded). The P number is layer.Priority — BC uses it to decide what covers what; an item\'s <code>Property.OverridePriority</code> overrides it. Single-layer dyeing expands item.Color into an array and edits just that slot.' },
        h_full_stack: { TW: "完整圖層堆疊（{n}）", EN: "Full layer stack ({n})" },
        full_stack_note: { TW: '由上而下 = 由最上層到最底層，直接讀 C.AppearanceLayers（BC 已排序好的結果）。', EN: 'Top to bottom = topmost to bottommost, read straight from C.AppearanceLayers (already sorted by BC).' },

        // ── 角色工具 ──────────────────────────────────────────────────────
        h_character: { TW: "角色", EN: "Character" },
        lbl_name: { TW: "名稱", EN: "Name" },
        lbl_member: { TW: "會員編號", EN: "Member #" },
        lbl_height_ratio: { TW: "身高比例", EN: "Height ratio" },
        lbl_hit_zone: { TW: "命中部位", EN: "Hit zone" },
        h_dye_item: { TW: '整件染色 <span style="color:#777;font-weight:400">（item.Color，所有層一起）</span>', EN: 'Dye whole item <span style="color:#777;font-weight:400">(item.Color, all layers together)</span>' },
        no_appearance: { TW: "這個角色身上沒有可讀取的 Appearance。", EN: "This character has no readable Appearance." },
        btn_reset_item: { TW: "還原這件", EN: "Reset this item" },
        chk_sync_server: { TW: "同步到伺服器（只對自己有效）", EN: "Sync to server (only works for yourself)" },
        dye_item_note: { TW: '◆ 標記 = 你點到的部位。拖色盤就會即時看到變化。未勾同步時只改本地畫面，重新整理或角色重載就會回復。多層可染色的道具（ColorableLayerCount &gt; 1）會把所有層設成同一色。', EN: '◆ marks the zone you clicked. Drag the color picker to see changes live. With sync off, only your local view changes and it reverts on refresh or character reload. Items with multiple colorable layers (ColorableLayerCount &gt; 1) set all layers to the same color.' },

        // ── 紋理 / 繪製狀態 ──────────────────────────────────────────────
        h_texture: { TW: "紋理", EN: "Texture" },
        h_draw_state: { TW: "繪製狀態", EN: "Draw state" },
        lbl_composite: { TW: "合成模式", EN: "Composite mode" },
        lbl_font: { TW: "字型", EN: "Font" },
        identity_matrix: { TW: "單位矩陣", EN: "identity matrix" },

        // ── 屬性（可即時編輯）────────────────────────────────────────────
        h_props: { TW: '屬性 <span style="color:#777;font-weight:400">（改了立刻生效）</span>', EN: 'Properties <span style="color:#777;font-weight:400">(applies instantly)</span>' },
        props_no_sel: { TW: '先在「選取」頁偵測一個物件，再回這裡改它的尺寸/字級/座標/顏色/旋轉', EN: 'Inspect an object on the "Select" tab first, then come back here to change its size / font size / position / color / rotation' },
        props_no_editable: { TW: "這個位置沒有可編輯的繪製呼叫", EN: "No editable draw call at this position" },
        no_editable_note: { TW: "這個繪製呼叫沒有登記可編輯的參數，只能看不能改。", EN: "This draw call has no editable parameters registered — view only." },
        lbl_radius: { TW: "半徑", EN: "Radius" },
        lbl_w: { TW: "寬", EN: "Width" },
        lbl_h: { TW: "高", EN: "Height" },
        text_note: { TW: '改的是繪製前傳進去的文字內容，不是資料，畫面每幀重畫；清空欄位可還原成原文字：', EN: 'This changes the text passed in before drawing, not the data; the frame redraws every tick. Clear the field to restore the original text:' },
        lbl_fontsize: { TW: "字級", EN: "Font size" },
        btn_reset_this: { TW: "還原這個", EN: "Reset this" },
        btn_reset_all: { TW: "還原全部 ({n})", EN: "Reset all ({n})" },
        ui_note_main: { TW: '改的是繪製前的參數/變換，不是資料 —— 畫面每幀重畫，所以拖動數字就即時看到位移/變色/旋轉/字級/文字的效果。比對依據是「函式名 + 原始座標」，換畫面或元件本來就會動的話就會失效（還原鈕仍可清掉）。', EN: 'This changes the pre-draw parameters/transform, not the data — the frame redraws every tick, so dragging a number shows the move/recolor/rotation/font/text effect live. Matching is by "function name + original coordinates", so it breaks when the screen changes or the element moves on its own (the reset button can still clear it).' },
        warn_textfit: { TW: 'DrawTextFit 會自動縮放字級去塞進固定寬度，改字級多半看不出來，建議改「寬」讓它自己放大。', EN: 'DrawTextFit auto-scales the font to fit a fixed width, so changing font size usually shows nothing — change "Width" instead and let it scale up.' },
        warn_button: { TW: '滑鼠移上按鈕時 BC 會強制畫成 Cyan，改的顏色要移開滑鼠才看得到。', EN: 'BC forces a hovered button to Cyan, so your color change only shows once the mouse moves off.' },

        // ── 繪製堆疊 ──────────────────────────────────────────────────────
        h_stack: { TW: "這個位置的繪製堆疊（{n}）", EN: "Draw stack at this position ({n})" },
        stack_note: { TW: '由上而下 = 由最上層到最底層。點任一筆可切換選取。<b>#數字是這一幀的繪製呼叫序號</b> —— 介面元件沒有 priority 之類的 int，純粹「誰後畫誰在上面」，所以序號就是它的 z 序。只有角色圖層才有真正的 Priority。', EN: 'Top to bottom = topmost to bottommost. Click any row to switch selection. <b>The # number is this frame\'s draw-call index</b> — UI elements have no priority int, it is purely "later drawn = on top", so the index is its z-order. Only character layers have a real Priority.' },

        // ── DOM 資訊 / 編輯 ──────────────────────────────────────────────
        no_element: { TW: "抓不到元素", EN: "Element not found" },
        lbl_tag: { TW: "標籤", EN: "Tag" },
        lbl_canvas_coord: { TW: "畫布座標", EN: "Canvas coord" },
        lbl_canvas_size: { TW: "畫布尺寸", EN: "Canvas size" },
        lbl_screen_coord: { TW: "螢幕座標", EN: "Screen coord" },
        suffix_actual_px: { TW: "(實際 px)", EN: "(actual px)" },
        lbl_screen_size: { TW: "螢幕尺寸", EN: "Screen size" },
        dom_entry_note: { TW: '要改位置/尺寸/顏色 → 切到上方「屬性」頁。', EN: 'To change position / size / color → switch to the "Properties" tab above.' },
        lbl_bg: { TW: "背景", EN: "Background" },
        lbl_border: { TW: "邊框", EN: "Border" },
        btn_reset_element: { TW: "還原這個元素", EN: "Reset this element" },
        dom_note: { TW: '直接寫進 element.style（行內樣式），改了馬上看得到。BC 重建該元素或視窗縮放重新排版後就會被蓋掉。位置欄要帶單位，例如 <code>120px</code>。', EN: 'Written straight into element.style (inline style), visible immediately. It gets overwritten when BC rebuilds the element or a window resize re-lays-out. Position fields need units, e.g. <code>120px</code>.' },

    });
})();
