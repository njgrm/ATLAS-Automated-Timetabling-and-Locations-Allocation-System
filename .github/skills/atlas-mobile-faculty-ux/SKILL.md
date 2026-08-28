---
name: atlas-mobile-faculty-ux
description: Mobile-first UX/UI skill for the ATLAS faculty portal. Apply to every page under /my/*, FacultyPreferences, FacultyRoomPreferences, MyDashboard, and the AppShell when targeting faculty users. Covers layout, navigation, bottom sheets, step wizards, touch ergonomics, and connectivity state.
argument-hint: describe target page, faculty action being modelled, and any existing component inventory
user-invocable: true
---

# ATLAS Mobile Faculty UX Skill

> Source-verified against: shadcn/ui v4, framer-motion (grx7/framer-motion), Vaul drawer (vaul.emilkowal.ski), ATLAS AppShell current implementation.

---

## 1. When to Apply This Skill

Apply whenever:
- Building or modifying any page under `/my/*` (dashboard, preferences, room requests).
- Updating `AppShell.tsx` navigation for faculty routes.
- Implementing forms, selection flows, or review/submit actions used by non-technical faculty on phones.
- Deciding between Sheet, Drawer, Dialog, or inline panel patterns.

Do **not** skip this skill for "small" tweaks. Mobile regressions happen in small edits.

---

## 2. Core Philosophy

Faculty users are **non-technical school teachers primarily on phones**. Every decision must serve that user.

| Principle | Rule |
|-----------|------|
| **Touch first** | No interaction target smaller than 44 × 44 px |
| **No grids on phones** | Stacked vertical cards only below `lg` breakpoint |
| **Bottom-anchored actions** | Primary CTA always `fixed bottom-0` or inside a bottom sheet |
| **One thing at a time** | Step wizards over dense matrix forms |
| **Plain language** | No technical jargon in faculty-facing copy |
| **Always show state** | Sync status, phase, fallback notices are never hidden |

---

## 3. Layout Architecture

### 3.1 Root Shell Container (DO NOT CHANGE)
```tsx
// AppShell root — protects no-scroll architecture
<div className="flex flex-col h-[calc(100svh-3.5rem)]">
  {/* mobile top bar */}
  {/* main scrolling region */}
  <main className="flex-1 min-h-0 overflow-auto">
    <Outlet />
  </main>
</div>
```

### 3.2 Page Content Wrapper
```tsx
// Every faculty page:
<div className="flex flex-col gap-4 p-4 max-w-lg mx-auto lg:max-w-4xl lg:p-6">
  {/* status banners first */}
  {/* page heading */}
  {/* content cards */}
  {/* bottom padding for fixed CTAs */}
  <div className="pb-24" /> {/* clears fixed bottom bar */}
</div>
```

---

## 4. Mobile Navigation Pattern

### 4.1 Top App Bar (mobile only, `< lg`)
```tsx
// Pattern used in AppShell.tsx — replicate for faculty shell
<header className="lg:hidden sticky top-0 z-30 flex items-center gap-2 px-3 h-14 bg-background/95 backdrop-blur border-b">
  {/* hamburger */}
  <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)}>
    <Menu className="size-5" />
  </Button>

  {/* route title centred */}
  <span className="flex-1 text-center text-sm font-semibold truncate">
    {currentRouteTitle}
  </span>

  {/* connectivity chip — always visible */}
  <ConnectivityChip status={connectivityStatus} />
</header>
```

### 4.2 Connectivity Chip
```tsx
// Inline chip — do NOT use a Card for this
function ConnectivityChip({ status }: { status: 'online' | 'offline' | 'syncing' }) {
  const map = {
    online:  { icon: Wifi,    label: 'Online',  cls: 'bg-green-50 text-green-700 border-green-200' },
    offline: { icon: WifiOff, label: 'Offline', cls: 'bg-red-50 text-red-700 border-red-200' },
    syncing: { icon: Loader2, label: 'Syncing', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse' },
  }[status];
  return (
    <motion.span
      key={status}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", map.cls)}
    >
      <map.icon className="size-3" />
      {map.label}
    </motion.span>
  );
}
```

### 4.3 Overlay Drawer (faculty nav on mobile)
```tsx
// framer-motion overlay — not a shadcn Sheet for nav
<AnimatePresence>
  {drawerOpen && (
    <>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-40 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setDrawerOpen(false)}
      />
      <motion.nav
        key="drawer"
        className="fixed inset-y-0 left-0 z-50 w-72 bg-background shadow-xl flex flex-col"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
      >
        {/* school branding header */}
        {/* faculty nav items — large tap targets */}
        {/* sign-out footer */}
      </motion.nav>
    </>
  )}
</AnimatePresence>
```

**Key rules:**
- Faculty portal shows ONLY facultyNav items in the drawer; never mixing admin nav on faculty routes.
- Each nav item inside the drawer: `min-h-[3rem] text-base px-4`.

---

## 5. Bottom Sheet Pattern (shadcn Drawer / Vaul)

Use `<Drawer>` (shadcn/ui — backed by Vaul) whenever you need:
- A review + submit confirmation step on mobile.
- Selection of a single item from a long list.
- Progressive content that the user scrolls before acting.

```tsx
// shadcn/ui Drawer import
import {
  Drawer, DrawerClose, DrawerContent,
  DrawerDescription, DrawerFooter,
  DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/ui/drawer";

// Usage: review + submit bottom sheet
<Drawer>
  <DrawerTrigger asChild>
    <Button className="w-full min-h-[3rem]">Review & Submit</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Confirm Room Request</DrawerTitle>
      <DrawerDescription>Please review before submitting.</DrawerDescription>
    </DrawerHeader>
    <div className="px-4 pb-4 space-y-3 overflow-y-auto max-h-[60svh]">
      {/* review content */}
    </div>
    <DrawerFooter>
      <Button onClick={handleSubmit} className="w-full min-h-[3rem]">Submit Request</Button>
      <DrawerClose asChild>
        <Button variant="outline" className="w-full">Cancel</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

### 5.1 Snap-point Drawer (for long content)
Use Vaul's `snapPoints` when the drawer has two meaningful partial states (e.g. short summary / full detail):

```tsx
// Via shadcn Drawer props — passed through to Vaul
<Drawer snapPoints={['148px', '355px', 1]} fadeFromIndex={2}>
  <DrawerContent>
    {/* drag handle area at top */}
    <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-muted" />
    {/* scrollable body */}
    <div className="overflow-y-auto px-4 pb-8">
      {/* content */}
    </div>
  </DrawerContent>
</Drawer>
```

### 5.2 Do NOT use Sheet for bottom-anchored mobile actions
- `<Sheet side="bottom">` lacks the Vaul drag-to-dismiss gesture and snap physics.
- Use `<Sheet>` only for side panels (filter, detail) on desktop — not for faculty action confirmations.
- Use `<Drawer>` for any bottom-anchored interaction on mobile.

---

## 6. Step Wizard Pattern (AnimatePresence)

For multi-step flows (e.g. room request: pick class → pick room → review):

### 6.1 Step Indicator (pill chips)
```tsx
// Always show at top of step content — not in a Card header
<div className="flex items-center gap-2 mb-4">
  {steps.map((label, i) => (
    <span
      key={i}
      className={cn(
        "flex-1 text-center text-xs font-medium py-1 rounded-full border",
        i === currentStep
          ? "bg-primary text-primary-foreground border-primary"
          : i < currentStep
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-muted text-muted-foreground border-transparent"
      )}
    >
      {i + 1}. {label}
    </span>
  ))}
</div>
```

### 6.2 Animated Step Panel
```tsx
// Slide transition between steps using AnimatePresence + direction
const direction = stepDelta >= 0 ? 1 : -1; // +1 forward, -1 back

<AnimatePresence mode="wait" custom={direction} initial={false}>
  <motion.div
    key={currentStep}
    custom={direction}
    variants={{
      enter:  (d: number) => ({ x: d > 0 ? "50%"  : "-50%", opacity: 0 }),
      center: { x: 0, opacity: 1 },
      exit:   (d: number) => ({ x: d > 0 ? "-50%" : "50%",  opacity: 0 }),
    }}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{ type: "tween", duration: 0.22, ease: "easeInOut" }}
    className="w-full"
  >
    {stepContent[currentStep]}
  </motion.div>
</AnimatePresence>
```

### 6.3 Step Navigation Buttons (bottom-anchored)
```tsx
// Fixed to bottom to keep thumb-accessible
<div className="fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur border-t px-4 py-3 flex gap-3">
  {currentStep > 0 && (
    <Button variant="outline" className="flex-1 min-h-[3rem]" onClick={prevStep}>
      Back
    </Button>
  )}
  <Button className="flex-1 min-h-[3rem]" onClick={nextStep} disabled={!canAdvance}>
    {currentStep < steps.length - 1 ? "Next" : "Review"}
  </Button>
</div>
```

---

## 7. Selection Card Pattern (mobile room/class picker)

For any "pick one from a list" interaction — never use a native `<select>` or desktop matrix:

```tsx
// Large selectable card — 44px+ tap target automatically from py-4
<button
  type="button"
  onClick={() => onSelect(item)}
  className={cn(
    "w-full text-left rounded-xl border-2 p-4 transition-colors",
    "flex items-start gap-3",
    selected === item.id
      ? "border-primary bg-primary/5"
      : "border-border hover:border-primary/40 active:bg-muted"
  )}
>
  <div className={cn(
    "mt-0.5 size-5 rounded-full border-2 flex-shrink-0",
    selected === item.id ? "border-primary bg-primary" : "border-muted-foreground/40"
  )} />
  <div className="flex-1 min-w-0">
    <p className="text-sm font-semibold leading-tight truncate">{item.label}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{item.sublabel}</p>
  </div>
  {item.badge && <Badge variant="outline" className="text-xs">{item.badge}</Badge>}
</button>
```

---

## 8. Status Banner Priority (faculty pages)

Render banners in this strict priority order — never collapse them into a single notice:

```tsx
// 1. Offline/sync warning (highest)
{isOffline && <OfflineBanner />}

// 2. Active outbox (pending syncs)
{outboxCount > 0 && <SyncPendingBanner count={outboxCount} />}

// 3. Phase/submission notice
{phaseNotice && <PhaseBanner message={phaseNotice} />}

// 4. Fallback school-year inference
{schoolYearNotice && <FallbackBanner message={schoolYearNotice} />}
```

Banner component — never a large Card:
```tsx
function PhaseBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-sm text-yellow-800">
      <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
```

---

## 9. Preference Form Mobile Patterns

### 9.1 Day×Time Grid → Collapsed Card Stack
On mobile, never render a day×time matrix. Convert to collapsed day rows:

```tsx
// Mobile: one card per day, tappable to expand time slots
<div className="space-y-2">
  {DAYS.map(day => (
    <Collapsible key={day.value}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-card text-sm font-medium min-h-[3rem]">
          <span>{day.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{preferenceCount(day.value)} set</span>
            <ChevronDown className="size-4 transition-transform ui-open:rotate-180" />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-1 px-1">
          {timeSlots.map(slot => (
            <TimeSlotRow key={slot.id} slot={slot} day={day.value} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  ))}
</div>
```

### 9.2 Time Slot Row
```tsx
function TimeSlotRow({ slot, day }: { slot: TimeSlot; day: DayOfWeek }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-background">
      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
        {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
      </span>
      <div className="flex-1 flex gap-1.5">
        {PREF_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPref(day, slot.id, opt.value)}
            className={cn(
              "flex-1 text-xs py-1.5 rounded-md border font-medium transition-colors",
              currentPref === opt.value ? opt.activeClass : "bg-background text-muted-foreground"
            )}
          >
            {opt.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 10. Touch Ergonomics Checklist

Before shipping any faculty page, verify:

| Check | Rule |
|-------|------|
| All buttons | `min-h-[3rem]` (48px) |
| All form inputs | `text-base` (prevents iOS zoom on focus) |
| List items / cards | `py-3` or `py-4` minimum vertical padding |
| Sticky/fixed elements | Padded with `pb-safe-area-inset-bottom` or equivalent |
| Scrollable lists | `flex-1 min-h-0 overflow-y-auto` — never height on a parent that creates overflow |
| No global scrollbar | Root element must never cause `document.body` to scroll |
| No native `<select>` | Always `<Select>` from `@/ui/select` |
| No raw `<button className="...">` | Always `<Button>` from `@/ui/button` |
| No `<details>` / `title` | Use `<Tooltip>`, `<HoverCard>`, or `<Collapsible>` |
| Tap feedback | All interactive elements have `active:` state (scale or bg change) |

---

## 11. Framer Motion Animation Reference

### Page/step transitions
```tsx
// Shared variants object — define once per page component
const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// Wrap route outlet or page body
<motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
  {children}
</motion.div>
```

### List item stagger (for selection cards)
```tsx
<motion.div
  key={item.id}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.04 }}
>
  <SelectionCard item={item} />
</motion.div>
```

### Dismissible drag gesture (for banners/toasts)
```tsx
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.3}
  onDragEnd={(_, info) => {
    if (Math.abs(info.velocity.x) > 400) onDismiss();
  }}
>
  {children}
</motion.div>
```

---

## 12. Component Selection Quick Reference

| Need | Use |
|------|-----|
| Bottom-anchored confirm/review | `<Drawer>` (shadcn — Vaul) |
| Side filter panel (desktop) | `<Sheet side="right">` |
| Overlay drawer nav (mobile) | `framer-motion` overlay div (not Sheet) |
| Pick one from list | Selectable card grid (section 7) |
| Multi-step flow | `AnimatePresence mode="wait"` + step indicator (section 6) |
| Day×time preferences | Collapsible day rows (section 9) |
| Status chip | Inline chip span (section 4.2) |
| Confirmation modal | `<ConfirmationModal>` from `@/ui/confirmation-modal` |
| Contextual help | `<Tooltip>` or `<HoverCard>` — never `title` attr |

---

## 13. Anti-Patterns (FORBIDDEN on Faculty Pages)

```tsx
// ❌ Native select
<select>...</select>

// ❌ Desktop matrix on mobile
<div className="grid grid-cols-6">  // no breakpoint guard

// ❌ Large Card for a single metric
<Card><CardContent>3 pending</CardContent></Card> // use inline badge or chip

// ❌ Tiny button
<button className="text-xs px-1">Submit</button>

// ❌ Sheet for mobile bottom action
<Sheet side="bottom">  // use Drawer instead

// ❌ Global scrollbar
<div style={{ height: '100vh', overflowY: 'auto' }}>  // breaks no-scroll arch

// ❌ Technical jargon in faculty copy
"School year context inferred from fallback strategy"  // write "Showing current school year"
```

---

## 14. Faculty Page Inventory and Improvement Targets

| Page | Mobile Issues to Fix | Pattern to Apply |
|------|---------------------|-----------------|
| `MyDashboard.tsx` | Banner order, card tap targets | §8 banners, §7 selection cards |
| `FacultyPreferences.tsx` | Day×time matrix unreadable on phone | §9 collapsible day rows |
| `FacultyRoomPreferences.tsx` | Desktop grid bleeds to mobile | §6 step wizard + §5 drawer review |
| `AppShell.tsx` (faculty) | Sidebar visible on phone | §4 mobile top bar + overlay drawer |

---

## 15. Implementation Order for a Fresh Faculty Page

1. Wrap page in `flex flex-col gap-4 p-4 max-w-lg mx-auto` container with `pb-24` tail.
2. Render banners in priority order (§8).
3. Build content as stacked vertical cards — zero desktop-only grids.
4. For any selection flow → step wizard (§6) with selectable cards (§7).
5. For any confirm/submit → bottom Drawer (§5).
6. Add `AnimatePresence` page entrance (§11).
7. Audit against touch checklist (§10) before commit.
