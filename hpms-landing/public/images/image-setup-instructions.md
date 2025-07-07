# Image Setup Instructions for Dr. Polina Aesthetics

## Required Images

You need to copy the following images from `C:\Users\Happyou2\Documents\polina\` to the project:

### 1. Logo
- **Source**: Any logo file from your polina folder
- **Destination**: `/home/happy/projects/hpms/hpms-landing/public/images/dr-polina-logo.png`
- **Requirements**: PNG format, transparent background, square ratio preferred

### 2. Hero Background
- **Source**: Best clinic exterior or beautiful treatment room photo
- **Destination**: `/home/happy/projects/hpms/hpms-landing/public/images/aesthetic-hero.jpg`
- **Requirements**: High resolution (1920x1080 or larger), professional quality

### 3. Clinic Gallery Images
- **Source**: Interior shots, treatment rooms, clinic ambiance
- **Destinations**: 
  - `/home/happy/projects/hpms/hpms-landing/public/images/dr-polina-clinic1.jpg`
  - `/home/happy/projects/hpms/hpms-landing/public/images/dr-polina-clinic2.jpg`
  - `/home/happy/projects/hpms/hpms-landing/public/images/dr-polina-treatment.jpg`

## How to Copy Images (Manual Method)

### Option 1: Using VSCode (Recommended)
1. Open VSCode file explorer
2. Navigate to `/home/happy/projects/hpms/hpms-landing/public/images/`
3. Drag and drop images from Windows Explorer to VSCode
4. Rename them according to the list above

### Option 2: Using Command Line
If you have WSL access to Windows files:
```bash
# Navigate to project images directory
cd /home/happy/projects/hpms/hpms-landing/public/images/

# Copy from Windows (adjust path as needed)
cp /mnt/c/Users/Happyou2/Documents/polina/* ./

# Rename files to match our requirements
mv [original-logo-name] dr-polina-logo.png
mv [original-hero-name] aesthetic-hero.jpg
mv [original-clinic1-name] dr-polina-clinic1.jpg
mv [original-clinic2-name] dr-polina-clinic2.jpg
mv [original-treatment-name] dr-polina-treatment.jpg
```

### Option 3: Create Symbolic Links (if files are already accessible)
```bash
cd /home/happy/projects/hpms/hpms-landing/public/images/
ln -s /mnt/c/Users/Happyou2/Documents/polina/logo.png dr-polina-logo.png
ln -s /mnt/c/Users/Happyou2/Documents/polina/hero.jpg aesthetic-hero.jpg
# etc...
```

## After Adding Images

1. Restart the development server:
   ```bash
   cd /home/happy/projects/hpms/hpms-landing
   npm run dev:drpolina
   ```

2. Visit http://localhost:3002 to see the images loaded

3. Check browser developer tools console for any missing image errors

## Image Optimization Tips

- Compress images for web (aim for <500KB per image)
- Use WebP format if possible for better performance
- Ensure images are properly sized (don't use 4K images if displaying at 800px width)

Let me know once you've added the images and I can help with any adjustments needed!