<div align="center">

## 🐈‍⬛ Liko Plugin Repository 🐈‍⬛
[![Version](https://img.shields.io/badge/PCM-v1.5.1-7F53CD?style=for-the-badge&logo=github)](https://github.com/awdrrawd/liko-Plugin-Repository)
[![License](https://img.shields.io/badge/License-MIT-A78BFA?style=for-the-badge)](LICENSE)
[![BondageClub](https://img.shields.io/badge/BondageClub-Compatible-C4B5FD?style=for-the-badge)](https://bondageprojects.elementfx.com)

</div>

---

*個人開發的 BondageClub 插件集合，透過插件管理器（PCM）統一管理，或單獨安裝所需插件。*  
*A collection of personal BondageClub plugins. Install everything at once via the Plugin Collection Manager (PCM), or install individual plugins on their own.*

---

## 📦 安裝方式 · Installation

> 插件有兩種安裝方式：
> - **使用 PCM 管理器**：一次安裝所有插件，支援啟用 / 停用、自動載入、快取加速
> - **單獨安裝**：前往 [`/Plugins`](./Plugins) 資料夾，找到想要的插件單獨安裝，無需安裝 PCM

> There are two ways to install plugins:
> - **Use PCM**: Manage all plugins from one place — enable/disable, auto-load, and cache acceleration
> - **Install individually**: Browse the [`/Plugins`](./Plugins) folder and install only what you need, no PCM required

---

### 方式一 · Option 1：Plugin Collection Manager (PCM)

#### A. 腳本管理器 · Script Manager（Tampermonkey / Violentmonkey / Userscripts）

[👉 點此安裝 PCM · Click to Install PCM](https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Plugin_Collection_Manager.user.js)

---

#### B. 書籤 · Bookmark

建立一個新書籤，將網址欄貼上以下程式碼 / Create a new bookmark and paste the following as the URL：

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

#### C. 瀏覽器控制台 · Browser Console

開啟 F12 開發者工具，在 Console 貼上 / Open F12 DevTools and paste in the Console tab：

```javascript
import(`https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Plugin_Collection_Manager.user.js?v=${(Date.now()/10000).toFixed(0)}`);
```

---

### 方式二 · Option 2：Install a Single Plugin

不想使用 PCM 的話，可以前往 [`/Plugins`](./Plugins) 資料夾直接安裝個別插件的 `.user.js` 檔案，透過腳本管理器（Tampermonkey 等）安裝即可獨立使用。

If you don't want to use PCM, head to the [`/Plugins`](./Plugins) folder and install any individual plugin's `.user.js` file directly through your script manager (e.g. Tampermonkey). Each plugin works standalone.

---

## 🔌 插件列表 · Plugin List

> 語言標示 · Language support：**EN✔️** = 完整英文支援 · full English support

---

### 🐈‍⬛ Liko 自製插件 · Liko's Own Plugins

---

#### 🐈‍⬛ Liko's Appearance editing extension. · Liko的外觀編輯拓展
> 🆔 `Liko-AEE` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-AEE.user.js)

新的服裝編輯UI，並且提供旋轉、縮放、鏡像編輯功能。  
有收納模式,方便在手機的螢幕小的場合下使用。  
此外，它還提供顏色和圖層調整功能，無需頻繁切換選單。  
The new clothing editing UI offers rotation, scaling, and mirroring editing functions.  
It has a mini mode, which is convenient for use in situations where the phone screen is small.  
Additionally, it offers coloring and layer adjustments, eliminating the need to constantly switch menus.  

---

#### 🧰 Liko's Tool · Liko的工具包
> 🆔 `Liko-Tool` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-Tool.user.js)

有許多小功能合集的工具包，但也有點不穩定。  
A collection of small utility functions — handy but somewhat unstable.

- 詳細使用說明請輸入 `/LT` 或 `/LT help` 查詢 · For usage instructions, enter `/LT` or `/LT help`

---

#### 🖼️ Liko's Image Uploader · 圖片上傳器
> 🆔 `Liko-Image_Uploader` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-Image_Uploader.user.js)

拖曳上傳圖片並分享到聊天室。  
Drag and drop images to upload and share in the chatroom.

- 圖片上傳失敗時，可以使用 `/IMG` 或 `/IMG HELP` 查閱說明 · If upload fails, use `/IMG` or `/IMG HELP` for instructions

---

#### 📖 Liko's Chat History Exporter · 聊天室書記官
> 🆔 `Liko-CHE` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-CHE.user.js)

聊天室信息轉 HTML，並且提供最多 7 天的信息救援（需要手動啟用快取功能）。  
Export chat history to HTML with message recovery for up to 7 days *(caching must be enabled manually)*.

- 包含完整的聊天記錄、時間戳和角色信息，可以搭配 Neocities 等網站上傳分享  
  Includes full chat logs, timestamps, and character info — compatible with sites like Neocities for sharing

---

#### 👗 Liko's Custom Dressing Room Background · 自訂更衣室背景
> 🆔 `Liko-CDB` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-CDB.user.js)

更衣室背景替換，並提供網格對焦。現在多了替換姿勢的功能。  
Replace the wardrobe background with grid focus assistance. Now includes a posture-change function.

---

#### 🌐 Liko's Messages Auto Translator · 自動翻譯
> 🆔 `Liko-MAT` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-MAT.user.js)

自動翻譯聊天室信息（使用 Google API）。  
Auto-translate BC chat messages using the Google Translate API.

---

#### 🎮 Liko's Toy remote control · 玩具遙控器
> 🆔 `Liko-TRC` · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-TRC.user.js)

入侵房間內其他人身上的玩具並控制它(你需要有對方的觸碰權限)  
Hacking into the toys on other people in the room and taking control of them.  
(You need to have the other party's touch permission.)  

---

#### 🎵 Liko's Music Controller · 聊天室音樂控制器
> 🆔 `Liko-CMC` · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-CMC.user.js)

支援歌詞（需要有曲名）、歌曲列表、FLAC 等格式。  
Supports lyrics (song title required), playlists, FLAC, and other audio formats.

---

#### 📧 Liko's Notification of Invites · 邀請通知器
> 🆔 `Liko-NOI` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-NOI.user.js)

發出好友、白單、黑單的通知信息！  
Sends a customizable notification message when sending a friend, whitelist, or blacklist request.

- 可以使用 `/NOI` 或 `/NOI HELP` 查閱說明 · Enter `/NOI` or `/NOI HELP` for usage instructions

---

#### 🪄 Liko's Friend Prank · 對朋友的惡作劇
> 🆔 `Liko-Prank` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-Prank.user.js)

內褲大盜鬧得 BC 社群人心惶惶！  
The underwear thief causing panic across the BC community!

> ⚠️ **注意 Warning**：這是個惡作劇插件，請謹慎使用！ This is a prank plugin — use responsibly!

- 指令 Commands：`/偷取` `/溶解` `/传送` · `/Steal` `/dissolve` `/Teleport`

---

#### 🆔 WCE Profile Share · WCE個人資料分享
> 🆔 `Liko-WPS` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-WPS.user.js)

WCE 的個人資料分享，需開啟 WCE 的個人資料保存。  
Share your WCE profile with others. Requires WCE profile saving to be enabled first.

---

#### 🎬 Liko's Automatically Create Video · 自動創建影片
> 🆔 `Liko-ACV` · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-ACV.user.js)

自動創建影片。  
Automatically create a video recording.

---

#### ⚧️ Region Switch · 快速切換混合&女性區
> 🆔 `Liko-Region_switch` · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-Region_switch.user.js)

快速切換混合區與女性區。  
Quickly switch between the mixed and female regions.

---

#### 📋 Chat Filter Tool · 聊天室信息過濾器
> 🆔 `Liko-CFT` · EN✔️ · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-CFT.user.js)

聊天室信息過濾。  
Filter messages in the chatroom.

---

#### 💬 Liko's Chat Text to Button · 對話變按鈕
> 🆔 `Liko-Chat_TtoB` · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-Chat_TtoB.user.js)

聊天室信息轉按鈕，現在還多了傳送門功能。  
Converts chat messages into clickable buttons, with a room teleport feature.

- 使用 `/指令`、`!!說話`、`#房名#` 都會變成可以點擊的按鈕，`#房名#` 提供傳送功能  
  Messages starting with `/`, `!!`, or wrapped in `#RoomName#` become buttons. `#RoomName#` teleports you to that room.

---

#### 🧹 Liko's Release Maid · 解綁女僕
> 🆔 `Liko-Release_Maid` · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-Release_Maid.user.js)

自動解綁女僕，不過有點天然，會在意外時觸發。  
An auto-release maid, though a bit naive — may trigger unexpectedly.

- 請評估自己需求，避免降低遊戲樂趣 · Consider whether this suits your playstyle before enabling

---

#### 🪪 Liko's Custom Profile Background · 自定義個人資料頁面背景
> 🆔 `Liko-CPB` · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-CPB.user.js)

自定義個人資料頁面背景並分享給他人。  
Customize your profile page background and share it with others.

---

#### 🖌️ Liko's Coordinate Drawing Tool · 座標繪製工具
> 🆔 `Liko-CDT` · [📥Download](https://github.com/awdrrawd/liko-Plugin-Repository/blob/main/Plugins/Liko-CDT.user.js)

BC 的介面 UI 定位工具，有開發需求的可以使用。  
A BC interface UI positioning tool — useful for plugin developers.

---

### 🌟 社群推薦插件 · Community Featured Plugins

*以下插件已取得開發者同意，透過 PCM 整合收錄，感謝各位作者的貢獻！*  
*All of the following have been included with the developer's permission. Thanks to all authors!*

---

#### 🥐 ECHO's Expansion on Cloth Options · ECHO的服裝拓展
> 🆔 `ECHO-Cloth` · EN✔️ · [GitHub](https://github.com/SugarChain-Studio/echo-clothing-ext) · by **SugarChain Studio**

ECHO 的服裝拓展（支援穩定版 / Beta 版切換）。  
Expands clothing options in BC *(supports stable / beta toggle)*.

---

#### 🥐 ECHO's Expansion on Activity Options · ECHO的動作拓展
> 🆔 `ECHO-Activity` · EN✔️ · [GitHub](https://github.com/SugarChain-Studio/echo-activity-ext) · by **SugarChain Studio**

ECHO 的動作拓展（支援穩定版 / Beta 版切換）。  
Expands activity options in BC *(supports stable / beta toggle)*.

---

#### 🐇 Vivian's Portable Wardrobe for Bondage Club · Vivian 的 BC 随身衣柜
> 👘 `Vivian's Portable Wardrobe for BC.` · EN✔️ · [GitHub](https://github.com/VivianMoonlight/Vivians-Portable-Wardrobe) · by **VivianMoonlight**

本脚本为 BC 游戏提供随身衣柜，内置预览镜和高级服装管理功能。  
A BC script that adds a portable wardrobe system with a preview mirror and advanced outfit management.

---

#### 🐇 ULTRAbc
> 🆔 `ULTRAbc` · EN✔️ · [GitHub](https://github.com/tetris245/ULTRAbc) · by **tetris245**

有許多輔助功能，但考慮遊戲性請自行選擇是否啟用（支援 EN / ZH 版本切換）。  
A large collection of cheats, quality-of-life improvements, and a moaner script *(supports EN / ZH toggle)*. Enable selectively to preserve your gameplay experience.

---

## 📝 注意事項 · Notes

- 插件啟用後會自動載入，或在下次刷新頁面時生效
  Plugins auto-load after enabling, or take effect on the next page refresh
- 建議根據需要選擇性啟用插件以獲得最佳體驗
  Selectively enabling plugins is recommended for the best experience
- 輸入 `/pcm help` 查看插件管理器說明；`/pcm list` 查看所有插件狀態  
  Enter `/pcm help` for manager instructions; `/pcm list` to view all plugin statuses

---

<div align="center">

❖ Made with 🐾 by **Likolisu** ❖

</div>
