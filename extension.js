const vscode = require("vscode");
const { Groq } = require("groq-sdk");
const path = require("path");
const fs = require("fs");

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

  // Load API key from .env file manually
  // Replace the loadApiKey function with this:
  function loadApiKey() {
    // Try to get API key from settings
    const config = vscode.workspace.getConfiguration("promptEnhancer");
    const apiKey = config.get("apiKey");

    if (apiKey) {
      console.log("API key loaded from settings");
      return apiKey;
    }

    // Fallback to .env file for backward compatibility
    try {
      const envPath = path.join(__dirname, ".env");
      console.log("Looking for .env file at:", envPath);

      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        const match = envContent.match(/GROQ_API_KEY=(.+)/);
        if (match && match[1]) {
          console.log("API key loaded from .env file");
          return match[1].trim();
        }
      }

      console.log("No API key found");
      return null;
    } catch (error) {
      console.error("Error loading API key:", error);
      return null;
    }
  }

  // Update the error message in enhancePrompt function
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error(
      "Groq API key not found. Please add it in Settings > Extensions > Prompt Enhancer."
    );
  }

  // Update the enhancePrompt function to use a supported model
  async function enhancePrompt(prompt) {
    const apiKey = loadApiKey();

    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY not found in .env file. Please add it and restart the extension."
      );
    }

    const groq = new Groq({
      apiKey: apiKey,
    });

    const completion = await groq.chat.completions.create({
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
      completion.choices[0]?.message?.content || "Could not enhance the prompt";

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
      const editor = vscode.window.activeTextEditor;

      // If no editor is active, ask the user to input text directly
      if (!editor) {
        const inputText = await vscode.window.showInputBox({
          prompt: "Enter the prompt you want to enhance",
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

          // Show the enhanced prompt in a new editor
          const document = await vscode.workspace.openTextDocument({
            content: enhancedPrompt,
            language: "plaintext",
          });
          await vscode.window.showTextDocument(document);

          vscode.window.showInformationMessage("Prompt enhanced successfully!");
        } catch (error) {
          vscode.window.showErrorMessage(
            "Failed to enhance prompt: " + error.message
          );
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

        // Show preview and get confirmation
        const result = await vscode.window.showQuickPick(
          [
            {
              label: "Apply Enhanced Prompt",
              description: "Replace selected text with enhanced prompt",
              detail: enhancedPrompt,
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
            editBuilder.replace(selection, enhancedPrompt);
          });
          vscode.window.showInformationMessage("Prompt enhanced successfully!");
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          "Failed to enhance prompt: " + error.message
        );
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
