# Dark Mode Troubleshooting

## Issue
Dark mode toggle not working

## Solution

### 1. **Hard Refresh the Browser**
- Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- This clears the cache and reloads all JavaScript

### 2. **Check Browser Console**
- Press `F12` to open Developer Tools
- Look for any errors in the Console tab
- Common errors:
  - `useTheme must be used within a ThemeProvider` - means ThemeProvider is missing
  - `localStorage is not defined` - SSR issue (should be fixed now)

### 3. **Verify Dark Mode Classes**
- Open Developer Tools (`F12`)
- Click the "Elements" tab
- Look at the `<html>` tag
- When you click the theme toggle, you should see:
  - Light mode: `<html lang="en">`
  - Dark mode: `<html lang="en" class="dark">`

### 4. **Test localStorage**
- Open Developer Tools (`F12`)
- Go to "Application" tab → "Local Storage" → `http://localhost:3000`
- After clicking the toggle, you should see:
  - Key: `theme`
  - Value: `dark` or `light`

### 5. **Manual Test**
Open the browser console and run:
```javascript
// Toggle to dark mode
localStorage.setItem('theme', 'dark');
document.documentElement.classList.add('dark');
location.reload();

// Toggle to light mode
localStorage.setItem('theme', 'light');
document.documentElement.classList.remove('dark');
location.reload();
```

## What I Fixed

1. ✅ Added `suppressHydrationWarning` to `<html>` tag
2. ✅ Added initialization script to prevent flash
3. ✅ Simplified ThemeContext to avoid hydration issues
4. ✅ Used `classList.add/remove` instead of `toggle`

## If Still Not Working

**Check if the button is visible:**
- The theme toggle should appear in the header next to "Sign Out"
- It shows a moon icon (🌙) in light mode
- It shows a sun icon (☀️) in dark mode

**Try clicking it multiple times:**
- Each click should toggle between light and dark
- You should see the background colors change immediately

**If nothing happens:**
1. Check if you're logged in (theme toggle only shows on dashboards)
2. Navigate to `/dashboard`
3. Look for the icon button in the top right corner
