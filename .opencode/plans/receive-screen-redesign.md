# Receive Screen Redesign Plan

## Problem
`receive.tsx` has a different layout than `pay-nfc.tsx`. It shows a "START RECEIVING" button flow instead of immediately displaying the NFC card UI with status.

## Solution
Restructure `receive.tsx` to match `pay-nfc.tsx` layout:
- Header with back button and "Bump Wallet" title
- NFC card with icon, dots pattern, wave bars (animated)
- Title card showing status (READY TO RECEIVE, RECEIVING, etc.)
- Cancel button (when active)
- Subtitle card with instructions

## Files to Modify

### 1. `/Users/george/Workspace/project-bump/app/receive.tsx`

**Layout Changes:**
- Remove ScrollView, use flat View structure
- Add header matching `pay-nfc.tsx` (back button, title, placeholder)
- Add NfcIcon component (using MaterialCommunityIcons "nfc")
- Add DotsPattern component (copy from pay-nfc.tsx)
- Add AnimatedWaveBars component (copy from pay-nfc.tsx)
- Replace main content with card-based layout:
  - NFC card (square, with dots pattern, NFC icon circle, wave bars)
  - Amount card (show "READY TO RECEIVE" or amount when known)
  - Title card (status: READY, RECEIVING, VERIFYING, CLAIMING, SUCCESS, ERROR)
  - Cancel button (when in waiting_tap/receiving/verifying/claiming states)
  - Subtitle card (instructions)

**State Flow Changes:**
- Start in "ready" state immediately (not "idle")
- Remove "START RECEIVING" button - NFC reader starts on mount
- On mount: start NFC reader automatically
- States: ready → receiving → verifying → claiming → success/error

**Haptics Strengthening:**
- On state transitions: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)`
- Periodic feedback in ready state: Change from Light to Heavy
- On success: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`
- On error: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)`
- On cancel: Already Heavy, keep it

**Color Theme:**
- Background: `COLORS.primaryBlue` (blue)
- Cards: `COLORS.surface` (white) with black borders
- NFC circle: `COLORS.surfaceInverted` (black) with white icon
- Status-dependent colors on title card (same as current)

### 2. `/Users/george/Workspace/project-bump/app/pay-nfc.tsx`

**Haptics Strengthening:**
- Line 211: Change `Haptics.ImpactFeedbackStyle.Light` to `Haptics.ImpactFeedbackStyle.Heavy`
- Add haptic on state transitions to processing, success, error

## Implementation Order

1. Copy shared components from `pay-nfc.tsx` to `receive.tsx` (NfcIcon, DotsPattern, AnimatedWaveBars)
2. Restructure `receive.tsx` layout to card-based design
3. Update state flow to auto-start NFC reader on mount
4. Apply `COLORS.primaryBlue` background
5. Strengthen haptics on both pages
6. Test state transitions and visual consistency
