# Pay NFC Screen Redesign v2

## Issues to Fix

1. **Wrong icon** - Using emoji 📶 instead of proper NFC/contactless icon
2. **Missing dots pattern** - The NFC card area needs radial-gradient dots overlay (10% opacity)
3. **Wrong structure** - Everything is inside the main card; need to separate NFC card from amount/title cards
4. **Static wave bars** - Bars should animate (pulse/scale like equalizer)
5. **Missing checkmark** - "READY TO SEND" needs green checkmark next to title

## Correct Layout (Matching HTML)

```
┌─────────────────────────────────┐
│  ← BACK    [Bump Wallet]    ?   │  Header (outside card)
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │   • • • • • • • • • • •   │  │  Dots pattern (10% opacity)
│  │   • • • • • • • • • • •   │  │
│  │       ┌─────────┐          │  │
│  │       │  NFC    │          │  │  NFC icon in circle
│  │       │  ICON   │          │  │  (with shadow)
│  │       └─────────┘          │  │
│  │                           │  │
│  │    ▌▐█▐▌                 │  │  Animated wave bars
│  │                           │  │  (inverted: white/yellow on dark)
│  └───────────────────────────┘  │
│                                  │  Large white square card (aspect-square)
└─────────────────────────────────┘

     ┌─────────────────────┐
     │   10.00 USDC        │  Amount card (below NFC card)
     └─────────────────────┘

     ┌─────────────────────┐
     │ ✓ READY TO SEND     │  Title card with checkmark
     └─────────────────────┘

     ┌─────────────────────┐
     │ Hold near receiver  │  Subtitle card
     └─────────────────────┘

        [ CANCEL ]            Bottom button

```

## Implementation Details

### 1. Create Custom NFC Icon Component

Use View elements to create concentric arcs (like contactless symbol):
- A circle with 3 partial arcs radiating outward
- Or use `Ionicons` with `cellular` or `wifi` rotated

```tsx
function NfcIcon({ size = 48, color = "#fff" }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Three concentric arcs using border radius */}
      <View style={[styles.nfcArc, { width: size * 0.3, height: size * 0.3, borderColor: color }]} />
      <View style={[styles.nfcArc, { width: size * 0.5, height: size * 0.5, borderColor: color }]} />
      <View style={[styles.nfcArc, { width: size * 0.7, height: size * 0.7, borderColor: color }]} />
    </View>
  );
}
```

Or use: `<Ionicons name="cellular" size={48} color="white" />` rotated 90deg

### 2. Animated Wave Bars (Pulse/Equalizer Effect)

```tsx
function AnimatedWaveBars() {
  const bars = [32, 48, 64, 48, 32].map((h, i) => {
    const anim = useRef(new Animated.Value(1)).current;
    
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.timing(anim, {
            toValue: 1.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, []);
    
    return (
      <Animated.View
        key={i}
        style={[
          styles.waveBar,
          { height: h, transform: [{ scaleY: anim }] }
        ]}
      />
    );
  });
  
  return <View style={styles.waveBars}>{bars}</View>;
}
```

### 3. Dots Pattern Overlay

Use a PNG image or create via:
- Multiple small View circles (expensive)
- Or use `expo-linear-gradient` with custom pattern
- Or simply: `backgroundColor` with a repeating pattern (not natively supported)

**Best approach:** Create a simple dots pattern as a transparent PNG and include it as an Image with 10% opacity.

Alternative: Skip dots for now and add later if needed.

### 4. Inverted Wave Bars

Bars should be light colored (white/yellow) on dark background:
```tsx
waveBar: {
  width: 16,
  backgroundColor: COLORS.yellow400, // Light colored
  // Inside the dots area which is dark
}
```

Actually, looking at HTML again - the bars are BLACK on WHITE card:
```html
<div class="w-4 h-8 bg-black"></div>
```

So bars should remain black. The "inverted" comment likely means the animation effect.

### 5. Structure Changes

Separate components:
- `NfcCard` - The large square with NFC icon, dots, and wave bars
- `AmountCard` - Below NFC card
- `TitleCard` - Yellow with "READY TO SEND" + checkmark
- `SubtitleCard` - White with instructions

### 6. Green Checkmark for Ready State

Add checkmark icon or text next to title:
```tsx
<View style={styles.titleCard}>
  <Text style={styles.checkmark}>✓</Text>
  <Text style={styles.titleText}>READY TO SEND</Text>
</View>
```

## File Changes

```
app/pay-nfc.tsx - Complete redesign with proper structure
assets/dots-pattern.png - (optional) Dots pattern image
```

## New Styles Structure

```tsx
styles: {
  // Header (outside card)
  container, header, backButton*, titleWrapper*
  
  // Content wrapper
  contentContainer
  
  // NFC Card (large square)
  nfcCardShadow, nfcCard, dotsOverlay, nfcCircle, nfcIcon, waveBars*
  
  // Elements OUTSIDE NFC card
  amountCardShadow, amountCard,
  titleCardShadow, titleCard, checkmark,
  subtitleCardShadow, subtitleCard
  
  // Bottom actions
  bottomActions, cancelButton*
}
```
