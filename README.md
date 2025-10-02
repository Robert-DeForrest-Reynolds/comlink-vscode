# comlink


### What is the point?
I think documentation, and commenting is important. The thing is, it's incredibly subjective. All comments being there benefits everyone, but everyone personally only needs few comments here and there on things they specifically don't understand.
As well, for incredibly large, and convoluted projects, it could prove very fruitful to have a heavily-detailed documentation embedded within the source files, but bloating the files themselves has always been a problem.

`comlink` is a utility that can be added to any capable text editor, and this is a VSCode extension for using comlink. comlink allows developers to create, view, and manage comments using unique IDs without cluttering the source files themselves.

---

## What is comlink?

comlink is a utility for communicating with text editors about a project's external comments.  
The idea is simple: documentation and commenting are valuable, but they can clutter source files.<br>
comlink allows you to:
- Keep your code clean while storing comments externally.
- Display comments in the editor as tooltips when hovering over comment IDs.
- Retrieve, create, edit, and delete comments.

This VSCode extension integrates comlink directly into the editor.

---

## Features

- Initialize a project-specific comlink directory.
- Create comments inline that are automatically converted into unique IDs.
- Hover over comment IDs to view the full comment in a tooltip.
- Delete comments directly from the editor.

---

## Installation

1. Clone this repository or install via VSCode Marketplace (if available).
2. Ensure Python 3 is installed and available in your PATH.
3. Open a project folder in VSCode.
4. Run the `comlink: Initialize comlink directory` command from the Command Palette.

---

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `comlink.init` | Initialize a comlink directory in the workspace. |
| `comlink.del`  | Delete the comment on the current line. |

### Comment Creation Workflow

1. Type a comment in the editor using the `~*~` syntax (e.g., `#~* This is my comment ~`).
2. When you finish the comment, comlink assigns a unique ID and replaces your text with `<comment-symbol>ID:<id>`.
3. Hover over the ID to see the full comment.

- Hovering over an ID in your code triggers a call to comlink to fetch and display the comment.

- Place the cursor on a comment ID and run `comlink.del` to remove it from both the code and the external database.

---

## Planned Features

- Higher ceiling for unique ID encoding.
- Editing existing comments from the editor.
- Ability to optionally remove comment ID's from source for production builds, or source releases.
- Optional AI-assisted comment generation for unannotated lines.
- Neovim plugin support.
- Optional rewrite in C for performance improvements.

---

## Requirements

- [Python 3](https://www.python.org/)
- VSCode 1.104.0 or later

---

## Contributing

[comlink-vscode](https://github.com/Robert-DeForrest-Reynolds/comlink-vscode)

Please follow standard GitHub workflow:
1. Fork the repository.
2. Create a feature branch.
3. Submit a pull request with a clear description of changes.

---

## License

MIT License © Robert DeForrest-Reynolds