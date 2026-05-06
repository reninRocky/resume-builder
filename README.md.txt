# 🤖 AI-Powered Resume Builder

An intelligent resume builder that automatically tailors your resume to match job descriptions using AI. The system keeps your personal information fixed (name, contact, education, certificates, patents, experience titles) while dynamically generating and customizing variable sections (summary, competencies, experience content, projects) based on job requirements.

## ✨ Features

- **Smart Field Management**: Automatically separates fixed fields (personal info) from variable fields (job-specific content)
- **AI-Powered Tailoring**: Uses OpenAI GPT or Ollama to generate job-specific resume content
- **Fixed Fields Protection**: Keeps your name, contact details, education, certificates, patents, and experience titles unchanged
- **Dynamic Content Generation**: Generates summary, competencies, experience descriptions, and projects tailored to each job
- **PDF Generation**: Automatically converts HTML resumes to professional PDF format with clickable links
- **Modern UI**: Clean, intuitive interface with clear distinction between fixed and editable sections
- **Flexible Configuration**: Support for both OpenAI and Ollama models
- **Contact Links**: LinkedIn and Portfolio URLs appear as clickable links (not full URLs) in the generated PDF

## 🛠️ Technologies

### Backend
- **Node.js** (v14+) with Express.js
- **OpenAI API** or **Ollama** for AI generation
- **Puppeteer** for PDF generation from HTML
- **CORS** for cross-origin requests
- **dotenv** for environment variable management

### Frontend
- **React.js** (v18) with modern hooks
- **CSS3** with custom styling
- **React Scripts** for development and building

## 📋 Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **Chrome/Chromium** (required by Puppeteer for PDF generation)
- **OpenAI API key** (for OpenAI) OR **Ollama** running locally (for Ollama)

## 🚀 Installation

### Step 1: Clone or Download the Project
```bash
# If using git
git clone <repository-url>
cd resume-builder

# Or extract the project folder to your desired location
```

### Step 2: Install Backend Dependencies
```bash
cd backend
npm install
```

**Expected Output:**
- Dependencies will be installed (express, puppeteer, cors, dotenv, node-fetch)
- This may take 2-5 minutes depending on your internet speed
- Puppeteer will download Chromium automatically

### Step 3: Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

**Expected Output:**
- React and related dependencies will be installed
- This usually takes 1-3 minutes

## ⚙️ Configuration

### Backend Configuration

1. **Create `.env` file** in the `backend` directory:

   **For Windows (PowerShell):**
   ```powershell
   cd backend
   New-Item -ItemType File -Name ".env"
   ```

   **For Mac/Linux:**
   ```bash
   cd backend
   touch .env
   ```

2. **Add configuration** to `.env` file:

   **Option A: Using OpenAI**
   ```env
   # OpenAI Configuration
   OPENAI_API_KEY=sk-your-openai-api-key-here
   MODEL_PROVIDER=openai
   
   # Server Port
   PORT=4000
   ```

   **Option B: Using Ollama (Local)**
   ```env
   # Ollama Configuration
   MODEL_PROVIDER=ollama
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama3
   
   # Server Port
   PORT=4000
   ```

3. **Configure Fixed Resume Data** in `backend/Data/base_resume.json`:

   ```json
   {
     "name": "Your Full Name",
     "email": "your.email@example.com",
     "phone": "1234567890",
     "linkedin": "https://linkedin.com/in/yourprofile",
     "portfolio": "https://yourportfolio.com",
     "summary": "Default summary (will be replaced by AI)",
     "education": "B.Tech – Your Degree - University Name | 2024\n\nSenior Secondary (12th) – School Name | 2020\n\nSecondary School (10th) – School Name | 2018",
     "competencies": "Skill1, Skill2, Skill3, Skill4",
     "experience": "• Job Title | Company Name | Date Range\n• Another Job Title | Another Company | Date Range",
     "projects": "• Project Name: Description of project",
     "certs": "Patents\n\n• Patent Title 1 – Description.\n• Patent Title 2 – Description.\n\nPublications\n\n• \"Publication Title 1\" – Conference/Journal, Year.\n• \"Publication Title 2\" – Conference/Journal, Year."
   }
   ```

   **Important Formatting Rules:**
   - **Education**: Use `\n\n` for line breaks between entries. No bullets (•) needed.
   - **Experience**: Each entry must start with `•` (bullet point). Use `\n` for line breaks.
   - **Projects**: Each project must start with `•` (bullet point).
   - **Certs**: Must include both "Patents" and "Publications" sections. Each item starts with `•`.

## 🎯 Usage

### Starting the Application

#### 1. Start the Backend Server

**Windows (PowerShell):**
```powershell
cd "C:\path\to\resume-builder\backend"
npm start
```

**Mac/Linux:**
```bash
cd backend
npm start
```

**Expected Output:**
```
✅ Loaded base resume data
Server is running on http://localhost:4000
```

**If you see errors:**
- Check that port 4000 is not already in use
- Verify `.env` file exists and is properly configured
- Ensure `base_resume.json` exists and is valid JSON

#### 2. Start the Frontend (New Terminal)

**Windows (PowerShell):**
```powershell
cd "C:\path\to\resume-builder\frontend"
npm start
```

**Mac/Linux:**
```bash
cd frontend
npm start
```

**Expected Output:**
- Browser should automatically open at `http://localhost:3000`
- If not, manually navigate to `http://localhost:3000`

### Using the Resume Builder

1. **View Fixed Information:**
   - Click the **"Show Fixed Info"** button (top right)
   - Review what information will remain unchanged:
     - Name, Email, Phone, LinkedIn, Portfolio
     - Education details
     - Certificates and Patents
     - Experience job titles

2. **Paste Job Description:**
   - Copy the complete job description from the job posting
   - Paste it into the large text area
   - The more detailed the job description, the better the AI tailoring

3. **Generate Resume:**
   - Click **"Generate Resume PDF"** button
   - Wait for AI processing (usually 10-30 seconds)
   - The PDF will automatically download to your Downloads folder
   - The resume will include:
     - Your fixed personal information
     - AI-tailored summary matching the job
     - Relevant competencies and skills
     - Tailored experience descriptions
     - Relevant projects

4. **Verify the PDF:**
   - Open the downloaded `resume.pdf`
   - Check that:
     - Contact info is on one line
     - LinkedIn and Portfolio are clickable links (blue text, not full URLs)
     - Education matches your fixed format
     - Patents and Publications are present and correct
     - All bullet points use "•" (not "-")

## 📡 API Endpoints

### GET `/api/fixed-fields`
Returns the fixed fields that won't change in the resume.

**Request:**
```bash
curl http://localhost:4000/api/fixed-fields
```

**Response:**
```json
{
  "name": "Your Name",
  "email": "your.email@example.com",
  "phone": "1234567890",
  "linkedin": "https://linkedin.com/in/yourprofile",
  "portfolio": "https://yourportfolio.com",
  "education": "Your Education Details",
  "certs": "Your Certificates and Patents",
  "experienceTitles": ["• Job Title | Company | Dates"]
}
```

### POST `/api/generate`
Generates AI-tailored resume fields based on job description.

**Request:**
```json
{
  "description": "Job description text here...",
  "fields": ["summary", "competencies", "experience", "projects"] // optional
}
```

**Response:**
```json
{
  "summary": "AI-generated professional summary...",
  "competencies": "Tailored skills list...",
  "experience": "Experience content with fixed titles...",
  "projects": "Relevant projects..."
}
```

### POST `/api/inject`
Directly injects text into template and generates PDF.

**Request:**
```json
{
  "replacements": {
    "SUMMARY": "Your custom summary text",
    "PROJECTS": "Your custom projects"
  },
  "format": "pdf"
}
```

**Response:** PDF file (binary) - Content-Type: `application/pdf`

## 🐛 Common Bugs and Fixes

### Bug 1: "Cannot find module 'docx'" or "Cannot find module 'html-to-text'"

**Error Message:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'docx'
```

**Cause:** Dependencies not installed or incomplete installation.

**Fix:**
```bash
cd backend
npm install
```

**Prevention:** Always run `npm install` after cloning or when adding new dependencies.

---

### Bug 2: "Word found unreadable content" (Word Document Issues)

**Error Message:** Word shows error when opening generated document.

**Cause:** Word document generation is no longer supported. Only PDF generation is available.

**Fix:** 
- The system now only supports PDF generation
- Remove any Word-related code if you see this error
- Use PDF format only

**Note:** This feature has been removed. Only PDF generation is supported.

---

### Bug 3: LinkedIn/Portfolio Links Show Full URLs Instead of Clickable Links

**Symptom:** In the PDF, you see `https://linkedin.com/in/yourprofile` instead of clickable "LinkedIn" text.

**Cause:** Template replacement issue or URL processing error.

**Fix:**
1. Check `backend/templates/resume-template.html` - ensure links are structured as:
   ```html
   <a href="{{LINKEDIN}}" target="_blank">LinkedIn</a>
   ```
2. Verify `backend/Data/base_resume.json` has clean URLs without quotes:
   ```json
   "linkedin": "https://linkedin.com/in/yourprofile",
   "portfolio": "https://yourportfolio.com"
   ```
3. Restart the backend server:
   ```bash
   # Stop server (Ctrl+C)
   npm start
   ```

---

### Bug 4: Contact Information Breaks into Multiple Lines

**Symptom:** Email, phone, LinkedIn, Portfolio appear on separate lines instead of one line.

**Cause:** CSS `white-space` or HTML structure issue.

**Fix:**
1. Check `backend/templates/resume-template.html` - contact div should be:
   ```html
   <div class="contact"><span>{{EMAIL}}</span><span> | </span><span>{{PHONE}}</span><span> | </span><a href="{{LINKEDIN}}" target="_blank">LinkedIn</a><span> | </span><a href="{{PORTFOLIO}}" target="_blank">Portfolio</a></div>
   ```
2. Verify CSS has:
   ```css
   .contact {
     white-space: nowrap !important;
     display: block;
   }
   ```
3. Restart backend server.

---

### Bug 5: "ERR_MODULE_NOT_FOUND" When Starting Server

**Error Message:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express'
```

**Cause:** Node modules not installed or corrupted.

**Fix:**
```bash
cd backend
rm -rf node_modules package-lock.json  # Mac/Linux
# OR
Remove-Item -Recurse -Force node_modules, package-lock.json  # Windows PowerShell

npm install
```

**If still failing:**
```bash
npm cache clean --force
npm install
```

---

### Bug 6: Puppeteer Browser Launch Fails

**Error Message:**
```
Error: Failed to launch the browser process!
```

**Cause:** Chrome/Chromium not found or insufficient permissions.

**Fix (Windows):**
1. Install Chrome browser if not installed
2. Add to `.env`:
   ```env
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
   ```
3. Reinstall Puppeteer:
   ```bash
   npm uninstall puppeteer
   npm install puppeteer
   ```

**Fix (Linux):**
```bash
# Install Chromium dependencies
sudo apt-get update
sudo apt-get install -y chromium-browser

# Or for headless Chrome
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils
```

**Fix (Mac):**
```bash
brew install --cask google-chrome
```

---

### Bug 7: "Port 4000 already in use"

**Error Message:**
```
Error: listen EADDRINUSE: address already in use :::4000
```

**Cause:** Another process is using port 4000.

**Fix (Windows):**
```powershell
# Find process using port 4000
netstat -ano | findstr :4000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in .env
PORT=4001
```

**Fix (Mac/Linux):**
```bash
# Find process using port 4000
lsof -ti:4000

# Kill the process
kill -9 $(lsof -ti:4000)

# Or change port in .env
PORT=4001
```

---

### Bug 8: OpenAI API Key Invalid or Expired

**Error Message:**
```
OpenAI error 401 Unauthorized
```

**Cause:** Invalid or missing API key.

**Fix:**
1. Check `.env` file has correct key:
   ```env
   OPENAI_API_KEY=sk-your-actual-key-here
   ```
2. Verify key at https://platform.openai.com/api-keys
3. Check API key has sufficient credits
4. Restart backend server after changing `.env`

---

### Bug 9: Ollama Connection Failed

**Error Message:**
```
Ollama error: connect ECONNREFUSED
```

**Cause:** Ollama not running or wrong URL.

**Fix:**
1. Start Ollama:
   ```bash
   ollama serve
   ```
2. Verify Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```
3. Check `.env` has correct URL:
   ```env
   OLLAMA_URL=http://localhost:11434
   ```
4. Ensure model is downloaded:
   ```bash
   ollama pull llama3
   ```

---

### Bug 10: Education or Patents/Publications Missing from PDF

**Symptom:** Generated PDF doesn't show education or certificates section.

**Cause:** Validation failed or format mismatch in `base_resume.json`.

**Fix:**
1. Check `backend/Data/base_resume.json` format:
   - Education must include all required entries
   - Certificates must include both "Patents" and "Publications" sections
2. Verify server console for validation errors
3. Check JSON is valid (no trailing commas, proper quotes)
4. Restart server after fixing JSON

**Required Education Format:**
```json
"education": "B.Tech – Robotics & Mechatronics - Christ University, Bengaluru | 2024\n\nSenior Secondary (12th) – Christ Academy | 2020\n\nSecondary School (10th) – St. Jude's Hr. Sec School | 2018"
```

**Required Certificates Format:**
```json
"certs": "Patents\n\n• Firefighting Robot Design – Filed with Indian Patent Office.\n• Nursing Robot for Patient Monitoring – IoT-integrated contactless care system.\n\nPublications\n\n• \"Design of ANN-Based Firefighting Robot\" – 4th Int'l Conference on Intelligent Manufacturing Systems, 2022.\n• \"Mobile Robot Manipulator for Pandemic Patient Services\" – Best Paper Award Winner."
```

---

### Bug 11: Bullet Points Show "-" Instead of "•"

**Symptom:** Resume shows "-" bullets instead of proper bullet points "•".

**Cause:** Incorrect formatting in `base_resume.json` or AI generation.

**Fix:**
1. Update `base_resume.json` to use "•" (not "-"):
   ```json
   "experience": "• Job Title | Company | Dates",
   "projects": "• Project Name: Description"
   ```
2. Restart backend server
3. Regenerate resume

---

### Bug 12: Frontend Not Loading or CORS Errors

**Error Message:**
```
Access to fetch at 'http://localhost:4000/api/...' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Cause:** CORS not properly configured or backend not running.

**Fix:**
1. Verify backend is running on port 4000
2. Check `backend/server.js` has:
   ```javascript
   app.use(cors());
   ```
3. Restart both backend and frontend
4. Clear browser cache

---

### Bug 13: PDF Download Doesn't Start

**Symptom:** Clicking "Generate Resume PDF" doesn't download file.

**Cause:** Browser blocking downloads or blob URL issue.

**Fix:**
1. Check browser download settings (allow downloads)
2. Check browser console for errors (F12)
3. Try different browser
4. Verify backend is returning PDF (check Network tab in DevTools)
5. Check file isn't being blocked by antivirus

---

### Bug 14: "Cannot read property 'name' of null"

**Error Message:**
```
TypeError: Cannot read property 'name' of null
```

**Cause:** `base_resume.json` not loaded or invalid.

**Fix:**
1. Verify file exists: `backend/Data/base_resume.json`
2. Check JSON is valid (use JSON validator)
3. Ensure file has all required fields:
   - name, email, phone, linkedin, portfolio, education, certs
4. Check file permissions (readable)
5. Restart backend server

---

### Bug 15: Server Crashes on PDF Generation

**Error Message:**
```
Error: Navigation timeout of 30000 ms exceeded
```

**Cause:** Puppeteer timeout or page load issue.

**Fix:**
1. Increase timeout in `server.js`:
   ```javascript
   await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });
   ```
2. Check system resources (RAM, CPU)
3. Close other applications
4. Try reducing resume content size

---

## 🔧 Advanced Troubleshooting

### Server Won't Start

**Checklist:**
1. ✅ Node.js version (should be v14+): `node --version`
2. ✅ Dependencies installed: `cd backend && npm list`
3. ✅ `.env` file exists and has correct format
4. ✅ `base_resume.json` exists and is valid JSON
5. ✅ Port 4000 is available
6. ✅ No syntax errors in `server.js`

**Debug Steps:**
```bash
# Check Node version
node --version

# Check if port is in use
netstat -ano | findstr :4000  # Windows
lsof -ti:4000  # Mac/Linux

# Check for syntax errors
node -c backend/server.js
```

### Frontend Won't Start

**Checklist:**
1. ✅ Node.js version (should be v14+)
2. ✅ Dependencies installed: `cd frontend && npm list`
3. ✅ Port 3000 is available
4. ✅ No syntax errors in React files

**Debug Steps:**
```bash
# Clear React cache
cd frontend
rm -rf node_modules/.cache  # Mac/Linux
Remove-Item -Recurse -Force node_modules\.cache  # Windows

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm start
```

### PDF Generation Issues

**Checklist:**
1. ✅ Puppeteer installed correctly
2. ✅ Chrome/Chromium available
3. ✅ Sufficient disk space
4. ✅ Sufficient RAM (Puppeteer needs ~500MB)
5. ✅ Template HTML is valid

**Debug Steps:**
```bash
# Test Puppeteer installation
node -e "const puppeteer = require('puppeteer'); puppeteer.launch().then(b => {console.log('OK'); b.close();})"
```

### AI Generation Issues

**OpenAI:**
- Verify API key is active at https://platform.openai.com
- Check API usage/quota
- Verify network connectivity
- Check API rate limits

**Ollama:**
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check model is downloaded: `ollama list`
- Verify model name matches `.env` configuration

## 📁 Project Structure

```
resume-builder/
├── backend/
│   ├── Data/
│   │   └── base_resume.json      # Fixed resume data (EDIT THIS)
│   ├── templates/
│   │   └── resume-template.html  # HTML template (EDIT FOR STYLING)
│   ├── server.js                  # Express server & API endpoints
│   ├── package.json               # Backend dependencies
│   ├── .env                       # Environment variables (CREATE THIS)
│   └── node_modules/               # Installed dependencies
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main React component
│   │   ├── index.js               # React entry point
│   │   └── index.css              # Global styles
│   ├── public/
│   │   └── index.html             # HTML template
│   ├── package.json               # Frontend dependencies
│   └── node_modules/              # Installed dependencies
│
└── README.md.txt                   # This file
```

## 🎨 Customization

### Updating Fixed Information

Edit `backend/Data/base_resume.json`:
- Update personal information
- Modify education entries
- Add/remove patents and publications
- Update experience titles (job titles, companies, dates)

**Important:** After editing, restart the backend server for changes to take effect.

### Customizing Resume Template

Edit `backend/templates/resume-template.html`:
- Change colors, fonts, spacing
- Modify layout structure
- Add/remove sections
- Adjust styling for different sections

**Available Placeholders:**
- `{{NAME}}` - Your name
- `{{EMAIL}}` - Email address
- `{{PHONE}}` - Phone number
- `{{LINKEDIN}}` - LinkedIn URL (used in href)
- `{{PORTFOLIO}}` - Portfolio URL (used in href)
- `{{SUMMARY}}` - Professional summary
- `{{EDUCATION}}` - Education details
- `{{COMPETENCIES}}` - Core competencies
- `{{EXPERIENCE}}` - Work experience
- `{{PROJECTS}}` - Projects
- `{{CERTS}}` - Certifications and patents

### Switching AI Providers

**OpenAI:**
```env
MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

**Ollama:**
```env
MODEL_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

After changing `.env`, restart the backend server.

## 📝 Notes

- **PDF Only**: The system only generates PDF files. Word document generation has been removed.
- **Fixed Fields**: Name, email, phone, LinkedIn, portfolio, education, and certificates are always fixed and never changed by AI.
- **Experience Titles**: Job titles, company names, and date ranges are fixed. Only the descriptions/content are AI-generated.
- **Bullet Points**: Always use "•" (bullet character) not "-" (hyphen) for proper formatting.
- **Contact Links**: LinkedIn and Portfolio URLs appear as clickable "LinkedIn" and "Portfolio" text in the PDF, not full URLs.

## 🔒 Security Notes

- Never commit `.env` file to version control
- Keep your OpenAI API key secure
- Don't share your `base_resume.json` with personal information publicly
- Use environment variables for sensitive data

## 📧 Support and Issues

If you encounter bugs not listed here:

1. Check the browser console (F12) for frontend errors
2. Check the backend server console for backend errors
3. Verify all configuration files are correct
4. Ensure all dependencies are installed
5. Try restarting both servers
6. Clear browser cache and try again

## 📄 License

This project is open source and available for personal and commercial use.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ using AI to make resume building easier and more effective!**

**Version:** 1.0.0  
**Last Updated:** 2024
