<div align="center">

## 🐈‍⬛ Liko Plugin Repository 🐈‍⬛
[![Version](https://img.shields.io/badge/PCM-v1.5.1-7F53CD?style=for-the-badge&logo=github)](https://github.com/awdrrawd/liko-Plugin-Repository)
[![License](https://img.shields.io/badge/License-MIT-A78BFA?style=for-the-badge)](LICENSE)
[![BondageClub](https://img.shields.io/badge/BondageClub-Compatible-C4B5FD?style=for-the-badge)](https://bondageprojects.elementfx.com)

**中文** | **English**

*A collection of personal BondageClub plugins, managed via Liko's Plugin Collection Manager.*  
*彙整了一些個人開發的 BondageClub 小插件，透過 Liko 的插件管理器進行管理。*

</div>

---

## 📦 Plugin Collection Manager (PCM) · 插件管理器

> 使用 PCM 一鍵管理所有插件，支援啟用 / 停用、自動載入、快取加速。  
> Use PCM to manage all plugins with one click — enable/disable, auto-load, and cache acceleration.

<div align="center">

### 🔧 安裝方式 · Installation

</div>

#### 1. Script Manager · 腳本管理器
> Tampermonkey、Violentmonkey、Userscripts 等

[👉 點此安裝 / Click to Install](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Plugin_Collection_Manager.user.js)

---

#### 2. Bookmark · 書籤

建立一個新書籤，將網址欄貼上以下程式碼：  
Create a new bookmark and paste the following as the URL:

```javascript
javascript:(function(){
  var s=document.createElement('script');
  s.src="https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Plugin_Collection_Manager.user.js?"+Date.now();
  s.type="text/javascript";
  s.crossOrigin="anonymous";
  document.head.appendChild(s);
})();
```

---

#### 3. Browser Console · 瀏覽器控制台

開啟 F12 開發者工具，在 Console 貼上：  
Open F12 DevTools, paste in Console:

```javascript
import(`https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Plugin_Collection_Manager.user.js?v=${(Date.now()/10000).toFixed(0)}`);
```

---

<div align="center">

## 🔌 插件列表 · Plugin List

</div>

<div align="center">

### 🐈‍⬛ Liko 自製插件 · Liko's Own Plugins

</div>

### 🧰 Liko's Tool Kit · Liko的工具包
> 🆔 `Liko-Tool` · EN🔺

有許多小功能合集的工具包，但也有點不穩定。  
A collection of small utility functions, but somewhat unstable.

- 詳細使用說明請輸入 `/LT` 或 `/LT help` 查詢
- For detailed usage instructions, please enter `/LT` or `/LT help`

---

### 🪪 Liko's Custom Profile Background · Liko的自定義個人資料頁面背景
> 🆔 `Liko-CPB`

自定義個人資料頁面背景並分享給他人。  
Customize profile page background and share it with others.

---

### 🖼️ Liko's Image Uploader · Liko的圖片上傳器
> 🆔 `Liko-Image_Uploader` · EN✔️

拖曳上傳圖片並分享到聊天室。  
Drag and drop image upload and share to chatroom.

- 圖片上傳失敗時，可以使用 `/IMG` 或 `/IMG HELP` 查閱說明
- If the image fails to upload, use `/IMG` or `/IMG HELP` for instructions

---

### 📖 Liko's Chat History Exporter · Liko的聊天室書記官
> 🆔 `Liko-CHE`

聊天室信息轉 HTML，並且提供最多 7 天的信息救援（需要手動啟用快取功能）。  
Convert chat history to HTML and provides message recovery for up to 7 days. *(The caching feature requires manual activation.)*

- 包含完整的聊天記錄、時間戳和角色信息，可以搭配 Neocities 等網站上傳分享
- Includes complete chat logs, timestamps and character info, compatible with sites like Neocities for sharing

---

### 👗 Liko's Custom Dressing Room Background · Liko的自訂更衣室背景
> 🆔 `Liko-CDB` · EN✔️

更衣室背景替換，並提供網格對焦。現在多了替換姿勢的功能。  
Replace wardrobe background with grid focus assistance. Now includes a posture-change function.

---

### 🌐 Liko's Messages Auto Translator · Liko的自動翻譯
> 🆔 `Liko-MAT` · EN✔️

自動翻譯（使用 Google API）。  
Auto translate BC chat messages using Google API.

---

### 🎵 Liko's Music Controller · Liko的聊天室音樂控制器
> 🆔 `Liko-CMC`

支援歌詞（需要有曲名）、歌曲列表、flac 等格式。  
Supports lyrics (song title required), playlists, FLAC, and other audio formats.

---

### 💬 Liko's Chat Text to Button · Liko的對話變按鈕
> 🆔 `Liko-Chat_TtoB`

聊天室信息轉按鈕，現在還多了傳送門功能。  
Convert chat messages to buttons, now with portal/teleport feature.

- 使用 `/指令`、`!!說話`、`#房名#` 都會變成可以點擊的按鈕，`#房名#` 提供傳送功能
- Commands starting with `/`, `!!` for speech, and `#RoomName#` will become clickable buttons. `#RoomName#` provides a teleport function.

---

### 📧 Liko's Notification of Invites · Liko的邀請通知器
> 🆔 `Liko-NOI` · EN✔️

發出好友、白單、黑單的通知信息！  
Customize the notification message when sending a friend, whitelist, or blacklist request.

- 可以使用 `/NOI` 或 `/NOI HELP` 查閱說明
- For detailed usage, enter `/NOI` or `/NOI HELP`

---

### 🪄 Liko's Friend Prank · Liko對朋友的惡作劇
> 🆔 `Liko-Prank` · EN✔️

內褲大盜鬧得 BC 社群人心惶惶！  
The underwear thief causing panic in the BC community!

> ⚠️ **注意 / Warning**：這是個惡作劇插件，請謹慎使用！  
> This is a prank plugin, use with caution!

- 指令 / Commands：`/偷取`、`/溶解`、`/传送` / `/Steal`、`/dissolve`、`/Teleport`

---

### 🧹 Liko's Release Maid · Liko的解綁女僕
> 🆔 `Liko-Release_Maid`

自動解綁女僕，不過有點天然，會在意外時觸發。  
Auto-release maid, but a bit naive and may trigger unexpectedly.

- 請評估自己需求，避免降低遊戲樂趣
- Please consider your own needs to avoid diminishing the enjoyment of the game

---

### 🆔 WCE Profile Share · WCE的個人資料分享
> 🆔 `Liko-WPS`· EN✔️

WCE 的個人資料分享，需開啟 WCE 的個人資料保存。  
WCE Profile Share — requires WCE profile saving to be enabled.

---

### 🎬 Liko's Automatically Create Video · Liko的自動創建影片
> 🆔 `Liko-ACV`

自動創建影片。  
Automatically create video.

---

### 🖌️ Liko's Coordinate Drawing Tool · Liko的座標繪製工具
> 🆔 `Liko-CDT`

BC 的介面 UI 定位工具，有開發需求的可以使用。  
BC interface UI positioning tool for developers.

---

### ⚧️ Region Switch · 快速切換混合&女性區
> 🆔 `Liko-Region_switch`

快速切換混合區與女性區。  
Quickly switch between mixed and female regions.

---

### 📋 Chat Filter Tool · 聊天室信息過濾器
> 🆔 `Liko-CFT` · EN✔️

聊天室信息過濾。  
Chat room message filtering.

---

<div align="center">

### 🌟 社群推薦插件 · Community Featured Plugins

*以下是取得同意開發者同意，透過 PCM 整合收錄，感謝各位作者的貢獻！*  
*All of the following have been agreed to by the developer and integrated via PCM. Thanks to all authors!*

</div>

### 🥐 ECHO's Expansion on Cloth Options · ECHO的服裝拓展
> 🆔 `ECHO-Cloth` · EN✔️ · [GitHub](https://github.com/SugarChain-Studio/echo-clothing-ext) · by **SugarChain Studio**

ECHO 的服裝拓展（支援穩定版 / Beta 版切換）。  
ECHO's Expansion on cloth options *(supports stable / beta toggle)*.

---

### 🥐 ECHO's Expansion on Activity Options · ECHO的動作拓展
> 🆔 `ECHO-Activity` · EN✔️ · [GitHub](https://github.com/SugarChain-Studio/echo-activity-ext) · by **SugarChain Studio**

ECHO 的動作拓展（支援穩定版 / Beta 版切換）。  
ECHO's Expansion on activity options *(supports stable / beta toggle)*.

---

### 🐇 ULTRAbc
> 🆔 `ULTRAbc` · EN✔️ · [GitHub](https://github.com/tetris245/ULTRAbc) · by **tetris245**

有許多輔助功能，但考慮遊戲性請自行選擇是否啟用（支援 EN / ZH 版本切換）。  
A large collection of cheats, quality of life improvements, and a moaner script *(supports EN / ZH toggle)*.

---

<div align="center">

## 📝 注意事項 · Notes

</div>

- 插件啟用後會自動載入，或在下次刷新頁面時生效
- Plugins will auto-load after enabling, or take effect on next page refresh
- 建議根據需要選擇性啟用插件以獲得最佳體驗
- Recommend selectively enabling plugins for the best experience
- 輸入 `/pcm help` 查看插件管理器說明；`/pcm list` 查看所有插件狀態
- Enter `/pcm help` for manager instructions; `/pcm list` to view all plugin statuses

---

<div align="center">

❖ Made with 🐾 by **Likolisu** ❖

</div>
