<div align="center">

## 🐈‍⬛ Liko Plugin Repository 🐈‍⬛
[![Version](https://img.shields.io/badge/PCM-v1.5.1-7F53CD?style=for-the-badge&logo=github)](https://github.com/awdrrawd/liko-Plugin-Repository)
[![License](https://img.shields.io/badge/License-MIT-A78BFA?style=for-the-badge)](LICENSE)
[![BondageClub](https://img.shields.io/badge/BondageClub-Compatible-C4B5FD?style=for-the-badge)](https://bondageprojects.elementfx.com)

**[中文](#zh)** | **[English](#en)**

</div>

---

<a name="zh"></a>

# 🐈‍⬛ 中文說明

*個人開發的 BondageClub 插件集合，透過插件管理器（PCM）統一管理，或單獨安裝所需插件。*

---

## 📦 安裝方式

> 插件有兩種安裝方式：
> - **使用 PCM 管理器**：一次安裝所有插件，支援啟用 / 停用、自動載入、快取加速
> - **單獨安裝**：前往 [`/Plugins`](./Plugins) 資料夾，找到想要的插件單獨安裝，無需安裝 PCM

---

### 方式一：Plugin Collection Manager (PCM) · 插件管理器

#### A. 腳本管理器（Tampermonkey / Violentmonkey / Userscripts）

[👉 點此安裝 PCM](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Plugin_Collection_Manager.user.js)

---

#### B. 書籤

建立一個新書籤，將網址欄貼上以下程式碼：

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

#### C. 瀏覽器控制台

開啟 F12 開發者工具，在 Console 貼上：

```javascript
import(`https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Plugin_Collection_Manager.user.js?v=${(Date.now()/10000).toFixed(0)}`);
```

---

### 方式二：單獨安裝單一插件

不想使用 PCM 的話，可以前往 [`/Plugins`](./Plugins) 資料夾直接安裝個別插件的 `.user.js` 檔案，透過腳本管理器（Tampermonkey 等）安裝即可獨立使用。

---

## 🔌 插件列表

> 語言標示說明：**EN✔️** = 完整英文支援　**EN🔺** = 部分英文支援（主要為中文介面）

---

### 🐈‍⬛ Liko 自製插件

#### 🧰 Liko's Tool Kit · Liko的工具包
> 🆔 `Liko-Tool` · EN🔺

有許多小功能合集的工具包，但也有點不穩定。

- 詳細使用說明請輸入 `/LT` 或 `/LT help` 查詢

---

#### 🪪 Liko's Custom Profile Background · 自定義個人資料頁面背景
> 🆔 `Liko-CPB`

自定義個人資料頁面背景並分享給他人。

---

#### 🖼️ Liko's Image Uploader · 圖片上傳器
> 🆔 `Liko-Image_Uploader` · EN✔️

拖曳上傳圖片並分享到聊天室。

- 圖片上傳失敗時，可以使用 `/IMG` 或 `/IMG HELP` 查閱說明

---

#### 📖 Liko's Chat History Exporter · 聊天室書記官
> 🆔 `Liko-CHE` · EN✔️

聊天室信息轉 HTML，並且提供最多 7 天的信息救援（需要手動啟用快取功能）。

- 包含完整的聊天記錄、時間戳和角色信息，可以搭配 Neocities 等網站上傳分享

---

#### 👗 Liko's Custom Dressing Room Background · 自訂更衣室背景
> 🆔 `Liko-CDB` · EN✔️

更衣室背景替換，並提供網格對焦。現在多了替換姿勢的功能。

---

#### 🌐 Liko's Messages Auto Translator · 自動翻譯
> 🆔 `Liko-MAT` · EN✔️

自動翻譯聊天室信息（使用 Google API）。

---

#### 🎵 Liko's Music Controller · 聊天室音樂控制器
> 🆔 `Liko-CMC`

支援歌詞（需要有曲名）、歌曲列表、FLAC 等格式。

---

#### 💬 Liko's Chat Text to Button · 對話變按鈕
> 🆔 `Liko-Chat_TtoB`

聊天室信息轉按鈕，現在還多了傳送門功能。

- 使用 `/指令`、`!!說話`、`#房名#` 都會變成可以點擊的按鈕，`#房名#` 提供傳送功能

---

#### 📧 Liko's Notification of Invites · 邀請通知器
> 🆔 `Liko-NOI` · EN✔️

發出好友、白單、黑單的通知信息！

- 可以使用 `/NOI` 或 `/NOI HELP` 查閱說明

---

#### 🪄 Liko's Friend Prank · 對朋友的惡作劇
> 🆔 `Liko-Prank` · EN✔️

內褲大盜鬧得 BC 社群人心惶惶！

> ⚠️ **注意**：這是個惡作劇插件，請謹慎使用！

- 指令：`/偷取`、`/溶解`、`/传送`（或英文版 `/Steal`、`/dissolve`、`/Teleport`）

---

#### 🧹 Liko's Release Maid · 解綁女僕
> 🆔 `Liko-Release_Maid`

自動解綁女僕，不過有點天然，會在意外時觸發。

- 請評估自己需求，避免降低遊戲樂趣

---

#### 🆔 WCE Profile Share · WCE個人資料分享
> 🆔 `Liko-WPS` · EN✔️

WCE 的個人資料分享，需開啟 WCE 的個人資料保存。

---

#### 🎬 Liko's Automatically Create Video · 自動創建影片
> 🆔 `Liko-ACV`

自動創建影片。

---

#### 🖌️ Liko's Coordinate Drawing Tool · 座標繪製工具
> 🆔 `Liko-CDT`

BC 的介面 UI 定位工具，有開發需求的可以使用。

---

#### ⚧️ Region Switch · 快速切換混合&女性區
> 🆔 `Liko-Region_switch`

快速切換混合區與女性區。

---

#### 📋 Chat Filter Tool · 聊天室信息過濾器
> 🆔 `Liko-CFT` · EN✔️

聊天室信息過濾。

---

### 🌟 社群推薦插件

*以下插件已取得開發者同意，透過 PCM 整合收錄，感謝各位作者的貢獻！*

#### 🥐 ECHO's Expansion on Cloth Options · ECHO的服裝拓展
> 🆔 `ECHO-Cloth` · EN✔️ · [GitHub](https://github.com/SugarChain-Studio/echo-clothing-ext) · by **SugarChain Studio**

ECHO 的服裝拓展（支援穩定版 / Beta 版切換）。

---

#### 🥐 ECHO's Expansion on Activity Options · ECHO的動作拓展
> 🆔 `ECHO-Activity` · EN✔️ · [GitHub](https://github.com/SugarChain-Studio/echo-activity-ext) · by **SugarChain Studio**

ECHO 的動作拓展（支援穩定版 / Beta 版切換）。

---

#### 🐇 Vivian's Portable Wardrobe for Bondage Club · Vivian 的 BC 随身衣柜
> 👘 `Vivian's Portable Wardrobe for BC.` · EN✔️ · [GitHub](https://github.com/VivianMoonlight/Vivians-Portable-Wardrobe) · by **VivianMoonlight**

本脚本为 BC 游戏提供 随身衣柜，内置预览镜和高级服装管理功能。

---

#### 🐇 ULTRAbc
> 🆔 `ULTRAbc` · EN✔️ · [GitHub](https://github.com/tetris245/ULTRAbc) · by **tetris245**

有許多輔助功能，但考慮遊戲性請自行選擇是否啟用（支援 EN / ZH 版本切換）。

---

## 📝 注意事項

- 插件啟用後會自動載入，或在下次刷新頁面時生效
- 建議根據需要選擇性啟用插件以獲得最佳體驗
- 輸入 `/pcm help` 查看插件管理器說明；`/pcm list` 查看所有插件狀態

---

<a name="en"></a>

# 🐈‍⬛ English Guide

*A collection of personal BondageClub plugins. Install everything at once via the Plugin Collection Manager (PCM), or install individual plugins on their own.*

---

## 📦 Installation

> There are two ways to install plugins:
> - **Use PCM**: Manage all plugins from one place — enable/disable, auto-load, and cache acceleration
> - **Install individually**: Browse the [`/Plugins`](./Plugins) folder and install only what you need, no PCM required

---

### Option 1: Plugin Collection Manager (PCM)

#### A. Script Manager (Tampermonkey / Violentmonkey / Userscripts)

[👉 Click to Install PCM](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Plugin_Collection_Manager.user.js)

---

#### B. Bookmark

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

#### C. Browser Console

Open F12 DevTools and paste in the Console tab:

```javascript
import(`https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Plugin_Collection_Manager.user.js?v=${(Date.now()/10000).toFixed(0)}`);
```

---

### Option 2: Install a Single Plugin

If you don't want to use PCM, head to the [`/Plugins`](./Plugins) folder and install any individual plugin's `.user.js` file directly through your script manager (e.g. Tampermonkey). Each plugin works standalone.

---

## 🔌 Plugin List

> Language support: **EN✔️** = full English support　**EN🔺** = partial English support (primarily Chinese UI)

---

### 🐈‍⬛ Liko's Own Plugins

#### 🧰 Liko's Tool Kit
> 🆔 `Liko-Tool` · EN🔺

A collection of small utility functions — handy but somewhat unstable.

- For usage instructions, enter `/LT` or `/LT help`

---

#### 🪪 Liko's Custom Profile Background
> 🆔 `Liko-CPB`

Customize your profile page background and share it with others.

---

#### 🖼️ Liko's Image Uploader
> 🆔 `Liko-Image_Uploader` · EN✔️

Drag and drop images to upload and share in the chatroom.

- If upload fails, use `/IMG` or `/IMG HELP` for instructions

---

#### 📖 Liko's Chat History Exporter
> 🆔 `Liko-CHE` · EN✔️

Export chat history to HTML with message recovery for up to 7 days *(caching must be enabled manually)*.

- Includes full chat logs, timestamps, and character info — compatible with sites like Neocities for sharing

---

#### 👗 Liko's Custom Dressing Room Background
> 🆔 `Liko-CDB` · EN✔️

Replace the wardrobe background with grid focus assistance. Now includes a posture-change function.

---

#### 🌐 Liko's Messages Auto Translator
> 🆔 `Liko-MAT` · EN✔️

Auto-translate BC chat messages using the Google Translate API.

---

#### 🎵 Liko's Music Controller
> 🆔 `Liko-CMC`

Supports lyrics (song title required), playlists, FLAC, and other audio formats.

---

#### 💬 Liko's Chat Text to Button
> 🆔 `Liko-Chat_TtoB`

Converts chat messages into clickable buttons, with a room teleport feature.

- Messages starting with `/`, `!!`, or wrapped in `#RoomName#` become buttons. `#RoomName#` teleports you to that room.

---

#### 📧 Liko's Notification of Invites
> 🆔 `Liko-NOI` · EN✔️

Sends a customizable notification message when sending a friend, whitelist, or blacklist request.

- Enter `/NOI` or `/NOI HELP` for usage instructions

---

#### 🪄 Liko's Friend Prank
> 🆔 `Liko-Prank` · EN✔️

The underwear thief causing panic across the BC community!

> ⚠️ **Warning**: This is a prank plugin — use responsibly!

- Commands: `/Steal`, `/dissolve`, `/Teleport`

---

#### 🧹 Liko's Release Maid
> 🆔 `Liko-Release_Maid`

An auto-release maid, though a bit naive — may trigger unexpectedly.

- Consider whether this suits your playstyle before enabling

---

#### 🆔 WCE Profile Share
> 🆔 `Liko-WPS` · EN✔️

Share your WCE profile with others. Requires WCE profile saving to be enabled first.

---

#### 🎬 Liko's Automatically Create Video
> 🆔 `Liko-ACV`

Automatically create a video recording.

---

#### 🖌️ Liko's Coordinate Drawing Tool
> 🆔 `Liko-CDT`

A BC interface UI positioning tool — useful for plugin developers.

---

#### ⚧️ Region Switch
> 🆔 `Liko-Region_switch`

Quickly switch between the mixed and female regions.

---

#### 📋 Chat Filter Tool
> 🆔 `Liko-CFT` · EN✔️

Filter messages in the chatroom.

---

### 🌟 Community Featured Plugins

*All of the following have been included with the developer's permission. Thanks to all authors!*

#### 🥐 ECHO's Expansion on Cloth Options
> 🆔 `ECHO-Cloth` · EN✔️ · [GitHub](https://github.com/SugarChain-Studio/echo-clothing-ext) · by **SugarChain Studio**

Expands clothing options in BC *(supports stable / beta toggle)*.

---

#### 🥐 ECHO's Expansion on Activity Options
> 🆔 `ECHO-Activity` · EN✔️ · [GitHub](https://github.com/SugarChain-Studio/echo-activity-ext) · by **SugarChain Studio**

Expands activity options in BC *(supports stable / beta toggle)*.

---

#### 🐇 ULTRAbc
> 🆔 `ULTRAbc` · EN✔️ · [GitHub](https://github.com/tetris245/ULTRAbc) · by **tetris245**

A large collection of cheats, quality-of-life improvements, and a moaner script *(supports EN / ZH toggle)*. Enable selectively to preserve your gameplay experience.

---

#### 🐇 Vivian's Portable Wardrobe for Bondage Club
> 👘 `Vivian's Portable Wardrobe for BC.` · EN✔️ · [GitHub](https://github.com/VivianMoonlight/Vivians-Portable-Wardrobe) · by **VivianMoonlight**

A BC script that adds a portable wardrobe system with a preview mirror and advanced outfit management.

---

## 📝 Notes

- Plugins auto-load after enabling, or take effect on the next page refresh
- Selectively enabling plugins is recommended for the best experience
- Enter `/pcm help` for manager instructions; `/pcm list` to view all plugin statuses

---

<div align="center">

❖ Made with 🐾 by **Likolisu** ❖

</div>
