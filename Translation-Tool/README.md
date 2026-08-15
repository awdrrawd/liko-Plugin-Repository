# Translation Studio

The shortcut list in `sites.json` is loaded when `index.html` starts. Adding or removing a shortcut does not require editing the HTML.

## Add a site

Append an item to `sites`:

```json
{
  "id": "example",
  "name": "Example Translation",
  "url": "https://github.com/OWNER/REPOSITORY/tree/main/Translation",
  "enabled": true,
  "order": 50
}
```

- `id`: unique stable identifier; use it in `defaultSite` to make this entry the default.
- `name`: label shown in the shortcut selector.
- `url`: GitHub translation folder or file URL.
- `enabled`: set to `false` to hide an entry without deleting it.
- `order`: lower numbers appear first.

The published page is expected at:

`https://awdrrawd.github.io/liko-Plugin-Repository/Translation-Tool/`
