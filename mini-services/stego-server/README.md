# Secure Steganography System - Quick Start Guide

## 🚀 How to Run

### Step 1: Navigate to stego-server
```bash
cd mini-services/stego-server
```

### Step 2: Install dependencies
```bash
bun install
```

### Step 3: Start the server
```bash
bun run dev
```
OR
```bash
bun index.js
```

### Step 4: Open in browser
```
http://localhost:3030/
```

---

## 🔧 Troubleshooting

### Problem: Encoding/Decoding not working

#### 1. Check if server is running
```bash
lsof -i :3030
```
Should show a process listening on port 3030.

#### 2. Check server logs
Look at the terminal where you ran `bun run dev` - it should show any errors.

#### 3. Test API directly
```bash
# Test health check
curl http://localhost:3030/api/health

# Should return: {"status":"ok","message":"Secure Steganography System is running"}
```

#### 4. Check browser console
- Open the page in Chrome/Firefox/Safari
- Press F12 or right-click → Inspect
- Go to Console tab
- Look for red error messages

#### 5. Check Network tab
- In browser DevTools (F12)
- Go to Network tab
- Try encoding/decoding
- See if requests are failing (red status)
- Click on failed request to see error details

---

## ✅ What Should Work

### Encode Flow:
1. Open `http://localhost:3030/`
2. Click "Encode" tab
3. Upload an image (PNG, JPEG, WebP, BMP)
4. Enter a secret message
5. Enter a password
6. Click "Encode & Encrypt Message"
7. See "Message successfully encoded and encrypted!" message
8. See stego image preview
9. Download stego image

### Decode Flow:
1. Click "Decode" tab
2. Upload the stego image you downloaded
3. Enter the SAME password
4. Click "Decode & Decrypt Message"
5. See your original secret message

---

## 🐛 Common Issues

### Issue: "Network error" message
**Cause**: Server not running or wrong port
**Fix**: Make sure server is running on port 3030

### Issue: "No image file provided"
**Cause**: Image not uploaded properly
**Fix**: Make sure you select a file before clicking submit

### Issue: "No valid hidden message found"
**Cause**: Wrong password or not a stego image
**Fix**: Use the same password used during encoding, or upload the correct stego image

### Issue: CORS errors
**Cause**: Browser blocking requests
**Fix**: Make sure you're accessing `http://localhost:3030/` directly

---

## 📊 File Structure

```
stego-server/
├── package.json          # Dependencies
├── index.js              # Express server
├── modules/
│   ├── encryption.js     # DES + AES encryption
│   └── steganography.js  # LSB steganography
├── public/
│   ├── index.html        # Main UI
│   ├── styles.css        # Styles
│   ├── app.js            # Frontend logic (UPDATED)
│   └── logo.svg          # Logo
└── uploads/              # Temp files (auto-cleaned)
```

---

## 🎯 Testing

After starting the server, test with:
1. Small image (under 1MB)
2. Short message (test with "Hello World")
3. Simple password (test with "123456")

If basic test works, try larger files and messages!

---

## 🔍 Debug Mode

To see what's happening, open browser console (F12):
- You'll see "API Base URL:" and "Environment:" info
- Any errors will be shown in red
- Network requests will show in Network tab

---

## Need Help?

Check:
1. Server is running on port 3030
2. Browser console for errors
3. Server terminal for errors
4. Using correct image format (PNG, JPEG, WebP, BMP)
5. Using same password for encode/decode
