# EnrollPro → ATLAS Bridge: Zero-Conflict Setup

This document explains how to launch ATLAS from EnrollPro **without modifying any EnrollPro source files**, so you can freely pull from the EnrollPro upstream repo with no merge conflicts.

---

## How it works

ATLAS already handles bridge token auth on its own side:
- When ATLAS loads with `?bridgeToken=<token>` in the URL, it captures the token into `sessionStorage` and cleans the URL.
- All ATLAS API calls then use this token for authorization against EnrollPro's JWT.
- The "Back to EnrollPro" link in the ATLAS sidebar uses `VITE_ENROLLPRO_URL` to return to the right host.

The only thing needed is a way to **generate the ATLAS URL with the current EnrollPro token** — and that can be done entirely from the browser.

---

## Option 1: Browser Bookmarklet (Recommended — no code changes)

A bookmarklet runs in the context of the EnrollPro page. It reads the auth token that EnrollPro already stores in `localStorage` under the key `auth-storage` and opens ATLAS in a new tab with the bridge token in the URL.

### Installation

1. Create a new bookmark in your browser.
2. Set the **name** to: `Open ATLAS`
3. Set the **URL** to the bookmarklet code below (replace the ATLAS host if needed):

```
javascript:(function(){try{var s=localStorage.getItem('auth-storage');if(!s){alert('Not logged into EnrollPro');return;}var data=JSON.parse(s);var token=data.state&&data.state.token;if(!token){alert('No auth token found. Please log into EnrollPro first.');return;}var atlasHost=prompt('ATLAS URL (leave blank for Tailscale)','http://100.88.55.125:5174')||'http://100.88.55.125:5174';window.open(atlasHost+'/?bridgeToken='+encodeURIComponent(token)+'&from=enrollpro','_blank');}catch(e){alert('Bridge error: '+e.message);}})()
```

### For Tailscale / fixed host (no prompt)

Replace the bookmarklet URL with this version that has the host hardcoded to the Tailscale IP:

```
javascript:(function(){try{var s=localStorage.getItem('auth-storage');if(!s){alert('Not logged into EnrollPro');return;}var data=JSON.parse(s);var token=data.state&&data.state.token;if(!token){alert('No auth token found. Please log into EnrollPro first.');return;}window.open('http://100.88.55.125:5174/?bridgeToken='+encodeURIComponent(token)+'&from=enrollpro','_blank');}catch(e){alert('Bridge error: '+e.message);}})()
```

### Usage

1. Log in to EnrollPro normally.
2. Click the **Open ATLAS** bookmarklet in your browser toolbar.
3. ATLAS opens in a new tab, already authenticated with your EnrollPro session.

---

## Option 2: Optional Conflict-Resistant EnrollPro Sidebar Link

If you prefer a sidebar link in EnrollPro and can tolerate a minimal, isolated change:

### Step 1 — Create a new file (no upstream conflict)

Create `EnrollPro/client/src/local/AtlasLink.tsx`:

```tsx
// LOCAL CUSTOMIZATION — not tracked upstream, safe to re-apply after pulls
import { ExternalLink } from "lucide-react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/shared/ui/sidebar";
import { useAuthStore } from "@/store/auth.slice";

const ATLAS_URL =
  import.meta.env.VITE_ATLAS_URL || "http://localhost:5174";

export function AtlasLink() {
  const token = useAuthStore((s) => s.token);
  if (!token) return null;
  const href = `${ATLAS_URL}/?bridgeToken=${encodeURIComponent(token)}&from=enrollpro`;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip="Open ATLAS" className="text-sm">
        <a href={href} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-4" />
          <span>ATLAS</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
```

### Step 2 — Add 2 lines to AppLayout.tsx (minimal surface)

In `EnrollPro/client/src/shared/layouts/AppLayout.tsx`, add the import at the top:

```tsx
import { AtlasLink } from "@/local/AtlasLink";
```

And render it after the last `<NavDivider>` section (inside `<SidebarMenu>`, before closing `</SidebarMenu>`):

```tsx
<NavDivider label="Integrations" />
<AtlasLink />
```

> **After upstream pulls:** If the pull causes a conflict in AppLayout.tsx, only these 2 lines need to be re-applied. The `AtlasLink.tsx` file itself is untracked by upstream and will never conflict.

---

## ATLAS `.env` Configuration for Tailscale

### `atlas-client/.env`

```env
VITE_ENROLLPRO_URL=http://100.88.55.125:5173
VITE_ENROLLPRO_API_BASE=http://100.88.55.125:5000
```

### `atlas-server/.env` (add to existing)

```env
CLIENT_URL=http://100.88.55.125:5174
ENROLLPRO_CLIENT_URL=http://100.88.55.125:5173
CORS_EXTRA_ORIGINS=http://100.88.55.125:5174,http://100.88.55.125:5173
```

---

## Connectivity Status

| Service | Host | Port | Status |
|---------|------|------|--------|
| ATLAS Backend API | 100.88.55.125 | 5001 | ✅ Reachable |
| PostgreSQL | 100.88.55.125 | 5432 | ✅ Reachable |

> ATLAS client dev server binds to `0.0.0.0` by default (`host: true` in vite.config), so it is accessible at the Tailscale IP on port 5174.
