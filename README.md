# GOGL-LOG: Google Account Session Maintainer

This project is an automated tool designed to maintain and refresh authentication sessions for a large number of Google accounts using Playwright.

## 🚀 Purpose
The goal of the tool is to simulate a human login process to "renew" session cookies. It loads existing cookies, attempts a password login, handles recovery email checks, and saves the updated session state.

## 📁 Project Structure
- `src/index.ts`: Entry point, parses CLI arguments.
- `src/tasks/auth.ts`: Core authentication logic and verification.
- `src/services/browser.ts`: Browser configuration (Stealth mode, User-Agent, Native Chrome path).
- `cookies/`: Source directory containing JSON files of account cookies.
- `cookies_success/`: Directory where cookies of successfully authenticated accounts are saved.
- `cookies_failed/`: Directory where cookies of accounts that failed to fully authenticate are saved.
- `logs/`: Step-by-step execution logs for each account.
- `run_all.sh`: Bash script to iterate through all accounts in the cookies folder.

## 🛠 Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure you have Google Chrome installed (the script targets the native app on macOS for better stealth).

## 📖 Usage

### Running for a single account
You can run the script for a specific account by providing the account name (filename without `.json`):
```bash
# Headless mode (no window)
npm start less <account_name>

# Visible mode (with browser window)
npm start <account_name>
```

### Running for all accounts
To process every account in the `cookies/` folder:
```bash
chmod +x run_all.sh
./run_all.sh
```
To run in the background (recommended for 1000+ accounts):
```bash
nohup ./run_all.sh > run_all_output.log 2>&1 &
```

## ⚙️ Technical Logic
1. **Stealth**: Overwrites `navigator.webdriver` and uses a custom User-Agent to avoid bot detection.
2. **Cookie Loading**: Loads existing cookies, cleanses `sameSite` attributes, and applies them to the browser context.
3. **Auth Flow**:
   - Selects the account from the Google Sign-in list.
   - Inputs password and handles the transition.
   - Watches for a "Recovery email" screen; if found, it confirms via a hardcoded recovery email.
4. **Verification**: Redirects to the login page. If the browser automatically redirects to the Account Page (`myaccount.google.com`), the session is considered valid.

## 📊 Results
- **Success**: Session cookies found + Account page reached $\rightarrow$ Saved to `cookies_success/`.
- **Partial/Fail**: Session cookies found but no account page, or full login failure $\rightarrow$ Saved to `cookies_failed/`.
- **Screenshots**: A full-page screenshot is taken for every attempt: `screenshot_<account_name>.png`.
