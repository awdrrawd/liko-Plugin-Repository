<div align="center">

<img src="Images/PCM_ICON.png" alt="PCM icon" width="160">

# Plugin Collection Manager（PCM）

[![PCM](https://img.shields.io/badge/PCM-v2.2.0-9F7AEA?style=for-the-badge)](https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js)
[![License](https://img.shields.io/badge/License-MIT-C084FC?style=for-the-badge)](LICENSE)

集中安裝、啟用與管理 Bondage Club 插件。建議優先使用 PCM；也保留書籤、控制台及單獨安裝方式。

[立即安裝 PCM](https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js) · [瀏覽插件網站](https://awdrrawd.github.io/liko-Plugin-Repository/)

</div>

## 安裝 PCM

### 推薦：腳本管理器

安裝 Tampermonkey、Violentmonkey 或 Userscripts 後，點擊下方連結即可安裝並自動更新 PCM：

### [👉 點此安裝 PCM](https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js)

進入遊戲後可輸入 `/pcm help` 查看說明，或輸入 `/pcm list` 查看插件狀態。

### 其他載入方式

#### 書籤

建立新書籤，將下列內容貼到書籤網址：

```javascript
javascript:(function(){var s=document.createElement('script');s.src='https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js?'+Date.now();s.type='text/javascript';s.crossOrigin='anonymous';document.head.appendChild(s)})();
```

#### 瀏覽器控制台

開啟開發者工具，在 Console 貼上：

```javascript
import(`https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js?v=${(Date.now() / 10000).toFixed(0)}`);
```

#### 單獨安裝插件

如果不使用 PCM，可直接點擊下方插件表格中的「安裝」，或前往 [Plugins](./Plugins) 選擇個別腳本。

## 插件收藏

目前收錄 43 款插件：32 款 Liko 插件、8 款社群插件與 3 款修正補丁，涵蓋聊天室、外觀、互動、媒體、介面優化與開發輔助。

### Liko 插件

| 插件 | 功能介紹 | 版本 | 連結 |
|---|---|---:|---|
| ✨ **Liko的俱樂部擴充(測試)**<br><sub>Liko's Club Expansion(test)</sub><br>`Liko-LCE` | 以WCE為基底合併幾個小型插件功能，並提供美化登入介面與帳號記憶功能 | 持續更新 | [安裝](https://cdn.jsdelivr.net/gh/awdrrawd/BC-LCE@main/dist/assets/main.js) · [專案網站](https://github.com/awdrrawd/BC-LCE) |
| 🐈‍⬛ **Liko的外觀編輯拓展(測試中)**<br><sub>Liko's Appearance editing extension(testing)</sub><br>`Liko-AEE` | 更強大的編輯器，並且支援更多的服裝編輯(測試中) | 持續更新 | [安裝](https://awdrrawd.github.io/BC-AEE/assets/main.js) · [專案網站](https://github.com/awdrrawd/BC-AEE/tree/main) |
| 💗 **Liko的熱情回應**<br><sub>Liko's Responsive Reactions</sub><br>`Liko-Responsive` | 依互動、高潮、趣味與房間事件，自動執行文字、動作、表情與特殊動畫回應。 | 持續更新 | [安裝](https://awdrrawd.github.io/BC-Responsive/dist/main.js) · [專案網站](https://github.com/awdrrawd/BC-Responsive) |
| 🌸 **繁戀如花 ─繽紛─**<br><sub>Abundantia Florum ─Chromatica─</sub><br>`Liko-AFC` | 更多戀人，如百花盛放的愛情篇章，並搭載可延展的戀人鎖機制。 | 持續更新 | [安裝](https://awdrrawd.github.io/BC-AFC/assets/main.js) · [專案網站](https://github.com/awdrrawd/BC-AFC) |
| 👥 **Liko的好友與房間管理**<br><sub>Friends and ChatRoom Manager</sub><br>`Liko-FCM` | 更好的好友管理與房間管理功能<br><sub>提供個人資料的保存、查詢，房間名單的管理</sub> | 持續更新 | [安裝](https://awdrrawd.github.io/BC-FCM/assets/main.js) · [專案網站](https://github.com/awdrrawd/BC-FCM) |
| 🌀 **催眠奴隸俱樂部**<br><sub>Hypnotic Slave Club</sub><br>`Liko-HSC` | 提供多樣催眠效果，增強催眠的沉浸度 | 持續更新 | [安裝](https://awdrrawd.github.io/BC-HSC/assets/main.js) · [專案網站](https://github.com/awdrrawd/BC-HSC) |
| 📖 **Liko的聊天室書記官**<br><sub>Liko's Chat History Exporter</sub><br>`Liko-CHE` | 聊天室信息轉HTML，並且提供最多7天的信息救援(需要手動啟用緩存功能)<br><sub>包含完整的聊天記錄、時間戳和角色信息，可以搭配Neocities等網站上傳分享</sub> | v2.6.0 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CHE.main.user.js) |
| 🖼️ **Liko的圖片上傳器**<br><sub>Liko's Image Uploader</sub><br>`Liko-Image_Uploader` | 拖曳上傳圖片並分享到聊天室<br><sub>圖片上傳失敗時，可以使用/IMG或/IMG HELP查閱說明</sub> | v1.6.2 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Image%20Uploader.main.user.js) |
| 🌐 **Liko的自動翻譯**<br><sub>Liko's Messages Auto Translator</sub><br>`Liko-MAT` | 自動翻譯(使用Google api) | v1.7.9 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20MAT.main.user.js) |
| 🧰 **Liko的工具包**<br><sub>Liko's Tool Kit</sub><br>`Liko-Tool` | 有許多小功能合集的工具包，但也有點不穩定<br><sub>詳細使用說明請輸入/LT或/LT help查詢</sub> | v2.2.0 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Tool.main.user.js) |
| 🎬 **Liko的自動創建影片**<br><sub>Liko's Automatically create video.</sub><br>`Liko-ACV` | Liko的自動創建影片 | v1.5.1 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20ACV.main.user.js) |
| 😀 **文字表情**<br><sub>Kaomoji</sub><br>`Liko-Kaomoji` | 文字表情快捷面板，並提供自訂、常用快捷分類 | v1.1.1 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Kaomoji.main.user.js) |
| 🗺️ **Liko的地圖房迷你地圖**<br><sub>Liko's Bondage Map Minimap</sub><br>`Liko-BMM` | BC 地圖房迷你地圖 | v2.0.1 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20BMM.main.user.js) |
| 🔧 **聊天室輔助工具**<br><sub>ChatRoom Assistant</sub><br>`Liko-CRA` | 替他人改姿勢、輸入歷史、BIO時區頭頂時間、@動作自帶名字、指令/房間轉按鈕 | v1.0.2 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CRA.main.user.js) |
| 🪄 **Liko對朋友的惡作劇**<br><sub>Liko's Friend Prank</sub><br>`Liko-Prank` | 內褲大盜鬧得BC社群人心惶惶！<br><sub>注意：這是個惡作劇插件，請謹慎使用！指令 /偷取, /溶解, /传送</sub> | v1.6.9 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Prank.main.user.js) |
| 👗 **Liko的自訂更衣室背景**<br><sub>Liko's Custom Dressing Background</sub><br>`Liko-CDB` | 更衣室背景替換，並提供網格對焦與替換姿勢 | v1.5.2 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CDB.main.user.js) |
| 🎵 **Liko的聊天室音樂控制器(測試中)**<br><sub>Liko's Music Controller(testing)</sub><br>`Liko-CMC` | 支援歌詞(需要有曲名)、歌曲列表 | v1.3.1 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CMC.main.user.js) |
| 📱 **手機直版佈局(測試)**<br><sub>Mobile Portrait Layout(test)</sub><br>`Liko-MPL` | 支援房間搜尋與聊天室的直版佈局 | v0.5.4 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20MPL.main.user.js) |
| 📧 **Liko的邀請通知器**<br><sub>Liko's Notification of Invites</sub><br>`Liko-NOI` | 發出好友、白單、黑單的信息! | v1.1 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20NOI.main.user.js) |
| 🆔 **WCE的個人資料分享**<br><sub>WCE Profile Share.</sub><br>`Liko-WPS` | WCE的個人資料分享，需開啟WCE的個人資料保存 | v1.1.2 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20WPS.main.user.js) |
| ⚧️ **快速切換混合&女性區**<br><sub>Region switch</sub><br>`Liko-Region_switch` | 快速切換混合&女性區 | v1.3 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Region%20switch.main.user.js) |
| 🎮 **Liko的玩具遙控器**<br><sub>Liko's Toy remote control</sub><br>`Liko-TRC` | 聊天室玩具控制 | v1.1.0 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20TRC.main.user.js) |
| 📋 **聊天室信息過濾器**<br><sub>RChat Filter Tool</sub><br>`Liko-CFT` | 聊天室信息過濾 | v1.1.3 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CFT.main.user.js) |
| 🫟 **你畫我猜(測試)**<br><sub>Draw Game(test)</sub><br>`Liko-BDG` | 可以在聊天室隨意塗鴉 | v0.3.0 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko-BDG.main.user.js) |
| 🪪 **Liko的自定義個人資料頁面背景**<br><sub>Liko's Custom Profile Background</sub><br>`Liko-CPB` | 自定義個人資料頁面背景並分享給他人 | v1.2.2 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CPB.main.user.js) |
| 💬 **Liko的對話變按鈕**<br><sub>Liko's Chat Text to Button</sub><br>`Liko-Chat_TtoB` | 聊天室信息轉按鈕，現在還多了傳送門功能!<br><sub>使用/指令、!!說話、#房名#都會變成可以點擊的按鈕，#房名#提供傳送功能</sub> | v1.1.1 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Chat%20TtoB.main.user.js) |
| 📔 **BC翻譯補丁**<br><sub>BC-translation-patch</sub><br>`Liko-BTP` | 中文的翻譯補丁，補充上遺漏翻譯 | v0.1.0 | [安裝](https://awdrrawd.github.io/BC-translation-patch/bc-translation-patch.js) · [專案網站](https://github.com/awdrrawd/BC-translation-patch) |
| 🖌️ **繪圖檢測工具**<br><sub>Draw Detection Tool</sub><br>`Liko-DDT` | 偵測 canvas & DOM 物件的屬性，支持染色與位移，並支持繪製物件功能 | v0.1.0 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20DDT.main.user.js) |
| 🧹 **Liko的解綁女僕**<br><sub>Liko's Release Maid</sub><br>`Liko-Release_Maid` | 自動解綁女僕，不過有點天然，會在意外時觸發!<br><sub>請評估自己需求，避免降低遊戲樂趣</sub> | v1.2 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Release%20Maid.main.user.js) |
| 📱 **聊天室左右介面交換**<br><sub>Chatroom UI Swap</sub><br>`Liko-CUS` | 聊天室左右介面交換：左側聊天訊息、右側人物。手動開關。 | v0.1 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko-CUS.main.user.js) |
| 🧪 **程式碼沙盒**<br><sub>Code Sandbox</sub><br>`Liko-LCS` | 在全域作用域執行測試碼，精準追蹤並還原「這個沙盒自己造成」的副作用；支援多重沙盒、可收合、可切純控制台模式 | v1.0 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20LCS.main.user.js) |
| 🔊 **文字轉語音**<br><sub>Text to Speech</sub><br>`Liko-TTS` | 聊天室信息轉語音 | v0.6.2 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20TTS.main.user.js) |

### 社群插件

| 插件 | 功能介紹 | 版本 | 連結 |
|---|---|---:|---|
| ⚡ **BC 快捷互动插件**<br><sub>BC quick-interaction</sub><br>`HT-QI` | 快捷互动插件，提供部位直选、批量执行、动作收藏、连招编排、ECHO動作匯出、自訂動作 | 持續更新 | [安裝](https://bondage-studio.github.io/QuickInteraction/assets/main.js) · [專案網站](https://github.com/bondage-studio/QuickInteraction) |
| 🥐 **ECHO的服裝拓展**<br><sub>ECHO's Expansion on cloth options</sub><br>`ECHO-Cloth` | ECHO的服裝拓展 | 持續更新 | [安裝](https://sugarchain-studio.github.io/echo-clothing-ext/bc-cloth.user.js) · [專案網站](https://github.com/SugarChain-Studio/echo-clothing-ext) |
| 🥐 **ECHO的動作拓展**<br><sub>ECHO's Expansion on activity options</sub><br>`ECHO-Activity` | ECHO的動作拓展 | 持續更新 | [安裝](https://sugarchain-studio.github.io/echo-activity-ext/bc-activity.user.js) · [專案網站](https://github.com/SugarChain-Studio/echo-activity-ext) |
| 🍪 **小酥的動作拓展**<br><sub>XS's Expansion on activity options</sub><br>`XS-Activity` | 小酥的動作拓展 | 持續更新 | [安裝](https://awdrrawd.github.io/XiaoSuActivity/main/XSActivity.js) · [專案網站](https://github.com/iceriny/XiaoSuActivity) |
| 👘 **Vivian 的 BC 随身衣柜**<br><sub>Vivian's Portable Wardrobe for BC.</sub><br>`Vivian-PWB` | 本脚本为 BC 游戏提供 随身衣柜，内置预览镜和高级服装管理功能。 | 持續更新 | [安裝](https://vivianmoonlight.github.io/Vivians-Portable-Wardrobe/ViviansPortableWardrobeLoader.user.js) · [專案網站](https://github.com/VivianMoonlight/Vivians-Portable-Wardrobe) |
| 🐇 **ULTRAbc**<br>`ULTRAbc` | 有許多輔助功能，但考慮遊戲性請自行選擇是否啟用 | 持續更新 | [安裝](https://tetris245.github.io/ultrabc.github.io/ULTRAbcloader.user.js) · [專案網站](https://github.com/tetris245/ULTRAbc) |
| 🎲 **Galia的賭博俱樂部**<br><sub>Galia's Gambling Club</sub><br>`GGC` | 增加了小遊戲、骰子和硬幣動畫、交易、趣味文字效果以及專為聊天室互動而設計的環形選單。 | 持續更新 | [安裝](https://galia-bc.github.io/galia.github.io/club-gaming/club-gaming.js) · [專案網站](https://galia-bc.github.io/galia.github.io) |
| 🧩 **Shuang的貼圖分享**<br><sub>Shuang's sticker sharing</sub><br>`Shuang-Assets` | 新增貼圖分享物品。可設定貼圖網址，設置在角色身上並分享顯示給其他人 | 持續更新 | [安裝](https://shuang-custom-assets.pages.dev/assets/main.js) · [專案網站](https://gitgud.io/yeshuang26/shuangcustomassets) |

### 修正補丁

| 插件 | 功能介紹 | 版本 | 連結 |
|---|---|---:|---|
| 💉 **物件隱藏熱修**<br><sub>Hotfix for Hidden elements</sub><br>`Fix-HHA` | 在更衣室、個人資訊、角色互動中隱藏興奮條、MPA等物件 | v0.3 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HHA.user.js) |
| 💉 **牽引補丁(測試)**<br><sub>Leash Fix(test)</sub><br>`Fix-HLF` | 修復部分牽引失敗的錯誤 | v0.17 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HLF.user.js) |
| 💉 **製作物品的擴充物品資產保護**<br><sub>Crafting Asset Recovery</sub><br>`Fix-HCR` | 在擴充資產尚未載入時保留 Craft 物品，並於資產載入後自動恢復使用 | v0.1 | [安裝](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HCR.user.js) |

## 開發參考

- [BC 插件開發指南](docs/BC插件開發指南.md)
- [自訂捲軸與拖曳捲動指南](docs/自訂捲軸與拖曳捲動指南.md)

## 授權

[MIT License](LICENSE)
