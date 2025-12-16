# 🎨 Rich Presence (RPC) Guide - Complete Tutorial

## 🌟 What is Rich Presence?

Rich Presence is Discord's feature that lets you display a **custom activity status** on your profile. Instead of just showing "Playing a game", you can show:
- 🎮 **Custom games** with images and buttons
- 🎵 **What you're listening to** with album art
- 📺 **What you're watching** with thumbnails
- 🎯 **Custom activities** with your own branding

**Vexil's RPC system** is super advanced - it supports **Discord application assets**, **external URLs**, **custom buttons**, and **real-time updates**!

---

## ✨ Features Overview

### 🎯 **What You Can Do:**
- 🖼️ **Custom Images** - Use Discord app assets OR external URLs
- 🔗 **Clickable Buttons** - Add up to 2 buttons with custom links
- ⏰ **Timestamps** - Show elapsed time or countdowns
- 👥 **Party Info** - Show "1 of 5 players" style info
- 🎮 **Multiple Activity Types** - Playing, Watching, Listening, Streaming, Competing
- 🔄 **Real-time Updates** - Change your status instantly
- 💾 **Memory-only Changes** - No file writes during runtime

### 🚀 **Advanced Features:**
- 🏗️ **Asset Resolution** - Automatically fetches Discord app assets
- 🔗 **URL Support** - Use any image URL (Discord CDN, external sites)
- ⚡ **Smart Caching** - Caches assets for better performance
- 🛡️ **Rate Limiting** - Respects Discord's 5 updates per 20 seconds limit
- 🎨 **Multiple Formats** - Support for asset names, IDs, and URLs

---

## 🎮 Discord Developer Portal Setup

### Step 1: Create Your Application

1. **Go to** [Discord Developer Portal](https://discord.com/developers/applications)
2. **Click** "New Application" 
3. **Name** your application (e.g., "My Custom RPC")
4. **Click** "Create"

### Step 2: Upload Your Assets

1. **Go to** "Rich Presence" → "Art Assets"
2. **Upload** your images:
   - 🖼️ **Large Image** (512x512px recommended)
   - 🖼️ **Small Image** (128x128px recommended)
3. **Remember** the asset names you used (e.g., "mylogo", "mythunder")

### Step 3: Get Your Application ID

1. **Go to** "General Information" tab
2. **Copy** the "Application ID" 
3. **Save** it - you'll need this for Vexil!

**Example Application ID:** `1306468377539379241`

---

## 🎯 Using RPC Commands in Vexil

### 🚀 **Basic Commands**

#### **Enable/Disable RPC**
```
+rpc enable     → Turn on custom status
+rpc disable    → Turn off custom status
```

#### **Set Activity Type**
```
+rpc setType PLAYING     → "Playing..."
+rpc setType WATCHING    → "Watching..."
+rpc setType LISTENING   → "Listening to..."
+rpc setType STREAMING   → "Streaming..." (needs URL)
+rpc setType COMPETING   → "Competing in..."
```

#### **Set Basic Text**
```
+rpc setName "My Custom Game"        → Main activity text
+rpc setDetails "Level 99 Wizard"   → Details text
+rpc setState "github.com/myprofile" → Bottom text
```

---

## 🖼️ Image Assets Guide

### 🏗️ **Three Ways to Set Images:**

#### **Method 1: Discord Application Assets** (Recommended)
```
+rpc setLargeImage vexil        → Uses "vexil" from your app
+rpc setSmallImage thunder      → Uses "thunder" from your app
```

#### **Method 2: Asset IDs** (Direct Discord Assets)
```
+rpc setLargeImage 929325841350000660    → Direct asset ID
+rpc setSmallImage 895316294222635008    → Direct asset ID
```

#### **Method 3: External URLs** (Any Image)
```
+rpc setLargeImage https://i.imgur.com/abc123.png
+rpc setSmallImage https://cdn.discordapp.com/attachments/...
```

### 🎨 **Image Hover Text**
```
+rpc setLargeText "Vexil Selfbot v2.0"
+rpc setSmallText "github.com/faiz4sure"
```

---

## 🔗 Button System

### 🎯 **Adding Buttons**
```
+rpc addButton "Visit GitHub" https://github.com/faiz4sure/Vexil
+rpc addButton "Support Server" https://discord.gg/b3hZG4R7Mf
```

### 🗑️ **Managing Buttons**
```
+rpc clearButtons    → Remove all buttons
+rpc view           → See current configuration
```

**💡 Pro Tip:** You can have **maximum 2 buttons** at once!

---

## ⏰ Timestamps & Party Info

### ⏱️ **Time Tracking**
```
+rpc setStartTimestamp now        → Start timer from now
+rpc setStartTimestamp +1h        → Start 1 hour ago
+rpc setEndTimestamp +30m          → End in 30 minutes
```

### 👥 **Party Information**
```
+rpc setParty 1 5    → "1 of 5 players"
+rpc setParty 3 10   → "3 of 10 players"
```

---

## 🎮 Advanced Usage Examples

### 🎯 **Gaming Setup**
```
+rpc enable
+rpc setType PLAYING
+rpc setName "Custom RPG Game"
+rpc setDetails "Level 50 Warrior"
+rpc setState "Exploring Dungeons"
+rpc setLargeImage mygame_logo
+rpc setSmallImage sword_icon
+rpc setParty 1 4
+rpc setStartTimestamp now
+rpc addButton "Play Now" https://mygame.com
```

### 🎵 **Music Setup**
```
+rpc enable
+rpc setType LISTENING
+rpc setName "Spotify"
+rpc setDetails "My Awesome Playlist"
+rpc setState "🎵 Vibing to Music"
+rpc setLargeImage spotify_logo
+rpc setSmallImage music_note
```

### 📺 **Streaming Setup**
```
+rpc enable
+rpc setType STREAMING
+rpc setName "Twitch Stream"
+rpc setDetails "Playing Minecraft"
+rpc setState "Live Now!"
+rpc setURL https://twitch.tv/mychannel
+rpc setLargeImage twitch_logo
+rpc addButton "Watch Live" https://twitch.tv/mychannel
```

---

## 🛠️ Configuration File (rpc.yml)

### 📋 **Default Configuration**
```yaml
rpc:
  enabled: true
  application_id: "1306468377539379241"
  default:
    type: "PLAYING"
    name: "Vexil Selfbot"
    details: "Summoning Silence"
    state: "github.com/faiz4sure"
    url: ""
    party:
      current: 1
      max: 1
      id: ""
    timestamps:
      start: null
      end: null
    assets:
      large_image: "vexil"
      large_text: "Vexil Selfbot"
      small_image: "thunder"
      small_text: "github.com/faiz4sure"
    buttons:
      - label: "GitHub"
        url: "https://github.com/faiz4sure/Vexil"
      - label: "Support"
        url: "https://discord.gg/b3hZG4R7Mf"
```

---

## 🔄 Reset & Management

### 🔄 **Reset to Defaults**
```
+rpc reset    → Reset everything to file configuration
```

### 👀 **View Current Settings**
```
+rpc view     → See your complete current setup
```

---

## 🎨 Asset Resolution System

### 🧠 **How It Works:**
1. **Asset Names** → Fetches from Discord API automatically
2. **Numeric IDs** → Used directly (no API call needed)
3. **URLs** → Processed as-is (no resolution needed)
4. **Discord CDN** → Converted to `mp:` format for compatibility

### ⚡ **Examples:**
```
"vexil"                    → API call → Asset ID
"929325841350000660"      → Used directly
"https://example.com/img" → Used directly
"mp:attachments/..."      → Used directly
```

---

## 🚨 Common Issues & Solutions

### ❌ **"Invalid Asset" Error**
- **Check** your application ID in config
- **Verify** asset names in Discord Developer Portal
- **Try** using asset IDs instead of names

### ❌ **"Rate Limited" Warning**
- **Wait** 20 seconds between updates
- **Use** `+rpc view` to check current status
- **Normal** - Discord limits to 5 updates per 20 seconds

### ❌ **Images Not Showing**
- **Check** image URLs are accessible
- **Verify** Discord CDN URLs are correct
- **Try** different image formats (PNG, JPG, GIF)

---

## 💡 Pro Tips

### 🎯 **Best Practices:**
- **Use** meaningful asset names in Discord portal
- **Test** assets work before using in commands
- **Keep** labels short and descriptive (max 32 chars)
- **Use** timestamps for time-based activities
- **Combine** party info with gaming setups

### 🚀 **Performance Tips:**
- **Cache** frequently used asset names
- **Use** asset IDs for faster resolution
- **Avoid** rapid status changes
- **Reset** periodically to clear cache

### 🎨 **Creative Ideas:**
- **Show** your current project progress
- **Display** music you're listening to
- **Promote** your social media
- **Create** themed statuses for events
- **Use** custom buttons for important links

---

## 🆘 Need Help?

### 📚 **Resources:**
- **Discord Developer Portal:** https://discord.com/developers/applications
- **Vexil Support:** https://discord.gg/b3hZG4R7Mf
- **Asset Guidelines:** 512x512px for large, 128x128px for small

### 💬 **Get Help:**
- **Join** our support server: https://discord.gg/b3hZG4R7Mf
- **Ask** in #support channel
- **Contact:** `faiz4sure` on Discord

---

## 🌟 Examples Gallery

### 🎮 **Gaming Examples:**
```
+rpc setName "Minecraft"
+rpc setDetails "Building Epic Castle"
+rpc setState "Survival Mode"
+rpc setLargeImage minecraft_logo
+rpc setSmallImage diamond_sword
```

### 🎵 **Music Examples:**
```
+rpc setName "Spotify"
+rpc setDetails "Chill Vibes Playlist"
+rpc setState "🎵 3/25 songs"
+rpc setLargeImage spotify_icon
+rpc setStartTimestamp now
```

### 📱 **Social Media Examples:**
```
+rpc setName "Content Creator"
+rpc setDetails "Editing New Video"
+rpc setState "YouTube.com/@MyChannel"
+rpc addButton "Subscribe" https://youtube.com/@MyChannel
+rpc addButton "Discord" https://discord.gg/mysupport
```

---

**🎉 Happy RPC Customization!** 

Remember: Your imagination is the limit! Create unique, engaging statuses that represent you perfectly. 🚀

---

<div align="center">

**Made with ❤️ by the Vexil Team**

[Join Our Discord](https://discord.gg/b3hZG4R7Mf) | [GitHub Repository](https://github.com/faiz4sure/Vexil)

</div>