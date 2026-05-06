# 🎙️ Voice Explainer AI

Voice Explainer AI is a **Tkinter-based desktop application** that
allows users to **analyze, summarize, and interact with files using both
voice and text commands**. It uses **OpenAI's GPT models** for
understanding and explanation, combined with **speech recognition** and
**text-to-speech (TTS)** for a complete hands-free experience.

------------------------------------------------------------------------

## ✨ Features

-   📁 **Browse and Analyze Files** --- Upload any text or code file to
    get a simple AI-generated explanation.
-   🧠 **AI-Powered Summaries** --- Summarize and understand complex
    files using GPT.
-   🎤 **Voice Question Mode** --- Ask questions about the file using
    your voice.
-   💬 **Text Question Mode** --- Type questions for precise queries.
-   🔊 **Text-to-Speech Output** --- Hear explanations and summaries
    aloud.
-   🕶️ **Dark Mode UI** --- Modern dark-themed interface built with
    Tkinter.
-   📜 **Recent Files** --- Automatically keeps track of your 10 most
    recent files.

------------------------------------------------------------------------

## ⚙️ Installation

### 1. Clone or Download

``` bash
git clone https://github.com/yourusername/voice-explainer-ai.git
cd voice-explainer-ai
```

Or simply **download the `.py` file** and place it in a folder.

### 2. Install Requirements

Make sure Python 3.8+ is installed. Then run:

``` bash
pip install openai pyttsx3 SpeechRecognition tkinter
```

> Note: `tkinter` usually comes pre-installed with Python.\
> On some systems, you might also need to install `pyaudio` separately:
>
> ``` bash
> pip install pyaudio
> ```

### 3. Set OpenAI API Key

You can set your API key using one of the following methods:

#### Option 1: Environment Variable (Recommended)

``` bash
setx OPENAI_API_KEY "your_api_key_here"
```

#### Option 2: `.env` File

Create a `.env` file in the same folder as the script:

    OPENAI_API_KEY=your_api_key_here

------------------------------------------------------------------------

## 🚀 Usage

Run the app:

``` bash
python voice_explainer_ai.py
```

Then:

1.  Click **📁 Browse File** and select any text or code file.
2.  Click **🤖 Analyze & Summarize** to let the AI explain it.
3.  Use **🎤 Ask (Voice)** or **💬 Ask (Text)** to ask questions.
4.  Click **🔊 Speak Output** to listen to the explanation.
5.  The bottom bar shows status updates in real time.

------------------------------------------------------------------------

## 📂 Project Structure

    voice-explainer-ai/
    │
    ├── voice_explainer_ai.py     # Main Application Script
    ├── recent_files.json          # Automatically generated for tracking recent files
    ├── .env                       # Store your OpenAI API Key
    └── README.md                  # Documentation file

------------------------------------------------------------------------

## 🧩 Key Components

  -----------------------------------------------------------------------
  Component                          Description
  ---------------------------------- ------------------------------------
  **openai**                         Connects to GPT API for text
                                     summarization and question answering

  **pyttsx3**                        Provides text-to-speech capability

  **SpeechRecognition**              Captures and processes voice input

  **tkinter**                        GUI framework for the app

  **threading**                      Keeps UI responsive during long
                                     tasks
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 💡 Tips

-   If your microphone is not working, check your system input device
    settings.

-   If TTS voice is too fast or slow, adjust the `rate` in:

    ``` python
    engine.setProperty("rate", 170)
    ```

-   If OpenAI API key is invalid or missing, you'll see a popup alert.

------------------------------------------------------------------------

## 🧑‍💻 Author

**Renin Francy T.**\
📧 \[GitHub Profile / Portfolio Placeholder\]

------------------------------------------------------------------------

## 🛠️ License

MIT License © 2025 Renin Francy T.
"# resume-builder" 
