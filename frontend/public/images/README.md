# Homepage Hero Background Images

## Current Images

This directory contains the hero background images for the homepage:

- `home-cart-house.jpg` - JPG format (fallback)
- `home-cart-house.webp` - WebP format (preferred, optimized for web)

## Replacing the Images

To replace the hero background with your own images:

1. **Save your images** in this directory with the same filenames:
   - `home-cart-house.jpg` (recommended size: ~250-400 KB)
   - `home-cart-house.webp` (recommended size: ~250-400 KB, optimized)

2. **Image requirements:**
   - Minimum resolution: 1920x1080 pixels
   - Aspect ratio: 16:9 or wider
   - File size: Keep under 400 KB for optimal performance
   - Format: WebP is preferred for better compression

3. **Converting to WebP:**
   ```bash
   # Using cwebp (install: apt-get install webp)
   cwebp -q 85 home-cart-house.jpg -o home-cart-house.webp
   
   # Using ImageMagick
   convert home-cart-house.jpg -quality 85 home-cart-house.webp
   
   # Using Node.js sharp library
   sharp('home-cart-house.jpg').webp({ quality: 85 }).toFile('home-cart-house.webp')
   ```

4. **Clear the Next.js cache** after replacing images:
   ```bash
   rm -rf .next
   npm run build
   ```

## Adjusting Overlay Intensity

The overlay gradient can be adjusted in `/frontend/styles/homepage-hero.css`:

```css
/* Line 27-29: Adjust the rgba opacity values */
.homepage-hero::before {
  background: linear-gradient(
    215deg, 
    rgba(14, 32, 52, 0.80) 0%,    /* Darker at top-left */
    rgba(14, 32, 52, 0.55) 40%,   /* Medium in middle */
    rgba(0, 0, 0, 0.65) 100%      /* Dark at bottom-right */
  ),
  url("/images/home-cart-house.webp") center / cover no-repeat;
  
  /* Adjust brightness and saturation */
  filter: brightness(0.85) saturate(1.05);
}
```

**Tips for overlay adjustment:**
- Increase opacity values for darker overlay (better text contrast)
- Decrease opacity values for lighter overlay (show more of image)
- Adjust `brightness()` value: lower = darker, higher = lighter
- Adjust `saturate()` value: lower = less color, higher = more vibrant

## Image Attribution

Current placeholder images are temporary. Replace with your actual hero images.
