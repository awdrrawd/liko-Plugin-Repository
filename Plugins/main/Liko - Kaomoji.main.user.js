// ==UserScript==
// @name         Liko - Kaomoji
// @name:zh      Liko的文字表情
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.1.0
// @description  Bondage Club - 文字表情快捷面板：点击颜文字自动插入聊天输入框，支持收藏/常用/自定义分组/拖动排序
// @author       Likolisu & TAO
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Kaomoji.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Kaomoji.main.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};

    // 共用系統擴充載入器：先判斷是否存在，不存在才上網抓。不再自帶精簡版協調器（避免多處維護）。
    // 通常經 PCM 路徑早已載好，這裡是罕見的獨立安裝 fallback；抓來的檔案自身有防重複載入守衛。
    const _EXPAND_BASES = (typeof window !== 'undefined' && window.LikoDevBase)
        ? [window.LikoDevBase]
        : [
            'https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/',
            'https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/',
            'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/',
        ];
    const _expandDepPromises = {};
    function ensureExpandDep(rel, ready) {
        if (ready && ready()) return Promise.resolve();
        if (_expandDepPromises[rel]) return _expandDepPromises[rel];
        _expandDepPromises[rel] = (async () => {
            let lastErr;
            for (const base of _EXPAND_BASES) {
                try {
                    const res = await fetch(base + rel, { cache: 'no-store' });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const text = await res.text();
                    if (!text || text.trimStart().startsWith('<')) throw new Error('bad content');
                    const s = document.createElement('script');
                    s.textContent = text + '\n//# sourceURL=' + rel;
                    document.head.appendChild(s);
                    return;
                } catch (e) { lastErr = e; console.warn('🐈‍⬛ [Kaomoji] ⚠️ ' + base + rel + ': ' + e.message); }
            }
            throw lastErr ?? new Error('all bases failed: ' + rel);
        })();
        return _expandDepPromises[rel];
    }

    // 共用按鈕順序協調器：儘早開始載入（能力偵測 ?.add）。按鈕規格於下方同步登記，不綁在此處
    // 的載入 promise 上——協調器早晚/被誰載入都會把已登記的按鈕建/補回（見 __CRB_pending__ 佇列）。
    ensureExpandDep('expand/BC_ChatRoomButtons.js', () => window.Liko.__Sys_ChatRoomButtons__?.add)
        .catch(e => console.warn('🐈‍⬛ [Kaomoji] ⚠️ ChatRoomButtons 載入失敗，按鈕無法加入:', e.message));

    try {
        window.Liko.Kaomoji = window.Liko.Kaomoji ?? {};
        if (typeof window.Liko.Kaomoji?.Destroy === 'function') {
            try { window.Liko.Kaomoji.Destroy(); } catch (e) {}
            console.warn("🐈‍⬛ [Kaomoji] 已销毁旧实例并重新初始化");
        }
        // Destroy() 内部会把 window.Liko.Kaomoji 重置为 {}，这里保险起见再确认一次，
        window.Liko.Kaomoji = window.Liko.Kaomoji ?? {};
        if (window.Liko.Kaomoji.version) return;
        const MOD_VER = "1.1.0";
        window.Liko.Kaomoji.version = MOD_VER;

        /* ── 常量 ──────────────────────────────────────────────────────────── */
        const STORAGE_SIZE = 'likoKaomoji_panel_size';
        const STORAGE_GROUPS = 'likoKaomoji_groups';        // 仅存储【自定义分组】，内建分类不落盘
        const STORAGE_RECENT = 'likoKaomoji_recent';        // 常用
        const STORAGE_FAVS = 'likoKaomoji_favorites';       // 收藏
        const STORAGE_SEND = 'likoKaomoji_autoSend';
        const STORAGE_AUTOCLOSE = 'likoKaomoji_autoClose'; // 点击表情后自动关闭面板
        const STORAGE_COLLAPSE = 'likoKaomoji_chatButtonsCollapsed'; // 原生"收纳按钮列"展开/收合状态
        const sys_CRB = 5;   //#chat-room-buttons 順位設定

        /* 内建分类（只读，永远从代码读取，不写入 localStorage） */
        const DEFAULT_GROUPS = [
            {
                id: 'g_happy', name: '開心', emotes: [
                    "( ੭ ˙ᗜ˙ )੭", "٩꒰｡•◡•｡꒱۶", "ᕕ(◠ڼ◠)ᕗ", "ఇ ◝‿◜ ఇ", "›⩊‹", "(⁎⁍̴̛ᴗ⁍̴̛⁎)",
                    "(●'▿'●)", "( ˶ˊᵕˋ)੭♡", "ꉂꉂ(ˊᗜˋ*)ʬʬ", "(๑¯∀¯๑)", "( ˘ ³˘)♥", "⸜(*ˊᗜˋ*)⸝",
                    "(๑´ڡ`๑)", "◝(⁰▿⁰)◜", "(❛◡❛✿)", "(*´∀`)~♥", "ヾ(´ε`ヾ)", "ヾ(´︶`*)ﾉ♬",
                    "('ω'✌︎ )", "•͈౿•͈", "(๑˃́ꇴ˂̀๑)", "ς(* ` ˘ ´ *)", "♡꒰´꒳`∗꒱", "◍•ᴗ•◍",
                    "ഹ്ദി ˉ͈̀꒳ˉ͈́ )✧", "( ᐛ )", "(ᕑᗢᓫ∗)˒", "*⸜( •ᴗ• )⸝*", "⑉¯ ꇴ ¯⑉", "⍢",
                    "๑◔◡◔๑", "୧⍢⃝୨", "^•ω<^", "⌯>ᴗo⌯ಣ", "´͈ ᵕ `͈ ♡", "ᖰ·:·ʘ̅͜ʘ̅·:·ᖳ",
                    "٩(๑❛ᴗ❛๑)۶", "٩(ˊᗜˋ*)و", "(*ෆ´ ˘ `ෆ*)", "ഹ്ദി (⩌ᴗ⩌ )", "( ⁼̴̀ .̫ ⁼̴ )✧", "( ⩌⩊⩌)✧",
                    "(๑°﹃°๑)", "(｡•ㅅ•｡)♡", "ᐠ( ᐢ ᵕ ᐢ )ᐟ", "◉‿◉", "(◐∇◐*)", "(ﾟ∀ﾟ)",
                    "(*ﾟ∀ﾟ*)", "(*´▽`*)", "ヽ(●´∀`●)ﾉ", "(*´艸`*)", "(*‘ v`*)", "(^u^)",
                    "(^y^)", "(ﾉ>ω<)ﾉ", "(｡A｡)", "(ﾉ∀`*)", "(*’ｰ’*)", "d(`･∀･)b",
                    "(,,・ω・,,)", "(((ﾟдﾟ)))", "(｡◕∀◕｡)", "ヽ(✿ﾟ▽ﾟ)ノ", "(」・ω・)」うー！(／・ω・)／にゃー！", "｡:.ﾟヽ(*´∀`)ﾉﾟ.:｡",
                    "ξ( ✿＞◡❛)▄︻▇▇〓▄︻┻┳═一", "(✪ω✪)", "(⁰▿⁰)", "(๑´ㅂ`๑)", "ヽ(・×・´)ゞ", "(o´罒`o)",
                    "☆⌒(*^-゜)v", "(灬ºωº灬)", "(´///☁///`)", "(๑• . •๑)", "(ㅅ˘ㅂ˘)", "٩(｡・ω・｡)﻿و",
                    "(*ˇωˇ*人)", "☆^(ｏ´Ф∇Ф)o", "(,,ﾟДﾟ)", "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "o(☆Ф∇Ф☆)o", "( • ̀ω•́ )",
                    "(ﾟω´)", "(●｀ 艸 ´)", "ヽ(㊤V㊤*)ﾉ", "＼(●´ϖ`●)／", "(•ㅂ•)/", "( *´◒`*)",
                    "(((o(*ﾟ▽ﾟ*)o)))", "٩(๑•̀ω•́๑)۶", "(＊゜ー゜)b", "(ﾟд⊙)", "(ゝ∀･)b", "d(d＇∀＇)",
                    "(ﾟ3ﾟ)～♪", "(〃∀〃)", "(శωశ)", "(◔౪◔)", "((└(:3」┌)┘))", "(∂ω∂)",
                    "(<ゝω・) 綺羅星☆", "_(:3 ⌒ﾞ)_", "( σ՞ਊ ՞)σ", "ლ(́◕◞౪◟◕‵ლ)", "(◕ܫ◕)", "(´ΘωΘ`)",
                    "_(¦3」∠)_", "♥(´∀` )人", "( ～'ω')～", "(๑ơ ₃ ơ)♥", "(^ρ^)/", "(๑´ㅁ`)",
                    "( ﾒ∀・)", "。゜+.(人-ω◕)゜+.゜", "━(ﾟ∀ﾟ)━( ﾟ∀)━( ﾟ)━( )━( )━(ﾟ)━(∀ﾟ)━(ﾟ∀ﾟ)━", "✧◝(⁰▿⁰)◜✧", "(・ε・)", "(꒪ͦᴗ̵̍꒪ͦ )",
                    "(*ﾟーﾟ)", "◝(　ﾟ∀ ﾟ )◟", "(*´д`)", "(❁´ω`❁)*✲ﾟ*", "(▰˘◡˘▰)", "(っ●ω●)っ",
                    "(●⁰౪⁰●)", "ᕕ ( ᐛ ) ᕗ", "ε(*´･∀･｀)зﾞ", "(́순◞౪◟순‵)", "(//´/◒/`//)", "(づ′▽`)づ",
                    "(◍•ᴗ•◍)ゝ", "ε٩(๑> ₃ <)۶з", "(　ﾟ∀ﾟ)つ≡≡≡♡♡♡)`ν゜)ｸﾞｼｬ", "(●´ω｀●)ゞ", "♡(*´∀｀*)人(*´∀｀*)♡", "(*´з｀*)",
                    "ヾ(●゜▽゜●)♡", "( శ 3ੜ)～♥", "( ♥д♥)", "(♡˙︶˙♡)", "Σ>―(〃°ω°〃)♡→", "( *¯ ³¯*)♡ㄘゅ",
                    "(　ﾟ∀ﾟ) ﾉ♡", "(*´д`)~♥", "(╭￣3￣)╭♡", "(,,Ծ 3 Ծ,,)", "(,,ᴗ ᴗ,,) ⁾⁾", "(*´Д`)つ))´∀`)",
                    "(o´・ω・`)σ)Д`)", "(*´ω`)人(´ω`*)", "(ｏﾟﾛﾟ)┌┛Σ(ﾉ´*ω*`)ﾉ", "(´>∀)人(´・ω・)ﾉヽ(・ε・*)人(-д-`)", "ヽ(∀ﾟ )人(ﾟ∀ﾟ)人( ﾟ∀)人(∀ﾟ )人(ﾟ∀ﾟ)人( ﾟ∀)ﾉ", "ლ(・´ｪ`・ლ)",
                    "(σ回ω・)σ←↑→↓←↑", "(#‵)3′)▂▂▂▃▄▅～～～嗡嗡嗡嗡嗡", "#ﾟÅﾟ）⊂彡☆))ﾟДﾟ)･∵", "(ㄏ￣▽￣)ㄏ   ㄟ(￣▽￣ㄟ)", "ლ(ﾟдﾟლ)", "( ﾟ∀ﾟ)o彡ﾟ",
                    "( ‘д‘⊂彡☆))Д´)", "(　′∀`)σ≡σ☆))Д′)", "ﾚ(ﾟ∀ﾟ;)ﾍ=З=З=З", "ε≡(ノ´＿ゝ｀）ノ", "どこ━━━━(゜∀゜三゜∀゜)━━━━!!??", "σ(´∀｀*)",
                    "┏( .-. ┏ ) ┓", "(∩^o^)⊃━☆ﾟ.*･｡", "..._〆(°▽°*)", "ε=ε=ヾ(;ﾟдﾟ)/", "ε≡ﾍ( ´∀`)ﾉ", "|Д`)ノ⌒●～*",
                    "( ´∀`);y=ｰ(ﾟдﾟ)･∵. ﾀｰﾝ", "(´･д･｀)ﾊ(･д･｀*)", "(๑•̀ㅂ•́)و✧", "(“￣▽￣)-o█ █o-(￣▽￣”)/", "(・∀・)ノ三G[__]ｺ", "(｢･ω･)｢",
                    "=└(┐卍^o^)卍", "(=ﾟДﾟ=) ▄︻┻┳━ ·.`.`.`.", "( ´-ω ･)▄︻┻┳══━", "(:3っ)へ ヽ(´Д｀●ヽ)", ": ♡｡ﾟ.(*♡´◡` 人´◡` ♡*)ﾟ♡ °・", "( ´･･)ﾉ(._.`)",
                    "(´д((☆ミPia!⊂▼(ｏ ‵－′ｏ)▼つPia!彡★))∀`)", "(￣ε(#￣)☆", "(/ ↀ3ↀ)/q(﹌ω﹌ )", "╮/(＞▽<)人(>▽＜)╭", "(〃￣ω￣)人(￣︶￣〃)", "（つ> _◕）つ︻╦̵̵͇̿̿̿̿╤───",
                    "༼ つ/̵͇̿̿/’̿’̿ ̿ ̿̿ ̿̿◕ _◕ ༽つ/̵͇̿̿/’̿’̿ ̿ ̿̿ ̿̿ ̿̿"
                ]
            },
            {
                id: 'g_shy', name: '害羞', emotes: [
                    "꒰ঌ(⸝⸝ ↀ ᯅ ↀ⸝⸝)໒꒱", "( ˶˙ᵕ˙˶)꜆", "( ´͈ ᗜ `͈ )♡", "( ｡•̀_•́｡)", "♡´･ᴗ･`♡", "( ˶ ̇ᵕ ̇˶)",
                    "(〃∇〃)", "(〃'▽'〃)", "(⑉꒦ິ^꒦ິ⑉)", "(⑅•͈⌔•͈)", "(৹ᵒ̴̶̷᷄́ฅᵒ̴̶̷᷅৹)", "໒꒰ྀི˶˚ଳ˚˶ ꒱ྀི১",
                    "(꒪˙꒳˙꒪)", "(｡’▽’｡)♡", "o(*////▽////*)q", "( ͒ ु•·̫• ू ͒)♡", "(´,,•ω•,,`)", "(´,,•ω•,,)♡",
                    "(｡ﾉω＼｡)", "(ᐥ꒳ᐥ )", "(´///ω/// `)", "૮៸៸›‹៸៸ა", "٩( ˵ᐛ ˵)۶", "(｡•ᴗ•｡)",
                    "(⑉´•-•`⑉)", "◍´꒳`◍", "（ „•_•„）", "(⸝⸝•‧̫•⸝⸝)", "( ˶´⚰︎`˵ )", "´͈ ᵕ `͈",
                    "ꈍ .̮ ꈍ", "(•̶̑ ૄ •̶̑)", "(人 •͈ᴗ•͈)۶♡♡", "( ⑉¯ ꇴ ¯⑉ )", "⸝⸝⸝⸝◟̆◞̆♡", "(•ૢ⚈͒⌄⚈͒•ૢ)",
                    "(˘❥˘)", "づ♡ど", "⚗︎·̫⚗︎", "(･´з`･)", "( ⑉¯ ¯⑉ )", "⁄(⁄⁄⁄ω⁄⁄⁄)⁄",
                    "- ̗̀ ෆ( ˶'ᵕ'˶)ෆ ̖́-", "(⸝⸝- -⸝⸝)", "ദ്ദി ˉ͈̀꒳ˉ͈́ )", "(՞˶･֊･˶՞) ෆ", "૮ ˶ᵔ ᵕ ᵔ˶ ა", "(๑ ⁰̴̷̷ ˙̮ ⁰̴̷̷๑)ﾉ",
                    "(๑•ϖ•๑ )", "(๑ᵒ̴̶̷͈᷄ᗨᵒ̴̶̷͈᷅)", "⸜(๑⃙⃘ˊᗜˋ๑⃙⃘)⸝", "⁽⁽ (♡ˊᵕˋ♡) ⁾⁾", "(*´艸`*)♡", "|•'-'•)",
                    "⁽⁽٩(๑˃̶͈̀ ᗨ ˂̶͈́)۶⁾⁾", "⸜(* ॑꒳ ॑* )⸝", "⁄(⁄ ⁄•⁄ω⁄•⁄ ⁄)⁄", "٩(｡・ω・｡)و", "(´๐•ω•๐`)", "(⸝⸝⸝´꒳`⸝⸝⸝)",
                    "(///ˊㅿˋ///)", "ჱ̒⸝⸝•̀֊•́⸝⸝)", "( ˶•ᴗ• ˶)", "( ˶˙º̬˙˶ )", "( ˶'-'˶)", "(● ˃̶͈̀ロ˂̶͈́)੭ꠥ⁾⁾",
                    "( ᐡᴗ͈ ̫ ᴗ͈ᐡ)", "๑’ᵕ’๑", "(ෆ`꒳´ෆ)", "໒꒰ྀི ' ᵕ ' ྀི꒱১", "(⸝⸝･-･⸝⸝)", "꒰˶•༝•˵꒱",
                    "(ू•‧̫•ू⑅)", "((٩(//̀Д/́/)۶))", "( ˶´︎ω`˵ )", "( ˶´︎ч`˵ )", "๑˃̶͈̀Ⱉ˂̶͈́๑", "( ˶¯꒳¯˵)",
                    "꒰ᐢ˶•༝•˵ᐢ꒱", "(՞˶ᵒ̴̶̷᷄꒳ᵒ̴̶̷᷅ ˶՞)", "(⸝⸝´꒳`⸝⸝)", "(˶ ´˘`˶)", "( ⸝⸝ᵕᴗᵕ⸝⸝)", "(◍´͈ꈊ`͈◍)",
                    "꒰⑅ᵕ༚ᵕ꒱˖♡", "♡˖꒰ᵕ༚ᵕ⑅꒱", "(〃ﾟ3ﾟ〃)", "(´ε｀ )", "╰(⸝⸝⸝´꒳`⸝⸝⸝)╯", "(｡･ω･｡)ﾉ♡",
                    "(*´ ˘ `๓)", "(◍ˊㅿˋ◍)", "˶•̀д•́˶", "(´｡• ω •｡`)", "(⑅•͈૦•͈⑅)", "(˵¯͒⌢¯͒˵)",
                    "୧((〃•̀ꇴ•́〃))૭", "(∗ᵒ̶̶̷̀ω˂̶́∗)੭₎₎̊", "(σ⸝ᵒ̴̶̷̥́꒳ ᵒ̴̶̷̣̥̀⸝)σ", "|˛˙꒳˙)♡"
                ]
            },
            {
                id: 'g_sad', name: '生氣', emotes: [
                    "(ﾟд⊙)", "('⊙д-)", "ฅ(๑*д*๑)ฅ!!", "(゜ロ゜)", "Σ(*ﾟдﾟﾉ)ﾉ", "(☉д⊙)",
                    "(╬☉д⊙)", "٩(๑`^´๑)۶", "꒰๑×﹏×๑꒱", "꒰◔_◔꒱", "꒰╬•᷅д•᷄╬꒱", "(·•᷄ࡇ•᷅ ）",
                    "ꐦ≖ ≖", "( ͠° ͟ʖ ͡°)", "(✘﹏✘ა)", "(⌯❛౪❛ก )꜆꜄꜆꜄", "( ꙭ )", "( Ꙭ )",
                    "◔̯◔", "•͈ ₃ •͈", "٩(๑`н´๑)۶", "(๑و•̀Δ•́)و", "(.˙ ˡ̼̮ ˙)", "ಠಿ_ಠ",
                    "Ꙩꙻ₀Ꙩꙻ", ",,Ծ‸Ծ,,", "᷄•̆₃•̑", "ᐡ•͈ ·̭ •͈ᐡ", "(；´д｀)ゞ", "（￣□￣；）",
                    "ฅ(´-ω-)ฅ", "(* >ω<)", "ヽ(#Д´)ﾉ`", "(•̀へ •́╬)", "٩(๑^´๑)۶", "凸ಠ益ಠ)凸",
                    "(｡>﹏<｡)", "(ꐦ°᷄д°᷅)", "(ノ▼Д▼)ノ", "˃ ⤙ ˂", "• ·̭ •", "(ʘ̆ʚʘ̆)",
                    "Ծ‸Ծ", "(`3´)", "(ﾟ皿ﾟﾒ)", "(ﾒ ﾟ皿ﾟ)ﾒ", "(┛`д´)┛", "(#`Д´)ﾉ",
                    "(#`皿´)", "(-`ェ´-╬)", "(╬ﾟдﾟ)", "(`д´)", "ヽ(#`Д´)ﾉ", "(／‵Д′)／~ ╧╧",
                    "(　◞≼☸≽◟ ._ゝ◞≼☸≽◟)", "⊙谷⊙", "ヽ(`Д´)ノ", "(╬ﾟдﾟ)▄︻┻┳═一", "٩(ŏ﹏ŏ、)۶", "（ ´ﾟ,_」ﾟ）ﾊﾞｶｼﾞｬﾈｰﾉ",
                    "(╬ﾟ ◣ ﾟ)", "(☄◣ω◢)☄", "(ಠ益ಠ)", "(ﾒﾟДﾟ)ﾒ", "(`へ´≠)", "(・`ω´・)",
                    "(#ﾟ⊿`)凸", "╯-____-)╯~═╩════╩═", "(*≥▽≤)ツ┏━┓", "( ╯' - ')╯ ┻━┻", "(╯°O°)╯┻━┻", "(╯°Д°)╯ ┻━┻",
                    "(๑•ૅω•´๑)", "(╯ŏ益ŏ)╯︵(ヽo□o)ヽ", "(╬▼дﾟ)▄︻┻┳═一", "(╯•̀ὤ•́)╯", "(； ･`д･´)", "( ･᷄ὢ･᷅ )",
                    "ᕕ༼ ͠ຈ Ĺ̯ ͠ຈ ༽┌∩┐", "(╬ﾟдﾟ)╭∩╮", "٩(◦`꒳´◦)۶", "(д) ﾟﾟ", "Σ(;ﾟдﾟ)", "(●▼●;)",
                    "┌|◎o◎|┘", "∑(ι´Дン)ノ", "(°ﾛ°٥)", "＼(●o○;)ノ", "Σ(°Д°;", "Σヽ(ﾟД ﾟ; )ﾉ",
                    "∑(￣□￣;)", "∑(✘Д✘๑ )", "ㅇㅅㅇ", "(;◉∀◉)オッ(∀◉)◉ハッ(;∀)◉◉ヨｫー!!!", "( ºωº )", "δ△δ",
                    "(ﾟ∀ﾟ;)", "<(ºOº)>"
                ]
            },
            {
                id: 'g_cry', name: '難過', emotes: [
                    "ᓀ‸ᓂ", "( ᗜ˰´ᗜ )", "（ᵒ̴̶̷̥́ ·̫ ᵒ̴̶̷̣̥̀）", "˃̣̣̥᷄⌓˂̣̣̥᷅", "༼ಢ_ಢ༽", "༼ ༎ຶ ෴ ༎ຶ༽",
                    "(´°̥̥̥̥ω°̥̥̥̥｀)", "╮(╯_╰)╭", "( ´•︵•` )", "(｡ŏ_ŏ)", "(☍﹏⁰)", "థ౪థ",
                    "ㅍㅅㅍ", "꒰˚ ˃̣̣̥⌓˂̣̣̥ ꒱", "｡ﾟ", "꒰ ﾟஇ‸இﾟ꒱｡ﾟ", "(⋟﹏⋞)", "ಥ_ಥ",
                    "▄█▀█●", "ฅ(๑ ̀ㅅ ́๑)ฅ", "o(´^｀)o", "(ಥ_ʖಥ)", "(╥﹏╥)", "(̨̡ ‾᷄ᗣ‾᷅ )̧̢",
                    "˃ ˄ ˂̥̥", "ᖰ ˙ỏ˙ ᖳ", "•᎔•", "(⚲□⚲)", "ฅ^._.^ฅ", "ฅ˙Ⱉ˙ฅ",
                    "๐˙Ⱉ˙๐", "ฅ⁽͑ ˚̀ ˙̭ ˚́ ⁾̉ฅ", "(^._.^)ﾉ", "(〒︿〒)", "｡ﾟヽ(ﾟ´Д`)ﾉﾟ｡", "(´ﾟдﾟ`)",
                    "(๑•́ ₃ •̀๑)", "இдஇ", "(´;ω;`)", "(´;ω;`)ヾ(･∀･`)", "( ˘･з･)", "(´Ａ｀。)",
                    "(◜◔。◔◝)", "(　´・◡・｀)", "ヾ(◎´・ω・｀)ノ", "( ´•̥̥̥ω•̥̥̥` )", "(;´༎ຶД༎ຶ`)", "( •́ὤ•̀)",
                    "( ´•̥×•̥` )", "(☍﹏⁰。)", "L(　；ω；)┘三└(；ω；　)」", "(⁠´⁠；⁠ω⁠；⁠｀⁠)", "ヾ(;ﾟ;Д;ﾟ;)ﾉﾞ", "。･ﾟ･(つд`ﾟ)･ﾟ･",
                    "⊂彡☆))д`)", "・゜・(PД`q｡)・゜・", "⋉(● ∸ ●)⋊", "Σ(ﾟДﾟ；≡；ﾟдﾟ)", "◢▆▅▄▃崩╰(〒皿〒)╯潰▃▄▅▇◣", "(◓Д◒)✄╰⋃╯",
                    "(°ཀ°)", "( º﹃º )", "(›´ω`‹ )", "( ×ω× )", "(✺ω✺)", "(ﾟ々｡)",
                    "_(┐「﹃ﾟ｡)_", "_(´ཀ`」 ∠)_", "0(:3　)～ ('､3_ヽ)_", ":;(∩´﹏`∩);:", "ΩДΩ", "( ͡ʘ ͜ʖ ͡ʘ)",
                    "_(┐ ◟;ﾟдﾟ)ノ", "(´ー`)", "(‘⊙д-)", "(´c_`)", "(=m=)", "(´・Å・`)",
                    "(´_ゝ`)", "(|||ﾟдﾟ)", "-`д´-", "_(┐「ε:)_", "＿ﾉ乙(､ﾝ､)＿", "(´･_･`)",
                    "|柱|ω・`)", "(ﾟ⊿ﾟ)", "(ㆆᴗㆆ)", "(　◜◡‾)", "┐(´д`)┌", "（’へ’）",
                    "(´σ-`)", "(´～`)", "( ˘•ω•˘ )", "(눈‸눈)", "╮(′～‵〞)╭", "(´-ω-｀)",
                    "( ´ﾟДﾟ`)", "┳━┳ノ( ' - 'ノ)", "┳━┳ノ( OωOノ)", "(≖＿≖)✧", "ƪ(•̃͡ε•̃͡)∫", "(｡-_-｡)",
                    "( ¯•ω•¯ )", "╮(╯∀╰)╭", "( •́ _ •̀)？", "-//(ǒ.ǒ)//-", "_:(´□`」 ∠):_", "눈言눈",
                    "(ㆀ˘･з･˘)", "(ノ〠_〠)", "¯\\_(ツ)_/¯", "ㅍ_ㅍ", "('◐_﹥◑)", "( ´･ω)",
                    "(｡í _ ì｡)", "ヾ(⌒(_´･ㅅ･`)_", "(◞‸◟)", "il||li _|￣|○ヽ(･ω･｀)", "<(_ _)>", "m(｡≧ｴ≦｡)m",
                    "(●б人<●)", "(；´ﾟωﾟ｀人)", "๛ก（ーωーก）"
                ]
            },
            {
                id: 'g_cat', name: '貓貓', emotes: [
                    "/•᷅•᷄\\୭", "₍˄•༝•˄₎◞✩︎", "^⦁᎑-^ ੭", "^⑉･-･⑉^ ੭", "ᓚᘏᗢ", "ฅ^•ﻌ•^ฅ",
                    "ฅ՞•ﻌ•՞ฅ", "/ᐠ｡ꞈ｡ᐟ\\", "/ᐠ .ᆺ. ᐟ\\ﾉ", "ᨐᵉᵒʷ", "ि०॰०ॢी", "( ⌓ ω ⌓ )",
                    "^ↀᴥↀ^", "(͒ ⓿ᴥ⓿ )͒", "…ᘛ⁐̤ᕐᐷ", "₍⸍⸌̣ʷ̣̫⸍̣⸌₎"
                ]
            },
            {
                id: 'g_animals', name: '動物', emotes: [
                    "১/ খ৫৩ |63 ٤٠", "੯‧̀͡u\\", "੯‧̀͡ᥬ⑅ྀི\\", "✧੯•́໒꒱", "(￫ܫ￩)", "໒(＾ᴥ＾)七",
                    "ᐡ ᐧ ﻌ ᐧ ᐡ", "( ͡° ᴥ ͡° ʋ)", "˵ ಠ ᴥ ಠ ˵", "V●ω●V", "∪･ω･∪", "▽･ｪ･▽ﾉ\"",
                    "꒰^ ⚆ᴥ⚆ ˆ꒱", "◖⚆ᴥ⚆◗", "(V●ᴥ●V)", "▼・ᴥ・▼", "U^ｪ^U", "૮₍ ˃̵ᴗ˂̵₎ა",
                    "૮₍ •ᴗ•₎ა", "૮₍ •᎔•₎ა", "૮₍ ◞‸◟₎ა", "૮ ⚆ﻌ⚆ა", "૮₍ꐦ -᷅ ⤙ -᷄ ₎ა", "૮ ꈍﻌ ꈍა",
                    "૮ ˆﻌˆ ა", "ʕ ꈍᴥꈍʔ", "ʕ•ᴥ•ʔ", "ʕ ᵔᴥᵔ ʔ", "ʕ•̫͡•ʔ*̫͡*ʔ-̫͡-ʔ", "꒰'ꀾ'꒱",
                    "ʕ⸝⸝⸝˙Ⱉ˙ʔ", "ʕ•ﻌ•ʔ", "ᖰ•ᴥ•ᖳ", "ʕ◍·̀Ⱉ·́◍ʔ", "ʕ•ɷ•ʔ", "ʕ´•ᴥ•`ʔ",
                    "(ᵒꈊᵒ᷅ )", "(՞•Ꙫ•՞)", "(⁰⊖⁰)", "₍ᐢ.ˬ.ᐢ₎", "εїз", "Ƹ̵Ӝ̵Ʒ",
                    "⋛⋋( ‘Θ’)⋌⋚", "くコ:彡", "̑̑ᗦ↞◃", "(:◎)≡", "˚ʚ₍ᐢ.  ̫.ᐢ₎ɞ˚", "₍ᐢ•༝•⑅ᐢ₎ദ⸒⸒",
                    "ପ₍ᐢ｡•༝•｡ᐢ₎ଓ ", "˚ʚ₍ ᐢ. ̫ .ᐢ ₎ɞ°", "₍ᐢ⑅•ᴗ•⑅ᐢ₎♡", "₍ᐢ •͈ ༝ •͈ ᐢ₎♡", "₍ᐢ..ᐢ₎", "(￣(エ)￣)",
                    "(●｀･(ｴ)･´●)", "┏((＝￣(ｴ)￣=))┛", "(ó㉨ò)", "<*)) >>=<", "≧〔゜゜〕≦", "( ´(00)`)",
                    "ヾ(；ﾟ(OO)ﾟ)ﾉ", "(❍ᴥ❍ʋ)", "／/( ◕‿‿◕ )＼", "(•ө•)", "( ఠൠఠ )ﾉ", "(◔⊖◔)つ",
                    "(o･e･)", "( ิ◕㉨◕ ิ)", "(ΦωΦ)", "(｡･㉨･｡)", "ก็ʕ•͡ᴥ•ʔ ก้", "( ﾟ Χ ﾟ)",
                    "(( へ(へ´∀`)へ", "(=´ω`=)", "ヽ(=^･ω･^=)丿", "( Φ ω Φ )", "ヾ(*ΦωΦ)ツ", "(´;;◉;⊖;◉;;｀)",
                    "(=´ᴥ`)", "Φ౪Φ", "ฅ●ω●ฅ", "(･8･)", "(=^-ω-^=)", "( ˊ̱˂˃ˋ̱ )",
                    "⧸⎩⎠⎞͏(・∀・)⎛͏⎝⎭⧹", "Ꮚ･ꈊ･Ꮚ", "ʕʘ̅͜ʘ̅ʔ", "(=^×^=)",
                    "_\n⠉⠛⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿\n⠀⠀⠀⠈⠛⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠛⠉⠁\n⣧⡀⠀⠀⠀⠀⠙⠿⠿⠿⠻⠿⠿⠟⠿⠛⠉⠀⠀⠀⠀⠀⣴\n⣿⣷⣄⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⣿\n⣿⣿⣿⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⣴⣿⣿⣿\n⣿⣿⡟⠀⠀⢰⣹⡆⠀⠀⠀⠀⠀⠀⣭⣷⠀⠀⠀⠸⣿⣿\n⣿⣿⠃⠀⠀⠈⠉⠀⠀⠤⠄⠀⠀⠀⠉⠁⠀⠀⠀⠀⢿⣿\n⣿⣿⢾⣿⣷⠀⠀⠀⠀⡠⠤⢄⠀⠀⠀⠠⣿⣿⣷⠀⢸⣿\n⣿⣿⡀⠉⠀⠀⠀⠀⠀⢄⠀⢀⠀⠀⠀⠀⠉⠉⠁⠀⠀⣿\n⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹"
                ]
            },
        ];

        /** 全部：DEFAULT_GROUPS 内所有表情汇总（虚拟标签，不落盘） */
        function getAllBuiltinEmotes() {
            return DEFAULT_GROUPS.reduce(function (acc, g) { return acc.concat(g.emotes); }, []);
        }

        /** 保留的 id：内建/固定标签使用的 id，用于从旧版 localStorage 数据里过滤掉残留的内建分组 */
        const RESERVED_GROUP_IDS = new Set(
            ['all', 'favorites', 'recent', 'default'].concat(DEFAULT_GROUPS.map(function (g) { return g.id; }))
        );

        // ────────────────────────────────── I18N ──────────────────────────────────
        function isZH() {
            try {
                return typeof TranslationLanguage !== 'undefined'
                && (TranslationLanguage === 'CN' || TranslationLanguage === 'TW');
            } catch (e) {
                return false;
            }
        }

        const I18N = {
            tabAll: { zh: '全部', en: 'All' },
            tabRecent: { zh: '常用', en: 'Recent' },
            tabFavorites: { zh: '收藏', en: 'Favorites' },
            groupHappy: { zh: '開心', en: 'Happy' },
            groupShy: { zh: '害羞', en: 'Shy' },
            groupSad: { zh: '生氣', en: 'Angry' },
            groupCry: { zh: '難過', en: 'Sad' },
            groupCat: { zh: '貓貓', en: 'Cats' },
            groupAnimals: { zh: '動物', en: 'Animals' },
            addToggleTooltip: { zh: '新增表情', en: 'Add emote' },
            addToggleTooltipCollapse: { zh: '收起新增表情', en: 'Hide add emote' },
            editTooltip: { zh: '编辑模式（删除表情，仅收藏/常用/自定义分组可用）', en: 'Edit mode (delete emotes, Favorites/Recent/custom groups only)' },
            editExitTooltip: { zh: '退出编辑', en: 'Exit edit mode' },
            collectTooltip: { zh: '收藏模式', en: 'Favorite mode' },
            collectExitTooltip: { zh: '退出收藏', en: 'Exit favorite mode' },
            helpTooltip: { zh: '使用说明', en: 'Help' },
            helpText: {
                zh: '使用说明：\n· 点击颜文字直接插入聊天框\n· 「全部」及内建分类（開心/生氣/難過/貓貓/動物）为只读，不可增删或排序\n· 点击右上角星标进入收藏模式，再点击表情即可收藏/取消收藏\n· 点击垃圾桶图标进入编辑模式，可删除收藏/常用/自定义分组里的表情\n· 自定义分组内可拖动表情调整顺序，点击「✚」展开新增表情输入框\n· 点击标签栏「+」可新建自定义分组',
                en: 'How to use:\n· Click a kaomoji to insert it into the chat box\n· "All" and the built-in categories (Happy/Angry/Sad/Cats/Animals) are read-only\n· Click the star icon to enter favorite mode, then click an emote to favorite/unfavorite it\n· Click the trash icon to enter edit mode and delete emotes from Favorites/Recent/custom groups\n· Emotes in custom groups can be drag-reordered; click "✚" to reveal the add-emote input\n· Click "+" in the tab bar to create a new custom group',
            },
            closeTooltip: { zh: '关闭', en: 'Close' },
            triggerLabel: { zh: '颜文字', en: 'Kaomoji' },
            deleteTooltip: { zh: '删除', en: 'Delete' },
            deleteGroupTooltip: { zh: '删除分组', en: 'Delete group' },
            newGroupTooltip: { zh: '新建分组', en: 'New group' },
            groupPrompt: { zh: '分组名称：', en: 'Group name:' },
            groupExistsAlert: { zh: '已存在同名分组', en: 'A group with this name already exists' },
            groupDeleteConfirm: { zh: '删除该分组及其表情？', en: 'Delete this group and its emotes?' },
            readonlyAddAlert: {
                zh: '当前为只读分类（全部/内建分类/收藏/常用），请切到自定义分组再添加（点击标签栏「+」新建）',
                en: 'This category is read-only (All/Built-in/Favorites/Recent). Switch to a custom group to add emotes (tap "+" in the tab bar to create one).',
            },
            addPlaceholder: { zh: '添加新表情...', en: 'Add a new emote...' },
            addBtn: { zh: '添加', en: 'Add' },
            autoSendLabel: { zh: '自动发送', en: 'Auto-send' },
            autoCloseLabel: { zh: '自动关闭', en: 'Auto-close' },
            resizeTooltip: { zh: '拖动调整高度', en: 'Drag to resize height' },
            toastMessage: {
                zh: '文字表情 v{VER} 已加载成功 | 插件在右下角，点击笑脸按钮展开面板',
                en: 'Kaomoji v{VER} loaded | Look for the smiley button at the bottom-right to open the panel',
            },
        };

        /** 内建分类 id → I18N key 的对照表，供 renderTabs 显示对应语言的分类名称 */
        const GROUP_NAME_KEYS = {
            g_happy: 'groupHappy', g_shy: 'groupShy', g_sad: 'groupSad',
            g_cry: 'groupCry', g_cat: 'groupCat', g_animals: 'groupAnimals',
        };

        function t(key) {
            var entry = I18N[key];
            if (!entry) return key;
            return isZH() ? entry.zh : entry.en;
        }

        // ────────────────────────────────── 状态 ──────────────────────────────────
        let panelEl = null;
        let panelVisible = false;
        // 以下带预设值的项目，登入后会由 initStorage() 用 DB 里的设定覆盖
        let groups = [];                       // 仅【自定义分组】 [{id,name,emotes:[string]}]
        let recentList = [];                   // [string] 最近使用（最新在前）
        let favSet = new Set();                // Set<string>
        let activeGroupId = 'all';
        let autoSend = false;
        let autoClose = false;                 // 点击表情后是否自动关闭面板
        let panelPos = { x: 0, y: 0 };         // 面板永远锚定在 chat-room-bot 顶部，X/宽度跟随 TextAreaChatLog
        let panelSize = { height: 520 };       // { height } —— 宽度不再持久化，始终跟随 TextAreaChatLog 实时宽度
        let _resizing = false;
        let _resizeStart = { y: 0, h: 0 };
        let _dragSrc = null;                  // 表情项拖动排序用（跟面板拖动无关，保留）
        let collectingMode = false;           // 收藏模式开关
        let _destroyed = false;               // 防止热更新时，旧实例仍在等待 bcModSdk 的异步注册在销毁后才完成

        // ────────────────────────────────── 存储 ──────────────────────────────────
        // 收藏/尺寸/自动发送/自动关闭/收合状态存 Player.ExtensionSettings（跟着帐号走），登入后才由伺服器送达，合并成 _data 一包。
        // 自訂分组(groups)与常用(recent)则只存 localStorage（跟装置走），独立于 DB，不受登入时序影响。
        const ES_KEY = 'Kaomoji';
        const RECENT_MAX = 30;   // 常用最多保存 30 个
        // 存 DB（跟帐号走）的项目。自訂分组(groups)与常用(recent)刻意只存 localStorage（跟装置走），
        // 故不在此列，也不会被 migrateFromLocalStorage 搬进 DB 或删掉。
        const LEGACY_KEYS = [
            ['favs',      STORAGE_FAVS],
            ['size',      STORAGE_SIZE],
            ['autoSend',  STORAGE_SEND],
            ['autoClose', STORAGE_AUTOCLOSE],
            ['collapse',  STORAGE_COLLAPSE],
        ];

        let _data = {};   // { groups, recent, favs, size, autoSend, autoClose, collapse }
        let _loaded = false;  // 设定确实从 DB 载入前，一律不落盘——否则会用空 _data 覆盖掉帐号里的真实资料

        // 等待 ExtensionSettings 由伺服器载入（最多 ~15 秒）
        function waitForExtensionSettings(timeout = 15000) {
            const start = Date.now();
            return new Promise(function (resolve) {
                const check = function () {
                    if (typeof Player !== 'undefined' && Player && Player.ExtensionSettings !== undefined) resolve(true);
                    else if (Date.now() - start > timeout) resolve(false);
                    else setTimeout(check, 200);
                };
                check();
            });
        }

        let _saveTimer = null;
        function saveData(immediate) {
            const doSave = function () {
                try {
                    if (!_loaded) return;  // 尚未从 DB 载入完成，不能存——避免空资料覆盖既有设定
                    if (typeof Player === 'undefined' || !Player) return;
                    if (!Player.ExtensionSettings) Player.ExtensionSettings = {};
                    Player.ExtensionSettings[ES_KEY] = JSON.stringify(_data);
                    if (typeof ServerPlayerExtensionSettingsSync === 'function') {
                        ServerPlayerExtensionSettingsSync(ES_KEY);
                    }
                } catch (e) { console.warn('🐈‍⬛ [Kaomoji] ❌ 设定储存失败:', e.message); }
            };
            if (immediate) { if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; } doSave(); return; }
            if (_saveTimer) clearTimeout(_saveTimer);
            _saveTimer = setTimeout(function () { _saveTimer = null; doSave(); }, 600);
        }

        // 自訂分组：只存 localStorage（跟装置走，不跟帐号）。旧版把它存进 DB，这里做一次性搬回。
        function loadGroups() {
            let raw = null;
            try { raw = localStorage.getItem(STORAGE_GROUPS); } catch (_) {}
            let g = null;
            if (raw !== null) {
                try { g = JSON.parse(raw); } catch (_) {}
            } else if (Array.isArray(_data.groups)) {
                // 旧版资料在 DB → 搬回 localStorage，并从 DB 清掉，避免两边不同步
                g = _data.groups;
                try { localStorage.setItem(STORAGE_GROUPS, JSON.stringify(g)); } catch (_) {}
                delete _data.groups; saveData(true);
            }
            // 过滤掉任何内建/固定标签 id 的残留数据（例如旧版的"默认"分组），只保留真正的自定义分组
            return Array.isArray(g) ? g.filter(function (grp) { return grp && grp.id && !RESERVED_GROUP_IDS.has(grp.id); }) : [];
        }
        function saveGroups() {
            try { localStorage.setItem(STORAGE_GROUPS, JSON.stringify(groups)); } catch (e) { console.warn('🐈‍⬛ [Kaomoji] ❌ 分组储存失败:', e.message); }
        }
        // 常用：只存 localStorage，最多 RECENT_MAX 个。旧版存进 DB，这里做一次性搬回。
        function loadRecent() {
            let raw = null;
            try { raw = localStorage.getItem(STORAGE_RECENT); } catch (_) {}
            if (raw !== null) {
                try { const r = JSON.parse(raw); if (Array.isArray(r)) return r.slice(0, RECENT_MAX); } catch (_) {}
                return [];
            }
            if (Array.isArray(_data.recent)) {
                const r = _data.recent.slice(0, RECENT_MAX);
                try { localStorage.setItem(STORAGE_RECENT, JSON.stringify(r)); } catch (_) {}
                delete _data.recent; saveData(true);
                return r;
            }
            return [];
        }
        function saveRecent() {
            try { localStorage.setItem(STORAGE_RECENT, JSON.stringify(recentList.slice(0, RECENT_MAX))); } catch (e) { console.warn('🐈‍⬛ [Kaomoji] ❌ 常用储存失败:', e.message); }
        }
        function loadFavs() {
            return new Set(Array.isArray(_data.favs) ? _data.favs : []);
        }
        function saveFavs() { _data.favs = [...favSet]; saveData(); }
        function loadSize() {
            const s = _data.size;
            if (s && typeof s.height === 'number') return { height: s.height };
            return { height: 520 };
        }
        function saveSize() { _data.size = { height: panelSize.height }; saveData(); }
        function loadAutoSend() {
            return typeof _data.autoSend === 'boolean' ? _data.autoSend : false;
        }
        function saveAutoSend() { _data.autoSend = autoSend; saveData(); }
        function loadAutoClose() {
            return typeof _data.autoClose === 'boolean' ? _data.autoClose : false;
        }
        function saveAutoClose() { _data.autoClose = autoClose; saveData(); }
        function loadChatButtonsCollapseState() {
            const s = _data.collapse;
            return (s === 'true' || s === 'false') ? s : null;
        }
        function saveChatButtonsCollapseState(value) { _data.collapse = value; saveData(); }

        /** 一次性搬移：旧的七个 localStorage key 读进来写入 DB，成功后删除原本的 key */
        function migrateFromLocalStorage() {
            let moved = false;
            for (const [field, lsKey] of LEGACY_KEYS) {
                let s = null;
                try { s = localStorage.getItem(lsKey); } catch (_) { continue; }
                if (s === null) continue;
                try {
                    // collapse 存的是裸字串 'true'/'false'，其余是 JSON
                    _data[field] = (field === 'collapse') ? s : JSON.parse(s);
                    moved = true;
                } catch (_) {}
            }
            if (!moved) return;

            saveData(true);
            if (Player && Player.ExtensionSettings && Player.ExtensionSettings[ES_KEY] !== undefined) {
                for (const [, lsKey] of LEGACY_KEYS) {
                    try { localStorage.removeItem(lsKey); } catch (_) {}
                }
                console.log('🐈‍⬛ [Kaomoji] ✅ 设定已从 localStorage 搬移至 DB');
            }
        }

        /** 设定是登入后才进来的，载入完要把解析时抓到的预设值覆盖掉 */
        async function initStorage() {
            // 一直等到伺服器把 ExtensionSettings 送来才继续（在登入画面逗留超过 15 秒也不会放弃，
            // 否则会带着空 _data 跑一整个 session，一存档就把帐号里的真实资料清空）。
            while (!(await waitForExtensionSettings())) { /* keep waiting until login delivers settings */ }

            let blob = null;
            try {
                const raw = Player?.ExtensionSettings?.[ES_KEY];
                if (raw !== undefined) {
                    const o = typeof raw === 'object' ? raw : JSON.parse(raw);
                    if (o && typeof o === 'object') blob = o;
                }
            } catch (e) { console.warn('🐈‍⬛ [Kaomoji] ❌ 设定读取失败，使用预设:', e.message); }

            _loaded = true;  // 已确认 ExtensionSettings 可用并读取完毕，此后 saveData 才允许落盘
            if (blob) _data = blob;
            else migrateFromLocalStorage();

            groups     = loadGroups();
            recentList = loadRecent();
            favSet     = loadFavs();
            autoSend   = loadAutoSend();
            autoClose  = loadAutoClose();
            panelSize  = loadSize();
            if (panelVisible) { renderTabs(); renderGrid(); }
        }
        initStorage();

        /*
         * 面板锚点：X 与宽度参考 BC 自身对 TextAreaChatLog 的 DOM 处理方式 —— 直接读取其
         * 实时 getBoundingClientRect()，而不是写死像素值，这样不同分辨率/字体大小下都能保持一致。
         * 高度仍然由用户拖动调整（并持久化），纵向锚定在 chat-room-bot 顶部向上展开，且不超过
         * TextAreaChatLog 自身的可视范围（顶部不高于聊天记录框顶部）。
         */
        function computeAnchorPos(h) {
            h = h || panelSize.height;
            var chatLog = document.getElementById('TextAreaChatLog');
            var bot = document.getElementById('chat-room-bot');

            var x, w;
            if (chatLog) {
                var logRect = chatLog.getBoundingClientRect();
                x = logRect.left;
                w = logRect.width;
            } else {
                w = 360;
                x = window.innerWidth - w - 16;
            }

            var topRef = bot ? bot.getBoundingClientRect().top : (chatLog ? chatLog.getBoundingClientRect().bottom : window.innerHeight - 90);

            // 限制高度不超过 TextAreaChatLog 的可用范围（聊天记录框顶部 ~ 输入框顶部之间）
            var logTop = chatLog ? chatLog.getBoundingClientRect().top : 8;
            var maxH = Math.max(160, topRef - logTop - 8);
            if (h > maxH) h = maxH;

            var y = topRef - h - 8;
            if (y < 8) y = 8;

            var maxX = window.innerWidth - w - 8;
            if (x > maxX) x = maxX;
            if (x < 8) x = 8;

            return { x: x, y: y, w: w, h: h };
        }

        /** 若面板正打开，则让其位置/宽度/高度重新贴齐 TextAreaChatLog（供 resize 事件与轮询调用） */
        function repositionPanel() {
            if (!panelVisible || !panelEl) return;
            var p = computeAnchorPos();
            panelPos.x = p.x;
            panelPos.y = p.y;
            panelEl.style.left = p.x + 'px';
            panelEl.style.top = p.y + 'px';
            panelEl.style.width = p.w + 'px';
            panelEl.style.height = p.h + 'px';
        }

        function isChatRoom() {
            return typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom';
        }

        // ────────────────────────────────── 分组/收藏/常用 辅助 ──────────────────────────────────
        /** 仅返回自定义分组（不含内建/固定标签） */
        function getActiveCustomGroup() {
            return groups.find(function (g) { return g.id === activeGroupId; }) || null;
        }
        /** 当前激活的标签是否为「可编辑」（收藏/常用/自定义分组），全部与内建分类均为只读 */
        function isActiveGroupEditable() {
            return activeGroupId === 'favorites' || activeGroupId === 'recent' || !!getActiveCustomGroup();
        }
        /** 当前激活的标签是否为「自定义分组」（支持增删/拖动排序） */
        function isActiveGroupCustom() {
            return !!getActiveCustomGroup();
        }
        function getActiveEmotes() {
            if (activeGroupId === 'all') return getAllBuiltinEmotes();
            if (activeGroupId === 'favorites') return [...favSet];
            if (activeGroupId === 'recent') return recentList.slice(0, RECENT_MAX);
            var def = DEFAULT_GROUPS.find(function (g) { return g.id === activeGroupId; });
            if (def) return def.emotes;
            var custom = getActiveCustomGroup();
            return custom ? custom.emotes : [];
        }
        function recordRecent(text) {
            recentList = recentList.filter(t => t !== text);
            recentList.unshift(text);
            if (recentList.length > RECENT_MAX) recentList.length = RECENT_MAX;
            saveRecent();
        }
        function toggleFav(text) {
            if (favSet.has(text)) favSet.delete(text);
            else favSet.add(text);
            saveFavs();
        }
        function deleteEmote(text) {
            if (activeGroupId === 'favorites') { favSet.delete(text); saveFavs(); return; }
            if (activeGroupId === 'recent') { recentList = recentList.filter(t => t !== text); saveRecent(); return; }
            var g = getActiveCustomGroup();
            if (!g) return; // 全部 / 内建分类为只读，无法删除
            var i = g.emotes.indexOf(text);
            if (i >= 0) g.emotes.splice(i, 1);
            saveGroups();
        }
        function addGroup() {
            const name = (window.prompt(t('groupPrompt')) || '').trim();
            if (!name) return;
            if (groups.some(g => g.name === name)) { window.alert(t('groupExistsAlert')); return; }
            const g = { id: 'g' + Date.now(), name: name, emotes: [] };
            groups.push(g);
            saveGroups();
            activeGroupId = g.id;
            renderTabs();
            renderGrid();
        }
        function deleteGroup(id) {
            if (!window.confirm(t('groupDeleteConfirm'))) return;
            groups = groups.filter(g => g.id !== id);
            saveGroups();
            if (activeGroupId === id) activeGroupId = 'all';
            renderTabs();
            renderGrid();
        }

        // ────────────────────────────────── SVG 图标 ──────────────────────────────────
        const SVG_ICON = {
            face: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="currentColor"><path d="M512 0C229.7 0 0 229.7 0 512s229.7 512 512 512 512-229.7 512-512S794.3 0 512 0z m0 952.6C269.1 952.6 71.4 754.9 71.4 512S269.1 71.4 512 71.4 952.6 269.1 952.6 512 754.9 952.6 512 952.6z"/><path d="M255.60483 411.159939a59.5 59.5 0 1 0 84.144238-84.147175 59.5 59.5 0 1 0-84.144238 84.147175Z"/><path d="M684.216818 411.198881a59.5 59.5 0 1 0 84.144239-84.147175 59.5 59.5 0 1 0-84.144239 84.147175Z"/><path d="M650.8 563.1c-14.2 13.7-14.5 36.3-0.8 50.5 10.9 11.2 16.8 26 16.8 41.6 0 15.9-6.3 30.8-17.5 42s-26.1 17.3-42 17.3h-0.2c-15.9 0-30.8-6.3-42-17.5-11.2-11.3-17.4-26.2-17.3-42.1v-23.8c0-19.7-16-35.7-35.7-35.7s-35.7 16-35.7 35.7v23.8c0 15.6-5.9 30.3-16.8 41.6-11.1 11.4-25.9 17.9-41.8 18.1-15.2-0.4-30.9-5.7-42.4-16.8-23.6-22.8-24.2-60.6-1.3-84.2 13.7-14.2 13.4-36.8-0.8-50.5s-36.8-13.4-50.5 0.8c-50.3 51.9-49 135 2.9 185.2 24.6 23.9 56.9 37 91.1 37h2.1c35-0.6 67.7-14.7 92-39.8 0.4-0.4 0.8-0.8 1.2-1.3 0.8 0.9 1.6 1.7 2.4 2.5 24.7 24.8 57.5 38.5 92.5 38.6h0.3c34.9 0 67.7-13.5 92.4-38.1 24.8-24.7 38.5-57.5 38.6-92.5 0.1-34.3-13-66.8-36.9-91.5-13.8-14.3-36.4-14.6-50.6-0.9z"/></svg>',
            add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
            close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
            trash: '<svg viewBox="0 0 1024 1024" fill="currentColor" style="width:14px;height:14px;display:block;fill:currentColor !important;stroke:none !important;"><path d="M106.666667 213.333333h810.666666v42.666667H106.666667z"/><path d="M640 128v42.666667h42.666667V128c0-23.573333-19.093333-42.666667-42.538667-42.666667H383.872A42.496 42.496 0 0 0 341.333333 128v42.666667h42.666667V128h256z"/><path d="M213.333333 896V256H170.666667v639.957333C170.666667 919.552 189.653333 938.666667 213.376 938.666667h597.248C834.218667 938.666667 853.333333 919.68 853.333333 895.957333V256h-42.666666v640H213.333333z"/><path d="M320 341.333333h42.666667v384h-42.666667zM490.666667 341.333333h42.666666v384h-42.666666zM661.333333 341.333333h42.666667v384h-42.666667z"/></svg>',
            star: '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 7.1-1.01z"/></svg>',
            starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 7.1-1.01z"/></svg>',
        };

        // 笑脸 mask 用 SVG（用于原生按钮图标，与聊天框风格一致）
        const FACE_MASK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path d="M512 0C229.7 0 0 229.7 0 512s229.7 512 512 512 512-229.7 512-512S794.3 0 512 0z m0 952.6C269.1 952.6 71.4 754.9 71.4 512S269.1 71.4 512 71.4 952.6 269.1 952.6 512 754.9 952.6 512 952.6z"/><path d="M255.60483 411.159939a59.5 59.5 0 1 0 84.144238-84.147175 59.5 59.5 0 1 0-84.144238 84.147175Z"/><path d="M684.216818 411.198881a59.5 59.5 0 1 0 84.144239-84.147175 59.5 59.5 0 1 0-84.144239 84.147175Z"/><path d="M650.8 563.1c-14.2 13.7-14.5 36.3-0.8 50.5 10.9 11.2 16.8 26 16.8 41.6 0 15.9-6.3 30.8-17.5 42s-26.1 17.3-42 17.3h-0.2c-15.9 0-30.8-6.3-42-17.5-11.2-11.3-17.4-26.2-17.3-42.1v-23.8c0-19.7-16-35.7-35.7-35.7s-35.7 16-35.7 35.7v23.8c0 15.6-5.9 30.3-16.8 41.6-11.1 11.4-25.9 17.9-41.8 18.1-15.2-0.4-30.9-5.7-42.4-16.8-23.6-22.8-24.2-60.6-1.3-84.2 13.7-14.2 13.4-36.8-0.8-50.5s-36.8-13.4-50.5 0.8c-50.3 51.9-49 135 2.9 185.2 24.6 23.9 56.9 37 91.1 37h2.1c35-0.6 67.7-14.7 92-39.8 0.4-0.4 0.8-0.8 1.2-1.3 0.8 0.9 1.6 1.7 2.4 2.5 24.7 24.8 57.5 38.5 92.5 38.6h0.3c34.9 0 67.7-13.5 92.4-38.1 24.8-24.7 38.5-57.5 38.6-92.5 0.1-34.3-13-66.8-36.9-91.5-13.8-14.3-36.4-14.6-50.6-0.9z"/></svg>';

        function injectPanelStyles() {
            if (document.getElementById('lk-kaomoji-panel-style')) return;
            var style = document.createElement('style');
            style.id = 'lk-kaomoji-panel-style';
            style.textContent = [
                '#lk-kaomoji-panel{',
                '  background:rgba(12,16,26,0.97);',
                '  border:1px solid rgba(255,255,255,0.08);',
                '  border-radius:20px;',
                '  box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.04),inset 0 1px 0 rgba(255,255,255,0.06);',
                '  backdrop-filter:blur(28px) saturate(1.4);',
                '  min-width:200px;min-height:160px;max-height:640px;',
                '  overflow:hidden;',
                '  -webkit-user-select:none;',
                '  -moz-user-select:none;',
                '  -ms-user-select:none;',
                '}',
                '#lk-kaomoji-panel.visible{',
                '  opacity:1;',
                '  transform:translateY(0);',
                '}',
                '.lk-km-header{',
                '  display:flex;align-items:center;gap:8px;',
                '  padding:8px 10px;',
                '  background:linear-gradient(135deg,#7631ce 0%,#3f1458 100%);',
                '  border-radius:20px 20px 0 0;',
                '  user-select:none;',
                '  box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.2);',
                '}',
                '.lk-km-header-title{',
                '  flex:1;',
                '  color:#e0d0ff;font-size:15px;font-weight:600;letter-spacing:0.5px;',
                '}',
                '.lk-km-header svg{width:16px;height:16px;stroke:#e0d0ff;fill:none;stroke-width:2;stroke-linecap:round;}',
                '.lk-km-header-title-icon{fill:#e0d0ff !important;stroke:none !important;}',
                '.lk-km-btn{',
                '  background:none;border:none;cursor:pointer;padding:2px;color:#e0d0ff;',
                '  display:flex;align-items:center;justify-content:center;',
                '  border-radius:6px;transition:background 0.15s;',
                '  min-width:20px;min-height:20px;',
                '}',
                '.lk-km-btn:hover{background:rgba(255,255,255,0.1);}',
                '.lk-km-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;}',
                '.lk-km-help-btn{font-size:15px;font-weight:700;line-height:1;}',
                '.lk-km-add-toggle-btn svg{stroke:currentColor;}',
                /* 分组标签栏 */
                '.lk-km-tabs{',
                '  display:flex;align-items:center;gap:4px;',
                '  box-sizing:border-box;',
                '  padding:6px 8px;height:38px;flex:0 0 38px;',
                '  overflow-x:auto;overflow-y:hidden;scrollbar-width:none;',
                '  border-bottom:1px solid rgba(255,255,255,0.06);',
                '}',
                '.lk-km-tabs::-webkit-scrollbar{display:none;}',
                '.lk-km-tab{',
                '  flex:0 0 auto;padding:4px 10px;font-size:13px;color:#b8c8e0;',
                '  background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);',
                '  border-radius:10px;cursor:pointer;user-select:none;white-space:nowrap;',
                '  display:flex;align-items:center;gap:4px;transition:background 0.15s;',
                '}',
                '.lk-km-tab:hover{background:rgba(139,45,196,0.18);}',
                '.lk-km-tab.active{background:rgba(139,45,196,0.4);color:#fff;border-color:rgba(139,45,196,0.55);}',
                '.lk-km-tab-del{color:#ff9a9a;font-size:13px;line-height:1;cursor:pointer;opacity:0.6;}',
                '.lk-km-tab-del:hover{opacity:1;color:#ff6a6a;}',
                '.lk-km-tab-add{',
                '  flex:0 0 auto;width:24px;height:24px;display:flex;align-items:center;justify-content:center;',
                '  font-size:16px;color:#e0d0ff;background:rgba(255,255,255,0.05);',
                '  border:1px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer;',
                '}',
                '.lk-km-tab-add:hover{background:rgba(139,45,196,0.25);}',
                '.lk-km-grid-wrap{',
                '  padding:8px;flex:1 1 auto;min-height:0;overflow-y:auto;',
                '  scrollbar-width:thin;scrollbar-color:#8b2dc459 transparent;',
                '  container-type:inline-size;',
                '}',
                '.lk-km-grid-wrap::-webkit-scrollbar{width:4px;}',
                '.lk-km-grid-wrap::-webkit-scrollbar-thumb{background:#8b2dc459;border-radius:2px;}',
                /* 动态列数：以 auto-fill + minmax 让列数随容器宽度自动增减，每列最小 100px。 */
                '.lk-km-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:4px;}',
                '.lk-km-item{',
                '  position:relative;',
                '  display:flex;align-items:center;justify-content:center;',
                '  padding:4px 2px;min-height:32px;',
                '  background:rgba(255,255,255,0.04);',
                '  border:1px solid rgba(255,255,255,0.06);',
                '  border-radius:8px;',
                '  cursor:pointer;user-select:none;',
                '  font-size:18px;color:#dde8f8;',
                '  transition:background 0.15s,border-color 0.15s,transform 0.1s;',
                '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
                '}',
                '.lk-km-item:hover{',
                '  background:rgba(139,45,196,0.15);border-color:rgba(139,45,196,0.3);transform:scale(1.05);',
                '}',
                '.lk-km-item:active{transform:scale(0.95);}',
                '.lk-km-item.dragging{opacity:0.4;}',
                /* 收藏模式星标（仅收藏模式显示） */
                '.lk-km-collect-badge{',
                '  position:absolute;top:-6px;right:-6px;width:20px;height:20px;',
                '  border-radius:50%;cursor:pointer;',
                '  display:none;align-items:center;justify-content:center;',
                '  padding:0;font-size:15px;line-height:1;',
                '}',
                '.lk-km-collect-badge svg{width:12px;height:12px;}',
                '.lk-km-collect-badge.off{background:rgba(255,255,255,0.12);color:#b8c8e0;}',
                '.lk-km-collect-badge.off svg{fill:none;stroke:currentColor;stroke-width:1.8;}',
                '.lk-km-collect-badge.on{background:#ffd24a;color:#5a3d00;}',
                '.lk-km-collect-badge.on svg{fill:currentColor;stroke:none;}',
                '#lk-kaomoji-panel.collecting .lk-km-collect-badge{display:flex;}',
                '#lk-kaomoji-panel.collecting .lk-km-item{',
                '  border-color:rgba(255,210,74,0.2);',
                '}',
                '#lk-kaomoji-panel.collecting .lk-km-item.faved{',
                '  background:rgba(255,210,74,0.12);border-color:rgba(255,210,74,0.4);',
                '}',
                /* 删除按钮（编辑模式，仅可编辑分组会渲染） */
                '.lk-km-item .lk-km-del{',
                '  position:absolute;top:-6px;right:-6px;width:20px;height:20px;',
                '  background:#c42d2d;border-radius:50%;cursor:pointer;',
                '  display:none;align-items:center;justify-content:center;',
                '  padding:0;font-size:16px;line-height:1;color:#fff;font-weight:400;',
                '}',
                '#lk-kaomoji-panel.editing .lk-km-item{',
                '  border-color:rgba(196,45,45,0.3);',
                '}',
                '#lk-kaomoji-panel.editing .lk-km-del{display:flex;}',
                /* 底部工具列（自动发送开关）整体靠最右侧对齐 */
                '.lk-km-footer{',
                '  display:flex;align-items:center;justify-content:flex-end;gap:10px;',
                '  padding:6px 12px;border-top:1px solid rgba(255,255,255,0.06);',
                '}',

                '.lk-km-auto-label{color:#b8c8e0;font-size:13px;}',
                '.lk-km-toggle{',
                '  position:relative;width:32px;height:18px;',
                '  background:rgba(255,255,255,0.1);border-radius:9px;cursor:pointer;',
                '  transition:background 0.25s;',
                '}',
                '.lk-km-toggle.on{background:#8b2dc4;box-shadow:0 0 8px rgba(139,45,196,0.5);}',
                '.lk-km-toggle-knob{',
                '  position:absolute;left:2px;top:2px;width:14px;height:14px;',
                '  background:linear-gradient(135deg,#fff,#e0d0ff);border-radius:7px;',
                '  transition:left 0.25s cubic-bezier(0.4,0,0.2,1);',
                '  box-shadow:0 1px 3px rgba(0,0,0,0.3);',
                '}',
                '.lk-km-toggle.on .lk-km-toggle-knob{left:16px;}',
                /* 新增表情输入区：默认收纳，点击 header 上的 ✚ 按钮后才显示 */
                '.lk-km-add-area{',
                '  display:none;',
                '  align-items:center;gap:4px;',
                '  padding:4px 12px 8px;',
                '}',
                '#lk-kaomoji-panel.showing-add .lk-km-add-area{display:flex;}',
                '.lk-km-add-input{',
                '  flex:1;padding:4px 8px;font-size:14px;color:#dde8f8;',
                '  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);',
                '  border-radius:8px;outline:none;',
                '  transition:border-color 0.15s;',
                '}',
                '.lk-km-add-input:focus{border-color:rgba(139,45,196,0.5);}',
                '.lk-km-add-input::placeholder{color:#6a8ab0;}',
                '.lk-km-add-btn{',
                '  background:#8b2dc4;border:none;cursor:pointer;padding:4px 8px;',
                '  border-radius:8px;color:#fff;font-size:13px;font-weight:600;',
                '  transition:background 0.15s;',
                '}',
                '.lk-km-add-btn:hover{background:#a060e0;}',
                '.lk-km-resize{',
                '  position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:ns-resize;',
                '  display:flex;align-items:flex-end;justify-content:flex-end;',
                '  padding:0 3px 3px 0;',
                '  opacity:0.35;transition:opacity 0.15s;',
                '}',
                '.lk-km-resize:hover{opacity:0.85;}',
                '.lk-km-resize svg{width:10px;height:10px;fill:#a080d0;stroke:none;}',
                '.lk-km-resize-corner{',
                '  width:0;height:0;',
                '  border-style:solid;',
                '  border-width:0 0 10px 10px;',
                '  border-color:transparent transparent #a080d0 transparent;',
                '}',
            ].join('\n');
            document.head.appendChild(style);
        }

        function insertToChat(text) {
            if (typeof ElementValue !== 'function') return;
            var current = ElementValue('InputChat') || '';
            if (current.length > 0 && !current.endsWith(' ')) current += ' ';
            ElementValue('InputChat', current + text);
            var input = document.getElementById('InputChat');
            if (input) input.focus();
            if (autoSend && typeof ChatRoomSendChat === 'function') {
                ChatRoomSendChat();
            }
            recordRecent(text);
            if (autoClose) closePanel();
        }

        function createPanel() {
            // 若已存在但被移出文档（热更新/页面重渲染导致），则重建，避免点击无反应
            if (panelEl && panelEl.isConnected) return panelEl;
            panelEl = null;

            injectPanelStyles();

            var initPos = computeAnchorPos();
            panelPos.x = initPos.x;
            panelPos.y = initPos.y;

            var panel = document.createElement('div');
            panel.id = 'lk-kaomoji-panel';
            panel.style.cssText = [
                'position:fixed',
                'left:' + panelPos.x + 'px',
                'top:' + panelPos.y + 'px',
                'width:' + initPos.w + 'px',
                'height:' + initPos.h + 'px',
                'display:flex',
                'flex-direction:column',
                'z-index:2',
                'font-family:"Segoe UI",system-ui,sans-serif',
                'pointer-events:auto',
                'opacity:0',
                'transform:translateY(24px)',
                'transition:opacity 0.22s ease,transform 0.22s ease',
            ].join(';');

            var header = document.createElement('div');
            header.className = 'lk-km-header';
            var titleSvg = document.createElement('span');
            titleSvg.className = 'lk-km-header-title-icon';
            titleSvg.innerHTML = SVG_ICON.face;
            var title = document.createElement('span');
            title.className = 'lk-km-header-title';
            title.textContent = 'Kaomoji';

            var addToggleBtn = document.createElement('button');
            addToggleBtn.className = 'lk-km-btn lk-km-add-toggle-btn';
            addToggleBtn.innerHTML = SVG_ICON.add;
            addToggleBtn.title = t('addToggleTooltip');
            addToggleBtn.addEventListener('click', function () {
                panelEl.classList.toggle('showing-add');
                var showing = panelEl.classList.contains('showing-add');
                addToggleBtn.style.color = showing ? '#a060e0' : '';
                addToggleBtn.title = showing ? t('addToggleTooltipCollapse') : t('addToggleTooltip');
            });

            var editBtn = document.createElement('button');
            editBtn.className = 'lk-km-btn lk-km-edit-btn';
            editBtn.innerHTML = SVG_ICON.trash;
            editBtn.title = t('editTooltip');
            editBtn.addEventListener('click', function () {
                if (panelEl.classList.contains('editing')) {
                    exitEditing();
                } else {
                    exitCollecting();
                    panelEl.classList.add('editing');
                    editBtn.innerHTML = SVG_ICON.close;
                    editBtn.title = t('editExitTooltip');
                    editBtn.style.color = '#c42d2d';
                }
            });

            var collectBtn = document.createElement('button');
            collectBtn.className = 'lk-km-btn lk-km-collect-btn';
            collectBtn.innerHTML = SVG_ICON.starOutline;
            collectBtn.title = t('collectTooltip');
            collectBtn.addEventListener('click', function () {
                if (panelEl.classList.contains('collecting')) {
                    exitCollecting();
                } else {
                    exitEditing();
                    panelEl.classList.add('collecting');
                    collectBtn.innerHTML = SVG_ICON.star;
                    collectBtn.title = t('collectExitTooltip');
                    collectBtn.style.color = '#ffd24a';
                }
                renderGrid();
            });

            var helpBtn = document.createElement('button');
            helpBtn.className = 'lk-km-btn lk-km-help-btn';
            helpBtn.textContent = '?';
            helpBtn.title = t('helpTooltip');
            helpBtn.addEventListener('click', function () {
                window.alert(t('helpText'));
            });

            var closeBtn = document.createElement('button');
            closeBtn.className = 'lk-km-btn lk-km-close-btn';
            closeBtn.innerHTML = SVG_ICON.close;
            closeBtn.title = t('closeTooltip');
            closeBtn.addEventListener('click', function () { togglePanel(); });

            header.appendChild(titleSvg);
            header.appendChild(title);
            header.appendChild(addToggleBtn);
            header.appendChild(editBtn);
            header.appendChild(collectBtn);
            header.appendChild(helpBtn);
            header.appendChild(closeBtn);

            // 分组标签栏
            var tabsBar = document.createElement('div');
            tabsBar.className = 'lk-km-tabs';

            var gridWrap = document.createElement('div');
            gridWrap.className = 'lk-km-grid-wrap';
            var grid = document.createElement('div');
            grid.className = 'lk-km-grid';
            gridWrap.appendChild(grid);

            var footer = document.createElement('div');
            footer.className = 'lk-km-footer';

            var autoCloseLabel = document.createElement('span');
            autoCloseLabel.className = 'lk-km-auto-label';
            autoCloseLabel.textContent = t('autoCloseLabel');

            var autoCloseToggle = document.createElement('div');
            autoCloseToggle.className = 'lk-km-toggle' + (autoClose ? ' on' : '');
            var autoCloseKnob = document.createElement('div');
            autoCloseKnob.className = 'lk-km-toggle-knob';
            autoCloseToggle.appendChild(autoCloseKnob);
            autoCloseToggle.addEventListener('click', function () {
                autoClose = !autoClose;
                saveAutoClose();
                autoCloseToggle.classList.toggle('on', autoClose);
            });

            var autoLabel = document.createElement('span');
            autoLabel.className = 'lk-km-auto-label';
            autoLabel.textContent = t('autoSendLabel');

            var toggle = document.createElement('div');
            toggle.className = 'lk-km-toggle' + (autoSend ? ' on' : '');
            var knob = document.createElement('div');
            knob.className = 'lk-km-toggle-knob';
            toggle.appendChild(knob);
            toggle.addEventListener('click', function () {
                autoSend = !autoSend;
                saveAutoSend();
                toggle.classList.toggle('on', autoSend);
            });
            footer.appendChild(autoCloseLabel);
            footer.appendChild(autoCloseToggle);
            footer.appendChild(autoLabel);
            footer.appendChild(toggle);

            var addArea = document.createElement('div');
            addArea.className = 'lk-km-add-area';
            var addInput = document.createElement('input');
            addInput.className = 'lk-km-add-input';
            addInput.placeholder = t('addPlaceholder');
            addInput.maxLength = 30;
            var addBtn = document.createElement('button');
            addBtn.className = 'lk-km-add-btn';
            addBtn.textContent = t('addBtn');
            addBtn.addEventListener('click', function () {
                var val = addInput.value.trim();
                if (!val) return;
                var g = getActiveCustomGroup();
                if (!g) {
                    window.alert(t('readonlyAddAlert'));
                    return;
                }
                if (g.emotes.includes(val)) return;
                g.emotes.push(val);
                saveGroups();
                renderGrid();
                addInput.value = '';
            });
            addInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') addBtn.click();
            });
            addArea.appendChild(addInput);
            addArea.appendChild(addBtn);

            panel.appendChild(header);
            panel.appendChild(tabsBar);
            panel.appendChild(gridWrap);
            panel.appendChild(footer);
            panel.appendChild(addArea);

            var resizeHandle = document.createElement('div');
            resizeHandle.className = 'lk-km-resize';
            resizeHandle.title = t('resizeTooltip');
            resizeHandle.innerHTML = '<div class="lk-km-resize-corner"></div>';
            resizeHandle.addEventListener('mousedown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                _resizing = true;
                _resizeStart.y = e.clientY;
                _resizeStart.h = panel.offsetHeight;
            });
            panel.appendChild(resizeHandle);

            document.body.appendChild(panel);
            panelEl = panel;

            renderTabs();
            renderGrid();
            return panel;
        }

        function exitEditing() {
            if (!panelEl) return;
            panelEl.classList.remove('editing');
            var editBtn = panelEl.querySelector('.lk-km-edit-btn');
            if (editBtn) {
                editBtn.innerHTML = SVG_ICON.trash;
                editBtn.title = t('editTooltip');
                editBtn.style.color = '';
            }
        }

        function exitCollecting() {
            if (!panelEl) return;
            panelEl.classList.remove('collecting');
            var collectBtn = panelEl.querySelector('.lk-km-collect-btn');
            if (collectBtn) {
                collectBtn.innerHTML = SVG_ICON.starOutline;
                collectBtn.title = t('collectTooltip');
                collectBtn.style.color = '';
            }
        }

        function renderTabs() {
            if (!panelEl) return;
            var tabsBar = panelEl.querySelector('.lk-km-tabs');
            if (!tabsBar) return;
            tabsBar.innerHTML = '';

            // 固定标签：全部 / 常用 / 收藏
            var fixed = [
                { id: 'all', name: t('tabAll') },
                { id: 'recent', name: t('tabRecent') },
                { id: 'favorites', name: t('tabFavorites') },
            ];
            // 内建分类标签（只读，来自 DEFAULT_GROUPS，名称透过 GROUP_NAME_KEYS 转换为当前语言）
            var builtin = DEFAULT_GROUPS.map(function (g) { return { id: g.id, name: t(GROUP_NAME_KEYS[g.id]) }; });
            // 自定义分组标签（可删除，名称为使用者自订，不做翻译）
            var custom = groups.map(function (g) { return { id: g.id, name: g.name, custom: true }; });

            fixed.concat(builtin).concat(custom).forEach(function (tabInfo) {
                var tab = document.createElement('div');
                tab.className = 'lk-km-tab' + (tabInfo.id === activeGroupId ? ' active' : '');
                tab.textContent = tabInfo.name;
                tab.addEventListener('click', function () {
                    activeGroupId = tabInfo.id;
                    exitEditing();
                    exitCollecting();
                    renderTabs();
                    renderGrid();
                });
                if (tabInfo.custom) {
                    var x = document.createElement('span');
                    x.className = 'lk-km-tab-del';
                    x.textContent = '×';
                    x.title = t('deleteGroupTooltip');
                    x.addEventListener('click', function (e) {
                        e.stopPropagation();
                        deleteGroup(tabInfo.id);
                    });
                    tab.appendChild(x);
                }
                tabsBar.appendChild(tab);
            });

            var add = document.createElement('div');
            add.className = 'lk-km-tab-add';
            add.textContent = '+';
            add.title = t('newGroupTooltip');
            add.addEventListener('click', addGroup);
            tabsBar.appendChild(add);
        }

        function renderGrid() {
            if (!panelEl) return;
            var grid = panelEl.querySelector('.lk-km-grid');
            if (!grid) return;
            grid.innerHTML = '';
            var emotes = getActiveEmotes();
            var isCustomView = isActiveGroupCustom();
            var isEditableView = isActiveGroupEditable(); // 收藏/常用/自定义分组可编辑；全部与内建分类只读
            var isEditing = panelEl.classList.contains('editing');
            var isCollecting = panelEl.classList.contains('collecting');
            var canReorder = isCustomView && !isEditing && !isCollecting;

            emotes.forEach(function (text) {
                var item = document.createElement('div');
                item.className = 'lk-km-item' + (favSet.has(text) ? ' faved' : '');
                item.textContent = text;
                item.title = text;
                item.draggable = canReorder;

                var badge = document.createElement('span');
                var faved = favSet.has(text);
                badge.className = 'lk-km-collect-badge ' + (faved ? 'on' : 'off');
                badge.innerHTML = SVG_ICON.star;
                item.appendChild(badge);

                item.addEventListener('click', function (e) {
                    if (isEditing) return;
                    if (isCollecting) {
                        toggleFav(text);
                        renderGrid();
                        return;
                    }
                    insertToChat(text);
                });

                if (isEditableView) {
                    var delBtn = document.createElement('span');
                    delBtn.className = 'lk-km-del';
                    delBtn.textContent = '×';
                    delBtn.title = t('deleteTooltip');
                    delBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        deleteEmote(text);
                        renderGrid();
                    });
                    item.appendChild(delBtn);
                }

                if (item.draggable) {
                    item.addEventListener('dragstart', function (e) {
                        _dragSrc = text;
                        if (e.dataTransfer) {
                            e.dataTransfer.effectAllowed = 'move';
                            try { e.dataTransfer.setData('text/plain', text); } catch (_) {}
                        }
                        item.classList.add('dragging');
                    });
                    item.addEventListener('dragend', function () {
                        item.classList.remove('dragging');
                        _dragSrc = null;
                    });
                    item.addEventListener('dragover', function (e) {
                        e.preventDefault();
                        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                    });
                    item.addEventListener('drop', function (e) {
                        e.preventDefault();
                        if (_dragSrc === null || _dragSrc === text) return;
                        var g = getActiveCustomGroup();
                        if (!g) return;
                        var arr = g.emotes;
                        var from = arr.indexOf(_dragSrc);
                        var to = arr.indexOf(text);
                        if (from < 0 || to < 0) return;
                        arr.splice(from, 1);
                        arr.splice(to, 0, _dragSrc);
                        saveGroups();
                        renderGrid();
                    });
                }

                grid.appendChild(item);
            });
        }

        function openPanel() {
            if (!panelEl) createPanel();
            panelVisible = true;
            var p = computeAnchorPos();
            panelPos.x = p.x;
            panelPos.y = p.y;
            panelEl.style.left = panelPos.x + 'px';
            panelEl.style.top = panelPos.y + 'px';
            panelEl.style.width = p.w + 'px';
            panelEl.style.height = p.h + 'px';
            panelEl.classList.add('visible');
            panelEl.style.opacity = '1';
            panelEl.style.transform = 'translateY(0)';
            panelEl.style.pointerEvents = 'auto';
        }

        function closePanel() {
            if (!panelEl || !panelVisible) return;
            panelVisible = false;
            panelEl.classList.remove('visible');
            panelEl.classList.remove('editing');
            panelEl.classList.remove('collecting');
            exitEditing();
            exitCollecting();
            panelEl.style.opacity = '0';
            panelEl.style.transform = 'translateY(24px)';
            panelEl.style.pointerEvents = 'none';
        }

        function togglePanel() {
            if (!panelEl) createPanel();
            if (panelVisible) closePanel();
            else openPanel();
        }

        /* 点击面板与 InputChat 以外的地方时自动收纳面板。
         * 用 capture 阶段监听，确保即使目标元素之后被移除/阻止冒泡也能侦测到。
         * 排除条件：点击在面板内部，或点击在聊天输入框 InputChat 内部，或点击的是触发面板开关的原生按钮本身
         * （避免与 togglePanel 的开关逻辑互相打架，导致点一下按钮变成"开了又立刻被这里关掉"）。
         */
        document.addEventListener('mousedown', function (e) {
            if (!panelVisible || !panelEl) return;
            var target = e.target;
            if (panelEl.contains(target)) return;
            var inputChat = document.getElementById('InputChat');
            if (inputChat && inputChat.contains(target)) return;
            var triggerBtn = document.getElementById('lk-kaomoji-trigger-btn');
            if (triggerBtn && triggerBtn.contains(target)) return;
            closePanel();
        }, true);

        /* 只保留纵向缩放（高度），宽度始终跟随 TextAreaChatLog；缩放时仍保持贴齐 chat-room-bot 顶部，
         * 且高度不超过 TextAreaChatLog 的可用范围 */
        document.addEventListener('mousemove', function (e) {
            if (!_resizing) return;
            var newH = _resizeStart.h + (e.clientY - _resizeStart.y);
            newH = Math.max(220, Math.min(640, newH));
            var p = computeAnchorPos(newH);
            panelSize.height = p.h;
            panelPos.x = p.x;
            panelPos.y = p.y;
            panelEl.style.left = p.x + 'px';
            panelEl.style.top = p.y + 'px';
            panelEl.style.width = p.w + 'px';
            panelEl.style.height = p.h + 'px';
        });
        document.addEventListener('mouseup', function () {
            if (!_resizing) return;
            _resizing = false;
            saveSize();
        });
        document.addEventListener('touchmove', function (e) {
            if (!_resizing) return;
            var t = e.touches[0];
            var newH = _resizeStart.h + (t.clientY - _resizeStart.y);
            newH = Math.max(220, Math.min(640, newH));
            var p = computeAnchorPos(newH);
            panelSize.height = p.h;
            panelPos.x = p.x;
            panelPos.y = p.y;
            panelEl.style.left = p.x + 'px';
            panelEl.style.top = p.y + 'px';
            panelEl.style.width = p.w + 'px';
            panelEl.style.height = p.h + 'px';
        }, { passive: true });
        document.addEventListener('touchend', function () {
            if (!_resizing) return;
            _resizing = false;
            saveSize();
        });

        /* 窗口尺寸变化时，若面板正开启，重新贴齐 TextAreaChatLog 的 X / 宽度 / 高度上限，并贴齐 chat-room-bot 顶部 */
        window.addEventListener('resize', function () {
            repositionPanel();
        });

        /* ── 原生聊天框按钮注入（与 chat-room-send 并排）────────────────────── */
        function getMaskSvgUrl() {
            return 'url("data:image/svg+xml,' + encodeURIComponent(FACE_MASK_SVG) + '")';
        }

        // 工厂函式：协调器每次(重)建都会呼叫、回传全新按钮（自带样式注入；图示由 ::before mask 绘制）。
        function createNativeButton() {
            injectStyles();
            var btn = document.createElement('button');
            btn.id = 'lk-kaomoji-trigger-btn';
            btn.type = 'button';
            btn.className = 'blank-button button HideOnPopup chat-room-button';
            btn.setAttribute('role', 'menuitem');
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('aria-label', t('triggerLabel'));
            btn.title = t('triggerLabel');
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                togglePanel();
            });
            return btn;
        }

        /*
         * 样式内容是静态的（仅依赖不变的 FACE_MASK_SVG），因此只需要在样式表首次不存在时创建一次，
         * 避免每次轮询（200ms）都重建 <style> 节点、触发不必要的样式重算。
         */
        function injectStyles() {
            if (document.getElementById('lk-kaomoji-style')) return;
            var style = document.createElement('style');
            style.id = 'lk-kaomoji-style';
            style.textContent = [
                '#lk-kaomoji-trigger-btn.chat-room-button{',
                '  background-color:rgba(139,45,196,0.85) !important;',
                '  border-radius:12px !important;',
                '  position:relative !important;',
                '  overflow:hidden !important;',
                '}',
                '#lk-kaomoji-trigger-btn.chat-room-button::before{',
                '  content:"" !important;',
                '  position:absolute !important;',
                '  top:0 !important; left:0 !important;',
                '  width:100% !important; height:100% !important;',
                '  background-color:#ffffff !important;',
                '  mask-position:center center !important;',
                '  mask-size:60% 60% !important;',
                '  mask-repeat:no-repeat !important;',
                '  -webkit-mask-position:center center !important;',
                '  -webkit-mask-size:60% 60% !important;',
                '  -webkit-mask-repeat:no-repeat !important;',
                '  mask-image:' + getMaskSvgUrl() + ' !important;',
                '  -webkit-mask-image:' + getMaskSvgUrl() + ' !important;',
                '}',
                '#lk-kaomoji-trigger-btn.chat-room-button:hover{',
                '  background-color:rgba(160,96,224,0.95) !important;',
                '}',
                '#lk-kaomoji-trigger-btn.chat-room-button:active{',
                '  background-color:rgba(120,30,180,0.95) !important;',
                '}',
            ].join('\n');
            document.head.appendChild(style);
        }

        /**
         * 让原生「收纳/展开按钮列」的折叠状态持久化：
         * 第一次遇到该按钮时套用上次保存的状态（直接复用原生点击逻辑，保证图示与 hidden 状态同步），
         * 之后每次用户点击都把最新状态写回设定。
         * 用 dataset 标记挂钩状态，元素被重建（比如 PreserveChat=false 离开房间再进）时会自动重新挂钩。
         */
        function syncChatButtonsCollapse() {
            var btn = document.getElementById('chat-room-buttons-collapse');
            if (!btn || btn.dataset.likoCollapseHooked) return;
            btn.dataset.likoCollapseHooked = '1';

            var saved = loadChatButtonsCollapseState();
            if (saved !== null && btn.getAttribute('aria-expanded') !== saved) {
                btn.click(); // 原生点击处理函数是同步的，这里会顺带把 hidden 状态一起同步好
            }

            btn.addEventListener('click', function () {
                saveChatButtonsCollapseState(btn.getAttribute('aria-expanded'));
            });
        }

        /* 迁移清理：移除旧版折叠功能残留的按钮（一次性） */
        try {
            var _oldToggle = document.getElementById('lk-kaomoji-toggle-btn');
            if (_oldToggle) _oldToggle.remove();
            var _oldTrigger = document.getElementById('lk-kaomoji-trigger-btn');
            if (_oldTrigger && _oldTrigger.classList.contains('lk-km-collapsed')) _oldTrigger.remove();
        } catch (e) {}

        /* 交给共用协调器 BC_ChatRoomButtons 中央託管：同步登记 spec（不绑载入时机）——协调器已载入
           就直接 add，否则推进待处理队列等其初始化排空。容器建立/重建、收合同步、顺位全由协调器处理，
           本插件不再自己注入或掛 observer。Kaomoji 用自带 ::before mask 当图示，故不需 plain。 */
        (function registerKaomojiButton() {
            var spec = ['kaomoji', sys_CRB, createNativeButton, {}];
            var L = window.Liko = window.Liko || {};
            if (L.__Sys_ChatRoomButtons__ && L.__Sys_ChatRoomButtons__.add) L.__Sys_ChatRoomButtons__.add.apply(null, spec);
            else { L.__CRB_pending__ = L.__CRB_pending__ || []; L.__CRB_pending__.push(spec); }
        })();

        /* 此定时器保留两件事：面板跟随（面板关闭时 repositionPanel 立即 return，近乎零开销），以及
           原生收合钮的折叠状态持久化（syncChatButtonsCollapse 有 dataset 守卫、幂等，负责在收合钮
           (重)出现时补挂钩并套用上次保存的状态）。按钮本身的注入/收合已由协调器处理，不在这里。 */
        var _injectInterval = setInterval(function () {
            try { repositionPanel(); } catch (e) {}
            try { syncChatButtonsCollapse(); } catch (e) {}
        }, 200);

        /* ── 单实例销毁（供热更新彻底清理旧实例）────────────────────────────── */
        function destroyInstance() {
            _destroyed = true; // 立即标记，防止仍在等待 bcModSdk 的旧实例事后才悄悄完成注册
            try { clearInterval(_injectInterval); } catch (e) {}
            // 从协调器注销本插件的按钮（连同待处理队列残留），避免旧实例的工厂闭包在容器重建时被复用
            try {
                if (window.Liko.__Sys_ChatRoomButtons__ && window.Liko.__Sys_ChatRoomButtons__.remove) window.Liko.__Sys_ChatRoomButtons__.remove('kaomoji');
                var _q = window.Liko.__CRB_pending__;
                if (Array.isArray(_q)) { var _i = _q.findIndex(function (s) { return s && s[0] === 'kaomoji'; }); if (_i >= 0) _q.splice(_i, 1); }
            } catch (e) {}
            try {
                ['lk-kaomoji-trigger-btn', 'lk-kaomoji-toggle-btn', 'lk-kaomoji-panel', 'lk-kaomoji-toast']
                    .forEach(function (id) { var el = document.getElementById(id); if (el) el.remove(); });
                document.querySelectorAll('style').forEach(function (s) {
                    if (s.id && s.id.indexOf('lk-kaomoji') === 0) s.remove();
                });
            } catch (e) {}
            panelEl = null;
            try {
                if (modApi && typeof modApi.unregister === 'function') {
                    modApi.unregister();
                    console.log("🐈‍⬛ [Kaomoji] 已从 bcModSdk 注销旧实例");
                }
            } catch (e) {}
            modApi = null;
            try {
                if (window.Liko && window.Liko.Kaomoji) {
                    // 注意：不能整个 delete，新实例马上会读 window.Liko.Kaomoji.version，
                    // 若这里删除整个对象会造成访问 undefined 报错，新实例初始化直接失败
                    window.Liko.Kaomoji = {};
                }
            } catch (e) {}
            _injectInterval = null;
        }
        window.Liko.Kaomoji.Destroy = destroyInstance;
        window.Liko.Kaomoji.Toggle  = togglePanel;

        /* ── bcModSDK 注册 ───────────────────────────────────────────────────── */
        function waitForBcModSdk() {
            return new Promise(function (resolve, reject) {
                (function check() {
                    if (_destroyed) return reject(new Error('destroyed'));
                    if (typeof bcModSdk !== 'undefined' && bcModSdk && bcModSdk.registerMod) return resolve();
                    setTimeout(check, 100);
                })();
            });
        }

        var modApi = null;

        async function initMod() {
            try {
                await waitForBcModSdk();
            } catch (e) {
                return; // 实例在等待期间已被销毁（例如脚本被热更新替换），放弃注册
            }
            if (_destroyed) return; // 双重保险
            try {
                modApi = bcModSdk.registerMod({
                    repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
                    name: 'Liko - Kaomoji',
                    version: MOD_VER,
                    fullName: 'Liko的文字表情',
                }, {
                    allowReplace: true, // 热更新/脚本重载时允许替换已注册的同名模组，避免"已加载不允许替换"报错
                });
            } catch (e) {
                console.error("🐈‍⬛ [Kaomoji] bcModSdk 注册失败:", e);
                return;
            }
        }
        initMod();

        /* 计算加载提示锚点：靠右贴齐 chat-room-bot（按钮在右下角，提示也靠右对齐） */
        function computeToastPos() {
            var bot = document.getElementById('chat-room-bot');
            if (bot) {
                var r = bot.getBoundingClientRect();
                return {
                    right: Math.max(8, window.innerWidth - r.right + 8),
                    bottom: Math.max(8, window.innerHeight - r.top + 8),
                };
            }
            return { right: 16, bottom: 88 };
        }

        /* ── 加载提示（贴齐 chat-room-bot 右上方，靠右对齐，6秒后自动消失）──── */
        function showLoadToast(message) {
            var toast = document.createElement('div');
            toast.id = 'lk-kaomoji-toast';

            var pos = computeToastPos();

            toast.style.cssText = [
                'position:fixed',
                'right:' + pos.right + 'px',
                'bottom:' + pos.bottom + 'px',
                'max-width:260px',
                'padding:10px 14px',
                'z-index:99',
                'font-family:"Segoe UI",system-ui,sans-serif',
                'font-size:14px',
                'line-height:1.5',
                'color:#e0d0ff',
                'background:rgba(12,16,26,0.95)',
                'border:1px solid rgba(139,45,196,0.45)',
                'border-radius:12px',
                'box-shadow:0 8px 28px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.08)',
                'backdrop-filter:blur(20px) saturate(1.3)',
                'opacity:1',
                'transform:translateY(0)',
                'transition:opacity 0.4s ease,transform 0.4s ease',
                'pointer-events:none',
            ].join(';');
            toast.innerHTML = '<span style="color:#c79dff;font-weight:600;">[Kaomoji]</span> ' + message;
            document.body.appendChild(toast);
            setTimeout(function () {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(8px)';
                setTimeout(function () { if (toast.parentNode) toast.remove(); }, 400);
            }, 6000);
        }

        (async function waitForLoad() {
            while (typeof Player === 'undefined' || typeof CurrentScreen === 'undefined') {
                await new Promise(r => setTimeout(r, 1000));
            }
            while (CurrentScreen !== 'ChatRoom') {
                await new Promise(r => setTimeout(r, 1000));
            }
            showLoadToast(t('toastMessage').replace('{VER}', MOD_VER));
        })();

        console.log(`🐈‍⬛ [Kaomoji] ✅ v${MOD_VER} loaded`);

    } catch (e) {
        console.error("🐈‍⬛ [Kaomoji] 脚本顶层错误:", e);
    }
})();
