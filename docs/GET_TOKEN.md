# 🔑 How to Get Your Discord Token

## ⚠️ **IMPORTANT WARNING**

- **NEVER share your Discord token with anyone!**
- **Selfbots violate Discord's Terms of Service**
- **Your account may be terminated if detected**
- **Use at your own risk**

---

## 📱 **Method 1: Mobile (BlueCord App)**

### **What is BlueCord?**

BlueCord is a modified Discord client that allows easier token extraction on mobile devices.

### **Steps:**

1. **Download BlueCord**

   - Search for "BlueCord Discord" on your mobile browser
   - Download and install the APK (Android) or IPA (iOS)
   - ⚠️ **Only download from trusted sources**

2. **Login to BlueCord**

   - Open BlueCord app
   - Login with your Discord account credentials
   - Complete any 2FA if enabled

3. **Extract Token**

   - Go to **Settings** in BlueCord
   - Look for **"Bluecord Mods"** and click it
   - Then go to **"Account Switcher"**
   - Find **"Copy Current Token"**
   - Copy the token to your clipboard

4. **Use Token**
   - Paste the token into your `config.yaml` file
   - Replace `"YOUR_DISCORD_TOKEN_HERE"` with your actual token

---

## 💻 **Method 2: Desktop/Browser Console**

### **Using Discord Desktop App:**

1. **Open Discord Desktop App**

   - Launch the Discord desktop application
   - Login to your account

2. **Open Developer Console**

   - Press `Ctrl + Shift + I` (Windows/Linux) or `Cmd + Option + I` (Mac)
   - Click on the **"Console"** tab

3. **Run Token Extraction Code**
   - Copy and paste this code into the console:

```javascript
window.webpackChunkdiscord_app.push([
  [Symbol()],
  {},
  (req) => {
    if (!req.c) return;
    for (let m of Object.values(req.c)) {
      try {
        if (!m.exports || m.exports === window) continue;
        if (m.exports?.getToken) return copy(m.exports.getToken());
        for (let ex in m.exports) {
          if (
            m.exports?.[ex]?.getToken &&
            m.exports[ex][Symbol.toStringTag] !== "IntlMessagesProxy"
          )
            return copy(m.exports[ex].getToken());
        }
      } catch {}
    }
  },
]);
window.webpackChunkdiscord_app.pop();
console.log("%cWorked!", "font-size: 50px");
console.log(`%cYou now have your token in the clipboard!`, "font-size: 16px");
```

4. **Press Enter**

   - The code will run and copy your token to clipboard
   - You should see "Worked!" message in console

5. **Use Token**
   - Paste the token into your `config.yaml` file
   - Replace `"YOUR_DISCORD_TOKEN_HERE"` with your actual token

### **Using Web Browser:**

1. **Open Discord in Browser**

   - Go to https://discord.com/app
   - Login to your account

2. **Open Developer Tools**

   - Press `F12` or `Ctrl + Shift + I`
   - Click on the **"Console"** tab

3. **Run the Same Code**
   - Paste the same JavaScript code as above
   - Press Enter and copy the token

---

## 🔍 **Method 3: Network Tab (Advanced)**

### **Steps:**

1. **Open Discord in Browser**

   - Go to https://discord.com/app
   - Login to your account

2. **Open Developer Tools**

   - Press `F12`
   - Click on the **"Network"** tab

3. **Filter Requests**

   - In the filter box, type: `api/v`
   - This will show only Discord API requests

4. **Send a Message**

   - Send any message in any channel
   - This will trigger API requests

5. **Find Authorization Header**
   - Click on any API request in the Network tab
   - Look for **"Request Headers"**
   - Find the **"authorization"** header
   - Copy the value (this is your token)

---

## 📲 **Method 4: Mobile Browser**

### **Steps:**

1. **Open Mobile Browser**

   - Use Chrome, Firefox, or Safari on your phone
   - Go to https://discord.com/app

2. **Enable Desktop Mode**

   - In browser settings, enable "Desktop Site" or "Request Desktop Site"
   - This allows access to developer tools

3. **Open Developer Console**

   - Look for browser menu → "Developer Tools" or "Inspect"
   - Navigate to Console tab

4. **Run Token Code**
   - Paste the JavaScript code from Method 2
   - Copy the extracted token

---

## 🛠️ **Method 5: Discord Token Grabber Tools**

### **⚠️ WARNING: Use with Extreme Caution**

- Many token grabber tools are **malicious**
- They may steal your token or install malware
- **Only use trusted, open-source tools**
- **Scan with antivirus before running**

### **Safer Alternatives:**

- Use the browser console method instead
- It's safer and doesn't require downloading suspicious software

---

## 📝 **How to Use Your Token**

### **1. Open config.yaml**

```yaml
selfbot:
  token: "YOUR_DISCORD_TOKEN_HERE" # Replace this
  prefix: "+"
  status: "dnd"
```

### **2. Replace the Token**

```yaml
selfbot:
  token: "MTEzMjMzODI6DS2MTU1MDYwMw.GqP4rF._h9jUzBCHUynjvdvi76t1sYQRhy1ezYEkz2o3SC"
  prefix: "+"
  status: "dnd"
```

### **3. Save and Start Bot**

- Save the config.yaml file
- Run: `node index.js`
- Your selfbot should now login successfully

---

## 🔒 **Security Tips**

### **Protect Your Token:**

- **Never share it** in Discord servers, GitHub, or anywhere public
- **Don't paste it** in untrusted websites or tools
- **Use environment variables** for extra security (advanced)
- **Regenerate token** if you suspect it's compromised


### **If Your Token is Compromised:**

1. **Change your Discord password immediately**
2. **Enable 2FA** if not already enabled
3. **Check for unauthorized activity**
4. **Consider creating a new account** for selfbot use

---

## ❓ **Troubleshooting**

### **Token Not Working?**

- **Check format**: Token should be long string with dots
- **No extra spaces**: Remove any spaces before/after token
- **Quotes required**: Keep the token in double quotes
- **Account locked**: Your account might be temporarily locked

### **Console Code Not Working?**

- **Try refreshing** Discord and running code again
- **Different browser**: Try Chrome, Firefox, or Edge
- **Desktop app**: Use desktop app instead of browser
- **Clear cache**: Clear browser cache and try again

### **Still Having Issues?**

- **Join our support server**: https://discord.gg/b3hZG4R7Mf
- **Contact developers**: `faiz4sure` or `marcel4real`
- **Check GitHub issues**: https://github.com/faiz4sure/Vexil

---

## 📚 **Additional Resources**

### **Useful Links:**

- **Vexil GitHub**: https://github.com/faiz4sure/Vexil
- **Support Server**: https://discord.gg/b3hZG4R7Mf
- **Discord Developer Portal**: https://discord.com/developers/applications

### **Alternative Methods:**

- **BetterDiscord plugins** (if you use BetterDiscord)
- **Discord.js token extractors** (for developers)
- **Browser extensions** (use with caution)

---

## ⚖️ **Legal Disclaimer**

- **Selfbots violate Discord's Terms of Service**
- **Account termination is possible**
- **Use at your own risk**
- **We are not responsible for any consequences**
- **This guide is for educational purposes only**

---

**Happy selfbotting! 🤖**

_Remember: Stay safe, Try using alt accounts, and don't get caught!_
