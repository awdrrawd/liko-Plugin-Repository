// Liko - Prank i18n 字庫
// 此檔案由 Prank 插件動態載入，不需手動安裝
// 載入完畢後自動呼叫 register，將字串注入共用引擎 Liko-i18n
// 佔位符以 {name} / {v} 表示，由引擎的 t(ns, key, vars) 代入
// 動作描述中的 SourceCharacter / TargetCharacter 為 BC 內建代換 token，請勿翻譯

(function () {
    if (!window.Liko?.i18n?.register) {
        console.error('[Liko Prank strings] i18n 引擎尚未載入');
        return;
    }

    window.Liko.i18n.register('Prank', {

        // ── 載入 / 系統訊息 ───────────────────────────────────────────────
        'loaded': {
            TW: "Liko 的惡作劇插件 v{v} 載入完成！",
            CN: "Liko的恶作剧插件 v{v} 载入完成！",
            EN: "Liko's Prank Plugin v{v} Loaded!",
            DE: "Likos Streich-Plugin v{v} geladen!",
            FR: "Plugin de farces de Liko v{v} chargé !",
            RU: "Плагин шалостей Liko v{v} загружен!",
            UA: "Плагін витівок Liko v{v} завантажено!"
        },
        'notFound': {
            TW: "找不到目標", CN: "找不到目标", EN: "Target not found",
            DE: "Ziel nicht gefunden", FR: "Cible introuvable",
            RU: "Цель не найдена", UA: "Ціль не знайдено"
        },
        'noPermission': {
            TW: "無權限", CN: "无权限", EN: "No permission",
            DE: "Keine Berechtigung", FR: "Aucune autorisation",
            RU: "Нет разрешения", UA: "Немає дозволу"
        },
        'noUnderwear': {
            TW: "沒有穿內褲", CN: "没有穿内裤", EN: "has no underwear",
            DE: "trägt keine Unterwäsche", FR: "ne porte pas de sous-vêtements",
            RU: "без нижнего белья", UA: "без нижньої білизни"
        },
        'noSocks': {
            TW: "沒有穿襪子", CN: "没有穿袜子", EN: "has no socks",
            DE: "trägt keine Socken", FR: "ne porte pas de chaussettes",
            RU: "без носков", UA: "без шкарпеток"
        },
        'stealFailed': {
            TW: "偷取失敗", CN: "偷取失败", EN: "Failed to steal",
            DE: "Diebstahl fehlgeschlagen", FR: "Échec du vol",
            RU: "Не удалось украсть", UA: "Не вдалося вкрасти"
        },
        'removeFailed': {
            TW: "脫下失敗", CN: "脱下失败", EN: "Failed to remove",
            DE: "Entfernen fehlgeschlagen", FR: "Échec du retrait",
            RU: "Не удалось снять", UA: "Не вдалося зняти"
        },
        'nothingToRemove': {
            TW: "在這個部位沒有可移除的衣物",
            CN: "在这个部位没有可移除的衣物",
            EN: "has no removable clothing in this area",
            DE: "hat an dieser Stelle keine entfernbare Kleidung",
            FR: "n'a aucun vêtement amovible à cet endroit",
            RU: "не имеет снимаемой одежды в этой области",
            UA: "не має одягу, який можна зняти в цій зоні"
        },
        'hasAhoge': {
            TW: "沒有呆毛", CN: "没有呆毛", EN: "has no ahoge",
            DE: "hat keine Ahoge", FR: "n'a pas d'ahoge",
            RU: "без ахоге", UA: "без ахеге"
        },
        'enterRoomPrompt': {
            TW: "輸入房間名稱", CN: "输入房间名称", EN: "Enter room name",
            DE: "Raumnamen eingeben", FR: "Saisir le nom du salon",
            RU: "Введите название комнаты", UA: "Введіть назву кімнати"
        },

        // ── 動作旁白片段（與暱稱串接） ─────────────────────────────────────
        'stealUnderwear': {
            TW: "悄悄偷走了", CN: "悄悄偷走了", EN: "discreetly steals",
            DE: "stiehlt heimlich", FR: "dérobe discrètement",
            RU: "незаметно крадёт", UA: "непомітно краде"
        },
        'stealUnderwearSuffix': {
            TW: "的內褲 💕", CN: "的内裤 💕", EN: "'s underwear 💕",
            DE: "s Unterwäsche 💕", FR: " sa culotte 💕",
            RU: " бельё 💕", UA: " білизну 💕"
        },
        'removedOwnUnderwear': {
            TW: "脫下了自己的內褲", CN: "脱下了自己的内裤",
            EN: "takes off their own underwear",
            DE: "zieht die eigene Unterwäsche aus",
            FR: "retire ses propres sous-vêtements",
            RU: "снимает собственное бельё", UA: "знімає власну білизну"
        },
        'dissolveClothes': {
            TW: "用淫穢的藥水溶解了", CN: "用淫秽的药水溶解了",
            EN: "splashes an obscene concoction on",
            DE: "übergießt mit einem obszönen Gebräu",
            FR: "asperge d'une potion obscène",
            RU: "обливает непристойным зельем", UA: "обливає непристойним зіллям"
        },
        'dissolveClothesTarget': {
            TW: "的衣服", CN: "的衣服", EN: "'s clothes",
            DE: "s Kleidung", FR: " les vêtements",
            RU: " одежду", UA: " одяг"
        },
        'dissolveOwnClothes': {
            TW: "用淫穢的藥水溶解了自己的衣服",
            CN: "用淫秽的药水溶解了自己的衣服",
            EN: "splashes an obscene concotion on their own clothes",
            DE: "übergießt die eigene Kleidung mit einem obszönen Gebräu",
            FR: "asperge ses propres vêtements d'une potion obscène",
            RU: "обливает собственную одежду непристойным зельем",
            UA: "обливає власний одяг непристойним зіллям"
        },
        'enterPortal': {
            TW: "進入通往", CN: "进入通往", EN: "opens a wormhole towards",
            DE: "öffnet ein Wurmloch nach", FR: "ouvre un trou de ver vers",
            RU: "открывает червоточину в", UA: "відкриває червоточину до"
        },
        'exitPortal': {
            TW: "從蟲洞出來了", CN: "从虫洞出来了", EN: "emerges from a wormhole",
            DE: "taucht aus einem Wurmloch auf", FR: "émerge d'un trou de ver",
            RU: "выходит из червоточины", UA: "виходить із червоточини"
        },
        'cutClothes': {
            TW: "用剪刀剪掉了", CN: "用剪刀剪掉了", EN: "cuts off",
            DE: "schneidet ab", FR: "coupe",
            RU: "срезает", UA: "зрізає"
        },
        'cutClothesTarget': {
            TW: "的", CN: "的", EN: "'s",
            DE: "s", FR: " :", RU: " —", UA: " —"
        },
        'cutOwnClothes': {
            TW: "用剪刀剪掉了自己的", CN: "用剪刀剪掉了自己的",
            EN: "cuts off their own",
            DE: "zerschneidet die eigene", FR: "coupe ses propres",
            RU: "срезает собственные", UA: "зрізає власні"
        },
        'removeClothes': {
            TW: "脫掉了", CN: "脱掉了", EN: "removes",
            DE: "zieht aus", FR: "retire",
            RU: "снимает", UA: "знімає"
        },
        'removeOwnClothes': {
            TW: "脫掉了自己的", CN: "脱掉了自己的", EN: "removes their own",
            DE: "entfernt die eigene", FR: "retire ses propres",
            RU: "снимает собственные", UA: "знімає власні"
        },
        'stoleUnderwear': {
            TW: "偷了", CN: "偷了", EN: "snatches",
            DE: "schnappt sich", FR: "subtilise",
            RU: "выхватывает", UA: "вихоплює"
        },
        'removedAndHoldUnderwear': {
            TW: "脫下了", CN: "脱下了", EN: "slips off",
            DE: "streift ab", FR: "retire",
            RU: "снимает", UA: "знімає"
        },
        'holdUnderwear': {
            TW: "的內褲並握在手中", CN: "的内裤并握在手中",
            EN: "'s underwear and embraces their warmth",
            DE: "s Unterwäsche und genießt ihre Wärme",
            FR: " la culotte et savoure sa chaleur",
            RU: " бельё и наслаждается его теплом",
            UA: " білизну й насолоджується її теплом"
        },
        'holdOwnUnderwear': {
            TW: "脫下了自己的內褲並握在手中",
            CN: "脱下了自己的内裤并握在手中",
            EN: "slips down their own underwear and holds them",
            DE: "streift die eigene Unterwäsche ab und hält sie fest",
            FR: "retire ses propres sous-vêtements et les garde en main",
            RU: "снимает собственное бельё и держит его в руках",
            UA: "знімає власну білизну й тримає її в руках"
        },
        'stoleSocks': {
            TW: "偷了", CN: "偷了", EN: "snatches",
            DE: "schnappt sich", FR: "subtilise",
            RU: "выхватывает", UA: "вихоплює"
        },
        'socksSuffix': {
            TW: "的襪子", CN: "的袜子", EN: "'s socks",
            DE: "s Socken", FR: " les chaussettes",
            RU: " носки", UA: " шкарпетки"
        },
        'removedAndHoldSocks': {
            TW: "脫下了", CN: "脱下了", EN: "pulls off",
            DE: "zieht aus", FR: "retire",
            RU: "снимает", UA: "знімає"
        },
        'holdSocks': {
            TW: "的襪子並握在手中", CN: "的袜子并握在手中",
            EN: "'s socks and clutches them",
            DE: "s Socken und drückt sie an sich",
            FR: " les chaussettes et les serre contre soi",
            RU: " носки и сжимает их", UA: " шкарпетки й притискає їх"
        },
        'holdOwnSocks': {
            TW: "脫下了自己的襪子並握在手中",
            CN: "脱下了自己的袜子并握在手中",
            EN: "pulls off their socks and holds them",
            DE: "zieht die eigenen Socken aus und hält sie fest",
            FR: "retire ses propres chaussettes et les garde en main",
            RU: "снимает собственные носки и держит их в руках",
            UA: "знімає власні шкарпетки й тримає їх у руках"
        },
        'pluckingOwnHair': {
            TW: "拔下了自己的呆毛", CN: "拔下了自己的呆毛",
            EN: "pluckes out their own ahoge",
            DE: "zupft die eigene Ahoge aus", FR: "arrache son propre ahoge",
            RU: "выдёргивает собственный ахоге", UA: "висмикує власну ахеге"
        },
        'pluckingHair': {
            TW: "拔下了", CN: "拔下了", EN: "pluckes out",
            DE: "zupft aus", FR: "arrache",
            RU: "выдёргивает", UA: "висмикує"
        },
        'pluckingHairSuffix': {
            TW: "的呆毛", CN: "的呆毛", EN: "'s ahoge",
            DE: "s Ahoge", FR: " l'ahoge",
            RU: " ахоге", UA: " ахеге"
        },

        // ── 手持物品名稱 / 描述（{name} 為目標暱稱） ───────────────────────
        'itemPantiesName': {
            TW: "{name}剛脫下的內褲 💕",
            CN: "{name}刚脱下的内裤 💕",
            EN: "{name}'s freshly removed panties 💕",
            DE: "{name}s frisch ausgezogenes Höschen 💕",
            FR: "La culotte fraîchement retirée de {name} 💕",
            RU: "Только что снятые трусики {name} 💕",
            UA: "Щойно зняті трусики {name} 💕"
        },
        'itemPantiesDesc': {
            TW: "{name}剛脫下的內褲，帶有一點餘溫與氣味 💕",
            CN: "{name}刚脱下的内裤，带有一点余温与气味 💕",
            EN: "{name}'s freshly removed panties, with a hint of warmth and scent 💕",
            DE: "{name}s frisch ausgezogenes Höschen, mit einem Hauch von Wärme und Duft 💕",
            FR: "La culotte fraîchement retirée de {name}, avec un soupçon de chaleur et de parfum 💕",
            RU: "Только что снятые трусики {name}, ещё хранящие тепло и аромат 💕",
            UA: "Щойно зняті трусики {name}, що зберігають тепло й аромат 💕"
        },
        'itemSocksName': {
            TW: "{name}剛脫下的襪子 💕",
            CN: "{name}刚脱下的袜子 💕",
            EN: "{name}'s freshly removed socks 💕",
            DE: "{name}s frisch ausgezogene Socken 💕",
            FR: "Les chaussettes fraîchement retirées de {name} 💕",
            RU: "Только что снятые носки {name} 💕",
            UA: "Щойно зняті шкарпетки {name} 💕"
        },
        'itemSocksDesc': {
            TW: "{name}剛脫下的襪子，帶有一點餘溫與氣味 💕",
            CN: "{name}刚脱下的袜子，带有一点余温与气味 💕",
            EN: "{name}'s freshly removed socks, with a hint of warmth and scent 💕",
            DE: "{name}s frisch ausgezogene Socken, mit einem Hauch von Wärme und Duft 💕",
            FR: "Les chaussettes fraîchement retirées de {name}, avec un soupçon de chaleur et de parfum 💕",
            RU: "Только что снятые носки {name}, ещё хранящие тепло и аромат 💕",
            UA: "Щойно зняті шкарпетки {name}, що зберігають тепло й аромат 💕"
        },

        // ── 活動按鈕標籤 ───────────────────────────────────────────────────
        'actCutClothes': {
            TW: "剪掉衣物", CN: "剪掉衣物", EN: "Cut Clothes",
            DE: "Kleidung zerschneiden", FR: "Couper les vêtements",
            RU: "Срезать одежду", UA: "Розрізати одяг"
        },
        'actRemoveClothes': {
            TW: "脫掉衣物", CN: "脱掉衣物", EN: "Remove Clothes",
            DE: "Kleidung ausziehen", FR: "Retirer les vêtements",
            RU: "Снять одежду", UA: "Зняти одяг"
        },
        'actDissolveClothes': {
            TW: "溶解衣物", CN: "溶解衣物", EN: "Dissolve Clothes",
            DE: "Kleidung auflösen", FR: "Dissoudre les vêtements",
            RU: "Растворить одежду", UA: "Розчинити одяг"
        },
        'actDissolveClothesWeak': {
            TW: "溶解衣物(弱)", CN: "溶解衣物(弱)", EN: "Dissolve Clothes (Light)",
            DE: "Kleidung auflösen (leicht)", FR: "Dissoudre les vêtements (léger)",
            RU: "Растворить одежду (слабо)", UA: "Розчинити одяг (слабо)"
        },
        'actStealPanties': {
            TW: "偷內褲", CN: "偷内裤", EN: "Steal Panties",
            DE: "Höschen stehlen", FR: "Voler la culotte",
            RU: "Украсть трусики", UA: "Вкрасти трусики"
        },
        'actRemoveHoldPanties': {
            TW: "脫下並握著內褲", CN: "脱下并握着内裤", EN: "Take Panties",
            DE: "Höschen nehmen", FR: "Prendre la culotte",
            RU: "Забрать трусики", UA: "Забрати трусики"
        },
        'actStealSocks': {
            TW: "偷襪子", CN: "偷袜子", EN: "Steal Socks",
            DE: "Socken stehlen", FR: "Voler les chaussettes",
            RU: "Украсть носки", UA: "Вкрасти шкарпетки"
        },
        'actRemoveHoldSocks': {
            TW: "脫下並握著襪子", CN: "脱下并握着袜子", EN: "Take Socks",
            DE: "Socken nehmen", FR: "Prendre les chaussettes",
            RU: "Забрать носки", UA: "Забрати шкарпетки"
        },
        'actPluckingHair': {
            TW: "拔呆毛", CN: "拔呆毛", EN: "Pluck Ahoge",
            DE: "Ahoge zupfen", FR: "Arracher l'ahoge",
            RU: "Выдернуть ахоге", UA: "Висмикнути ахеге"
        },

        // ── 活動描述（含 SourceCharacter / TargetCharacter 代換 token） ────
        'actCutClothesDesc': {
            TW: "SourceCharacter 用剪刀剪掉了 TargetCharacter 的衣物",
            CN: "SourceCharacter 用剪刀剪掉了 TargetCharacter 的衣物",
            EN: "SourceCharacter cuts off TargetCharacter's clothes using scissors",
            DE: "SourceCharacter schneidet TargetCharacter mit einer Schere die Kleidung ab",
            FR: "SourceCharacter coupe les vêtements de TargetCharacter avec des ciseaux",
            RU: "SourceCharacter срезает одежду TargetCharacter ножницами",
            UA: "SourceCharacter зрізає одяг TargetCharacter ножицями"
        },
        'actCutClothesSelf': {
            TW: "SourceCharacter 用剪刀剪掉了自己的衣物",
            CN: "SourceCharacter 用剪刀剪掉了自己的衣物",
            EN: "SourceCharacter cuts off their own clothes using scissors",
            DE: "SourceCharacter schneidet sich mit einer Schere die eigene Kleidung ab",
            FR: "SourceCharacter coupe ses propres vêtements avec des ciseaux",
            RU: "SourceCharacter срезает собственную одежду ножницами",
            UA: "SourceCharacter зрізає власний одяг ножицями"
        },
        'actRemoveClothesDesc': {
            TW: "SourceCharacter 脫掉了 TargetCharacter 的衣物",
            CN: "SourceCharacter 脱掉了 TargetCharacter 的衣物",
            EN: "SourceCharacter removes TargetCharacter's clothes",
            DE: "SourceCharacter zieht TargetCharacter die Kleidung aus",
            FR: "SourceCharacter retire les vêtements de TargetCharacter",
            RU: "SourceCharacter снимает одежду с TargetCharacter",
            UA: "SourceCharacter знімає одяг із TargetCharacter"
        },
        'actRemoveClothesSelf': {
            TW: "SourceCharacter 脫掉了自己的衣物",
            CN: "SourceCharacter 脱掉了自己的衣物",
            EN: "SourceCharacter removes their own clothes",
            DE: "SourceCharacter zieht die eigene Kleidung aus",
            FR: "SourceCharacter retire ses propres vêtements",
            RU: "SourceCharacter снимает собственную одежду",
            UA: "SourceCharacter знімає власний одяг"
        },
        'actDissolveClothesDesc': {
            TW: "SourceCharacter 對 TargetCharacter 使用了淫穢的藥水",
            CN: "SourceCharacter 对 TargetCharacter 使用了淫秽的药水",
            EN: "SourceCharacter splashes an obscene concotion on TargetCharacter",
            DE: "SourceCharacter übergießt TargetCharacter mit einem obszönen Gebräu",
            FR: "SourceCharacter asperge TargetCharacter d'une potion obscène",
            RU: "SourceCharacter обливает TargetCharacter непристойным зельем",
            UA: "SourceCharacter обливає TargetCharacter непристойним зіллям"
        },
        'actDissolveClothesSelf': {
            TW: "SourceCharacter 對自己使用了淫穢的藥水",
            CN: "SourceCharacter 对自己使用了淫秽的药水",
            EN: "SourceCharacter splashes an obscene concotion on themselves",
            DE: "SourceCharacter übergießt sich selbst mit einem obszönen Gebräu",
            FR: "SourceCharacter s'asperge d'une potion obscène",
            RU: "SourceCharacter обливает себя непристойным зельем",
            UA: "SourceCharacter обливає себе непристойним зіллям"
        },
        'actStealPantiesDesc': {
            TW: "SourceCharacter 偷了 TargetCharacter 的內褲",
            CN: "SourceCharacter 偷了 TargetCharacter 的内裤",
            EN: "SourceCharacter snatches TargetCharacter's panties",
            DE: "SourceCharacter schnappt sich TargetCharacters Höschen",
            FR: "SourceCharacter subtilise la culotte de TargetCharacter",
            RU: "SourceCharacter выхватывает трусики TargetCharacter",
            UA: "SourceCharacter вихоплює трусики TargetCharacter"
        },
        'actRemoveHoldPantiesDesc': {
            TW: "SourceCharacter 脫下了 TargetCharacter 的內褲並握在手中",
            CN: "SourceCharacter 脱下了 TargetCharacter 的内裤并握在手中",
            EN: "SourceCharacter slips off TargetCharacter's panties and holds them",
            DE: "SourceCharacter streift TargetCharacter das Höschen ab und hält es fest",
            FR: "SourceCharacter retire la culotte de TargetCharacter et la garde en main",
            RU: "SourceCharacter снимает трусики TargetCharacter и держит их в руках",
            UA: "SourceCharacter знімає трусики TargetCharacter і тримає їх у руках"
        },
        'actRemoveHoldPantiesSelf': {
            TW: "SourceCharacter 脫下了自己的內褲並握在手中",
            CN: "SourceCharacter 脱下了自己的内裤并握在手中",
            EN: "SourceCharacter slips off their own panties holds them",
            DE: "SourceCharacter streift das eigene Höschen ab und hält es fest",
            FR: "SourceCharacter retire sa propre culotte et la garde en main",
            RU: "SourceCharacter снимает собственные трусики и держит их в руках",
            UA: "SourceCharacter знімає власні трусики і тримає їх у руках"
        },
        'actStealSocksDesc': {
            TW: "SourceCharacter 偷了 TargetCharacter 的襪子",
            CN: "SourceCharacter 偷了 TargetCharacter 的袜子",
            EN: "SourceCharacter snatches TargetCharacter's socks",
            DE: "SourceCharacter schnappt sich TargetCharacters Socken",
            FR: "SourceCharacter subtilise les chaussettes de TargetCharacter",
            RU: "SourceCharacter выхватывает носки TargetCharacter",
            UA: "SourceCharacter вихоплює шкарпетки TargetCharacter"
        },
        'actRemoveHoldSocksDesc': {
            TW: "SourceCharacter 脫下了 TargetCharacter 的襪子並握在手中",
            CN: "SourceCharacter 脱下了 TargetCharacter 的袜子并握在手中",
            EN: "SourceCharacter pulls off TargetCharacter's socks and holds them",
            DE: "SourceCharacter zieht TargetCharacter die Socken aus und hält sie fest",
            FR: "SourceCharacter retire les chaussettes de TargetCharacter et les garde en main",
            RU: "SourceCharacter снимает носки TargetCharacter и держит их в руках",
            UA: "SourceCharacter знімає шкарпетки TargetCharacter і тримає їх у руках"
        },
        'actRemoveHoldSocksSelf': {
            TW: "SourceCharacter 脫下了自己的襪子並握在手中",
            CN: "SourceCharacter 脱下了自己的袜子并握在手中",
            EN: "SourceCharacter pulls off their own socks and holds them",
            DE: "SourceCharacter zieht die eigenen Socken aus und hält sie fest",
            FR: "SourceCharacter retire ses propres chaussettes et les garde en main",
            RU: "SourceCharacter снимает собственные носки и держит их в руках",
            UA: "SourceCharacter знімає власні шкарпетки і тримає їх у руках"
        },

        // ── 活動按鈕角標 (🪄) ───────────────────────────────────────────────
        'badgeTooltip': {
            TW: "惡作劇動作", CN: "恶作剧动作", EN: "Prank Activity",
            DE: "Streich-Aktion", FR: "Action de farce",
            RU: "Шалость", UA: "Витівка"
        }

    });
})();
