# liko-Plugin-Repository
彙整了一些個人開發的BondageClub小插件，可以使用以下插件進行管理

# 安装
1.**脚本管理器** (Tampermonkey 等)
[插件](https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-Plugin_Collection_Manager.user.js)

2.**書籤**
```javascript:(function(){
  var s=document.createElement('script');
  s.src="https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/Liko-Plugin_Collection_Manager.user.js?"+Date.now();
  s.type="text/javascript";
  s.crossOrigin="anonymous";
  document.head.appendChild(s);
})();```

3.**控制台**
`import(`https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/Liko-Plugin_Collection_Manager.user.js?v=${(Date.now()/10000).toFixed(0)}`);`
