const vscode = require("vscode");
const { Groq } = require("groq-sdk");
const path = require("path");
const fs = require("fs");
const RateLimiter = require("./src/utils/rateLimiter");
const https = require("https");

let statusBarItem;

function activate(context) {
  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(sparkle)";
  statusBarItem.command = "prompt-enhancer.enhance";
  statusBarItem.show();

  // Use VSCode's secret storage
  const secretStorage = context.secrets;
  async function loadApiKey() {
    // Try settings first
    const config = vscode.workspace.getConfiguration("promptEnhancer");
    const apiKey = config.get("apiKey");
    if (apiKey) return apiKey;

    // Then try secure storage
    return await secretStorage.get("groq-api-key");
  }

  // Update the error message in enhancePrompt function
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error(
      "Groq API key not found. Please add it in Settings > Extensions > Prompt Enhancer."
    );
  }

  const rateLimit = {
    calls: 0,
    resetTime: Date.now(),
    limit: 10, // calls
    window: 60000, // 1 minute
  };

  async function checkRateLimit() {
    const now = Date.now();
    if (now - rateLimit.resetTime > rateLimit.window) {
      rateLimit.calls = 0;
      rateLimit.resetTime = now;
    }
    if (rateLimit.calls >= rateLimit.limit) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    rateLimit.calls++;
  }

  // Update the enhancePrompt function to use a supported model
  async function enhancePrompt(prompt) {
    await checkRateLimit();
    const apiKey = await loadApiKey();

    if (!apiKey) {
      throw new Error(
        "Groq API key not found. Please try again and enter your API key when prompted."
      );
    }

    const groq = new Groq({
      apiKey: apiKey,
      httpAgent: new https.Agent({
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
      }),
    });

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at improving prompts for AI coding assistants. Your task is to enhance prompts to be more specific, clear, and effective. Include technical context and expected output format where relevant. IMPORTANT: Provide ONLY the enhanced prompt text without any introductions, explanations, or conclusions. Do not start with phrases like 'Here's an enhanced prompt:' or end with explanations of what you did. Just return the enhanced prompt text directly.",
        },
        {
          role: "user",
          content: `Please enhance this prompt for better AI understanding and response: "${prompt}"`,
        },
      ],
      model: "llama3-70b-8192",
      temperature: 0.7,
      max_tokens: 1024,
    });

    let enhancedPrompt =
      response.choices[0]?.message?.content || "Could not enhance the prompt";

    // Clean up the response by removing common introductory and concluding phrases
    enhancedPrompt = enhancedPrompt
      // Remove introductory phrases
      .replace(
        /^(Here'?s? (an |the |your )?(enhanced|improved|better|updated|modified|revised) prompt:?)/i,
        ""
      )
      .replace(/^(Enhanced prompt:?)/i, "")
      .replace(/^(I'?ve enhanced your prompt:?)/i, "")
      .replace(/^(The enhanced version( of your prompt)?:?)/i, "")

      // Remove concluding phrases
      .replace(/(By providing .+)$/i, "")
      .replace(/(This (enhanced|improved) prompt (will|should) .+)$/i, "")
      .replace(/(This (should|will) help .+)$/i, "")

      // Trim whitespace
      .trim();

    return enhancedPrompt;
  }

  // Fix the AI sidebar issue by modifying the command handler
  let disposable = vscode.commands.registerCommand(
    "prompt-enhancer.enhance",
    async () => {
      // Check for API key first
      let apiKey = await loadApiKey();
      
      // If no API key is found, prompt the user to enter one
      if (!apiKey) {
        apiKey = await vscode.window.showInputBox({
          prompt: "Please enter your Groq API key to use Prompt Enhancer",
          placeHolder: "gsk_...",
          password: true, // Mask the input for security
          ignoreFocusOut: true,
          validateInput: (input) => {
            if (!input || !input.startsWith('gsk_') || input.length < 20) {
              return "Please enter a valid Groq API key (starts with gsk_)";
            }
            return null; // Input is valid
          }
        });
        
        if (!apiKey) {
          vscode.window.showInformationMessage("Prompt Enhancer requires a Groq API key to function.");
          return; // User cancelled
        }
        
        // Save the API key to settings
        await vscode.workspace.getConfiguration("promptEnhancer").update("apiKey", apiKey, true);
        vscode.window.showInformationMessage("API key saved successfully!");
      }

      const editor = vscode.window.activeTextEditor;

      // If no editor is active, ask the user to input text directly
      if (!editor) {
        const inputText = await vscode.window.showInputBox({
          prompt: "Enter the prompt you want to enhance",
          validateInput: (text) => {
            try {
              validateInput(text);
              return null; // Input is valid
            } catch (e) {
              return e.message;
            }
          },
          placeHolder: "Type your prompt here...",
          ignoreFocusOut: true,
          valueSelection: [0, 0],
        });

        if (!inputText) {
          return; // User cancelled
        }

        try {
          // Show loading indicator
          if (statusBarItem) {
            statusBarItem.text = "$(sync~spin)";
          }

          // Enhance the prompt
          const enhancedPrompt = await enhancePrompt(inputText);

          // Sanitize the input
          const sanitizedInput = sanitizeInput(enhancedPrompt);

          // Show the enhanced prompt in a new editor
          const document = await vscode.workspace.openTextDocument({
            content: sanitizedInput,
            language: "plaintext",
          });
          await vscode.window.showTextDocument(document);

          vscode.window.showInformationMessage("Prompt enhanced successfully!");
        } catch (error) {
          vscode.window.showErrorMessage(
            "Failed to enhance prompt. Please try again or check your settings."
          );
          // Log actual error for debugging
          console.error("Enhancement error:", error);
        } finally {
          // Restore status bar icon
          statusBarItem.text = "$(sparkle)";
        }
        return;
      }

      // For active editor, check if there's a selection or get all text
      const selection = editor.selection;
      let text = editor.document.getText(selection);

      // If no text is selected, use the entire document content
      if (!text || text.trim() === "") {
        // Try to get visible text from the editor
        const visibleRanges = editor.visibleRanges;
        if (visibleRanges && visibleRanges.length > 0) {
          text = editor.document.getText(visibleRanges[0]);
        } else {
          text = editor.document.getText();
        }

        if (!text || text.trim() === "") {
          // If still no text, prompt the user
          const inputText = await vscode.window.showInputBox({
            prompt: "No text found. Enter the prompt you want to enhance",
            placeHolder: "Type your prompt here...",
            validateInput: (text) => {
              try {
                validateInput(text);
                return null; // Input is valid
              } catch (e) {
                return e.message;
              }
            },
            ignoreFocusOut: true,
          });

          if (!inputText) {
            return; // User cancelled
          }

          text = inputText;
        }
      }

      try {
        // Show loading indicator
        statusBarItem.text = "$(sync~spin)";

        // Enhance the prompt
        const enhancedPrompt = await enhancePrompt(text);

        // Sanitize the input
        const sanitizedInput = sanitizeInput(enhancedPrompt);

        // Show preview and get confirmation
        const result = await vscode.window.showQuickPick(
          [
            {
              label: "Apply Enhanced Prompt",
              description: "Replace selected text with enhanced prompt",
              detail: sanitizedInput,
            },
            {
              label: "Cancel",
              description: "Keep original text",
              detail: text,
            },
          ],
          {
            placeHolder: "Enhanced Prompt (Preview):",
          }
        );

        if (result?.label === "Apply Enhanced Prompt") {
          await editor.edit((editBuilder) => {
            editBuilder.replace(selection, sanitizedInput);
          });
          vscode.window.showInformationMessage("Prompt enhanced successfully!");
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          "Failed to enhance prompt. Please try again or check your settings."
        );
        // Log actual error for debugging
        console.error("Enhancement error:", error);
      } finally {
        // Restore status bar icon
        statusBarItem.text = "$(sparkle)";
      }
    }
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(statusBarItem);
}

function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}

module.exports = {
  activate,
  deactivate,
};

// Add this near your other global variables
const rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute

// In your enhance prompt function, add rate limiting:
async function enhancePrompt(text) {
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    throw new Error(
      `Rate limit exceeded. Please wait ${Math.ceil(
        waitTime / 1000
      )} seconds before trying again.`
    );
  }

  try {
    const apiKey = await vscode.workspace
      .getConfiguration("promptEnhancer")
      .get("apiKey");
    if (!apiKey) {
      throw new Error(
        "Groq API key not found. Please add it in Settings > Extensions > Prompt Enhancer."
      );
    }

    const groq = new Groq({
      apiKey: apiKey,
      httpAgent: new https.Agent({
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
      }),
    });

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at improving prompts for AI coding assistants. Your task is to enhance prompts to be more specific, clear, and effective. Include technical context and expected output format where relevant. IMPORTANT: Provide ONLY the enhanced prompt text without any introductions, explanations, or conclusions. Do not start with phrases like 'Here's an enhanced prompt:' or end with explanations of what you did. Just return the enhanced prompt text directly.",
        },
        {
          role: "user",
          content: `Please enhance this prompt for better AI understanding and response: "${text}"`,
        },
      ],
      model: "llama3-70b-8192",
      temperature: 0.7,
      max_tokens: 1024,
    });
    return (
      response.choices[0]?.message?.content || "Could not enhance the prompt"
    );
  } catch (error) {
    vscode.window.showErrorMessage("Error enhancing prompt: " + error.message);
    throw error;
  }
}

// Modify the sanitizeInput function to be less aggressive
const sanitizeInput = (text) => {
// For plaintext display, we don't need to convert quotes to HTML entities
// Only sanitize potentially dangerous characters like < and >
return text.replace(/[<>]/g, (char) => {
const entities = {
"<": "&lt;",
">": "&gt;"
};
return entities[char];
});
};

const validateInput = (text) => {
  if (!text || text.length > 5000) {
    throw new Error("Invalid input length");
  }
  // Add other validation rules as needed
  return text.trim();
};
