# Google Drive Integration Setup

This guide explains how to set up Google Drive integration to retrieve PDF files from your Google Drive folder.

## Prerequisites

1. Google Cloud Console account
2. Access to the Google Drive folder: https://drive.google.com/drive/folders/13tYF6fFWRuh22zOE_aziHn908OgSM1O4?usp=sharing

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 2. Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - Name: `resume-builder-drive`
   - Description: `Service account for Resume Builder Google Drive integration`
4. Click "Create and Continue"
5. Skip role assignment (click "Continue")
6. Click "Done"

### 3. Create and Download Service Account Key

1. Click on the service account you just created
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format
5. Click "Create" - this will download a JSON key file

### 4. Share Google Drive Folder with Service Account

1. Open the downloaded JSON key file
2. Copy the `client_email` value (e.g., `resume-builder-drive@project-id.iam.gserviceaccount.com`)
3. Go to your Google Drive folder: https://drive.google.com/drive/folders/13tYF6fFWRuh22zOE_aziHn908OgSM1O4?usp=sharing
4. Click "Share" button
5. Paste the service account email address
6. Give it "Viewer" permissions
7. Click "Send"

### 5. Configure Environment Variables

1. Open the downloaded JSON key file
2. Copy the entire contents
3. Open `backend/.env` file
4. Add the following:

```env
# Google Drive Configuration
GOOGLE_DRIVE_FOLDER_ID=13tYF6fFWRuh22zOE_aziHn908OgSM1O4
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**Important:** 
- The `GOOGLE_SERVICE_ACCOUNT_KEY` must be a valid JSON string (use single quotes in .env file)
- Alternatively, you can save the JSON file and reference it in code (requires code modification)

## Usage

### Option 1: Download from Folder (Automatic)

Send a POST request to `/api/upload-from-drive` with the folder ID:

```bash
curl -X POST http://localhost:4000/api/upload-from-drive \
  -H "Content-Type: application/json" \
  -d '{
    "folderId": "13tYF6fFWRuh22zOE_aziHn908OgSM1O4"
  }'
```

This will:
- List all PDF files in the folder
- Download the first PDF file
- Process and extract resume data

### Option 2: Download Specific File

Send a POST request with a specific file ID:

```bash
curl -X POST http://localhost:4000/api/upload-from-drive \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "your-file-id-here"
  }'
```

### Option 3: Use Default Folder

If `GOOGLE_DRIVE_FOLDER_ID` is set in `.env`, you can send an empty request:

```bash
curl -X POST http://localhost:4000/api/upload-from-drive \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Response Format

```json
{
  "success": true,
  "message": "Resume downloaded from Google Drive and processed successfully!",
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "linkedin": "https://linkedin.com/in/johndoe",
    "portfolio": "https://johndoe.com",
    "education": "Bachelor's Degree in Computer Science",
    "certs": "Certified AWS Solutions Architect",
    "experienceTitles": [
      "• Software Engineer | Company | 2020-2023",
      "• Intern | Company | 2019-2020"
    ]
  },
  "extractedFields": ["name", "email", "phone", "linkedin", "portfolio", "education", "experience", "competencies", "projects", "certs"],
  "hasHtmlTemplate": true,
  "pdfPath": "/path/to/saved/file.pdf",
  "fileName": "resume.pdf",
  "source": "Google Drive"
}
```

## Troubleshooting

### Error: "Google Drive authentication required"

**Solution:** Make sure `GOOGLE_SERVICE_ACCOUNT_KEY` is set in `.env` file with valid JSON.

### Error: "No PDF files found in the specified folder"

**Solutions:**
1. Make sure the folder contains PDF files
2. Verify the service account email has access to the folder
3. Check that the folder ID is correct

### Error: "Failed to authenticate with Google Drive"

**Solutions:**
1. Verify the JSON key is valid
2. Make sure the service account key hasn't expired
3. Check that the Drive API is enabled in Google Cloud Console

### Error: "Permission denied"

**Solutions:**
1. Make sure you shared the folder with the service account email
2. Verify the service account has "Viewer" permissions
3. Check that the folder is accessible

## Security Notes

- Never commit the service account key to version control
- Keep the `.env` file secure and never share it
- Use environment variables for production deployments
- Consider using a secrets management service for production

## Alternative: Using OAuth 2.0

For user-specific access (accessing user's own Drive files), you would need to implement OAuth 2.0 flow. This is more complex but allows users to authenticate with their own Google accounts.

See: https://developers.google.com/drive/api/quickstart/nodejs

