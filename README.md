# Prompt Enhancer

<p align="center">
  <img src="./PE_logo.png" alt="Prompt Enhancer Logo" width="200"/>
</p>

Prompt Enhancer is a VS Code extension that helps you improve your AI prompts to get better, more accurate responses from AI coding assistants.

## Features

- **One-Click Enhancement**: Select any text or prompt and enhance it with a single click
- **AI-Powered Improvements**: Uses Groq's LLaMA 3 model to make your prompts more specific, clear, and effective
- **Preview Before Applying**: See the enhanced prompt before deciding to apply it
- **Works Everywhere**: Enhances prompts in regular files, AI sidebars, or via direct input

![Prompt Enhancer in action](images/prompt-enhancer-demo.gif)

## Requirements

- VS Code 1.80.0 or higher
- A Groq API key (free tier available)

## Installation

### Direct Installation (Recommended)
1. Download the latest `.vsix` file from the [GitHub Releases](https://github.com/rachellarralde/prompt-enhancer-VScode/releases)
2. In VS Code, go to Extensions view (Ctrl+Shift+X)
3. Click the "..." at the top right of the Extensions panel
4. Select "Install from VSIX..."
5. Choose the downloaded `.vsix` file

### Command Line Installation
```code --install-extension prompt-enhancer-1.0.0.vsix
```

## Setup

1. Get a free Groq API key at [console.groq.com](https://console.groq.com/signup) (takes less than 2 minutes)
2. Open VS Code settings (File > Preferences > Settings)
3. Search for "Prompt Enhancer"
4. Enter your Groq API key in the settings field

## How to Use

1. **From a text file**:

- Select the text you want to enhance
- Click the ✨ icon in the status bar or use the command palette and search for "Enhance AI Prompt"
- Review the enhanced prompt and click "Apply Enhanced Prompt" to replace your text

2. **From the AI sidebar**:

- Click the ✨ icon in the status bar
- Enter your prompt in the input box
- The enhanced prompt will open in a new editor

3. **Without selection**:

- If no text is selected, the extension will use the visible text in the editor
- If no text is available, you'll be prompted to enter text manually

## Extension Settings

This extension contributes the following settings:

- `promptEnhancer.apiKey`: Your Groq API key for enhancing prompts

## Known Issues

- The extension requires a Groq API key to function
- The extension may not work with all AI sidebars or editors

## Release Notes

### 1.0.0

- Initial release of Prompt Enhancer
- Support for enhancing prompts using Groq's LLaMA 3 model
- Status bar integration
- Preview functionality

---

## About

This extension uses the Groq API to enhance prompts. It's designed to help you get better results from AI coding assistants by making your prompts more specific and effective.

**Enjoy more productive AI interactions!**
