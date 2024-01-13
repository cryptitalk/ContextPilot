# ContextPilot

A Visual Studio Code extension that helps manage contextual information within the editor, allowing users to interact with an AI service for enhanced coding experiences.

## Features

- **Context Management**: Easily add, view, and delete context from your code editor.
- **Clipboard Integration**: Add text directly from your clipboard to the extension's context.
- **AI-Enhanced Coding**: Use AI-powered services to interpret the context and provide coding insights.

## Requirements

This extension requires an OpenAI API key to interact with AI services, and only ChatGPT plus is supported.

## Installation

To install ContextPilot:

Go to vscode market place and install from there.

## Usage

After installing the extension, the following commands will be available:

- `Add Context`: Add the currently selected text to the context.
- `Add Clipboard Context`: Add text from your clipboard to the context.
- `Get Context`: Retrieve and display the stored context.
- `Set LLM Key`: Save your OpenAI key for AI-powered features.

## Configuration

No additional configuration is needed other than setting up your OpenAI API key with the `Set LLM Key` command.

## Extension Settings

Include if your extension adds any VSCode settings through `contributes.configuration`. For example:

- `contextCode`: A setting for storing the context data.
- `tempContextCode`: Temporarily holds context information to be sent to the AI service.

## Known Issues

Currently, there are no known issues. If you encounter any bugs, please report them on the project's GitHub issues page.

## Contributing

We welcome contributions! Please refer to our contribution guidelines for details on how to make a pull request.

## Change Log

Detailed changes for each release are documented in the [release notes](https://github.com/your-username/context-pilot/releases).

## License

This project is licensed under the [MIT License](LICENSE).

## Credits

Developed by [Crupti Talk](https://github.com/cryptitalk).

## Contact

If you have any questions or feedback, please create an issue on the project's [GitHub issues page](https://github.com/your-username/context-pilot/issues).
