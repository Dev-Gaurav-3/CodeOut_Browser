<div align="center">

<pre>
         ██████╗ ██████╗ ██████╗ ███████╗ ██████╗ ██╗   ██╗████████╗
        ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔═══██╗██║   ██║╚══██╔══╝
     ██║     ██║   ██║██║  ██║█████╗  ██║   ██║██║   ██║   ██║
        ██║     ██║   ██║██║  ██║██╔══╝  ██║   ██║██║   ██║   ██║   
        ╚██████╗╚██████╔╝██████╔╝███████╗╚██████╔╝╚██████╔╝   ██║   
        ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝    ╚═╝   
</pre>

</div>

<p align="center">
  <img src="icons/Logo2.png" width="100" alt="CodeOut">
</p>

<h3 align="center">The browser-side bridge between LeetCode and VS Code.</h3>

<p align="center">
  Connect LeetCode with your local VS Code environment using CodeOut.
</p>

<p align="center">
  <a href="https://github.com/Dev-Gaurav-3/CodeOut_VSCode">VS Code Extension</a>
  &nbsp;•&nbsp;
  <a href="https://github.com/Dev-Gaurav-3/CodeOut_Browser/issues">Report a Bug</a>
</p>

---

## 🚀 Overview

**CodeOut Browser Extension** is the browser-side component of CodeOut.

It connects the LeetCode webpage to the CodeOut local server and allows the VS Code extension to interact with LeetCode.

The extension handles:

- 📥 LeetCode problem extraction
- 🔄 Code synchronization
- 📝 Monaco editor interaction
- ▶️ Running LeetCode code
- 📤 Submitting solutions
- 🧪 Test-case result extraction
- 🔌 Communication with the CodeOut local server

The current implementation is built and tested for **Mozilla Firefox** using **Manifest V3**.

---

## ✨ Features

### 📥 Problem Extraction

Extracts information about the currently opened LeetCode problem, including:

- Problem ID
- Title
- Slug
- Difficulty
- Example test cases
- Language-specific code snippets

The problem information is sent to the CodeOut VS Code extension through the local server.

### 🔄 Code Synchronization

Receives code from VS Code and updates the LeetCode Monaco editor.

```text
VS Code
   ↓
CodeOut Server
   ↓
Browser Extension
   ↓
LeetCode Monaco Editor
```

### ▶️ Run LeetCode Code

Receives the Run command from VS Code and triggers LeetCode's native Run functionality.

### 🧪 Test-Case Result Extraction

Reads execution results from the LeetCode page and converts them into structured test-case results.

Example:

```javascript
[
  {
    case: "Case 1",
    status: "Accepted"
  },
  {
    case: "Case 2",
    status: "Wrong Answer"
  },
  {
    case: "Case 3",
    status: "Accepted"
  }
]
```

### 📤 Submit Solutions

Receives the Submit command from VS Code and triggers LeetCode's native Submit functionality.

### 🔁 Automatic Reconnection

The browser extension automatically reconnects to the local CodeOut server if the WebSocket connection is interrupted.

---

## 🏗️ Architecture

```text
┌──────────────────────────────┐
│           LeetCode           │
│                              │
│  Problem                     │
│  Monaco Editor               │
│  Test Cases                  │
│  Run / Submit                │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│           page.js            │
│                              │
│  • Monaco interaction        │
│  • Run / Submit              │
│  • Result extraction         │
└──────────────┬───────────────┘
               │
               │ window.postMessage
               ▼
┌──────────────────────────────┐
│         content.js           │
│                              │
│  Browser extension context   │
└──────────────┬───────────────┘
               │
               │ WebSocket
               ▼
┌──────────────────────────────┐
│        CodeOut Server        │
│      localhost:48721         │
└──────────────┬───────────────┘
               │
               │ WebSocket
               ▼
┌──────────────────────────────┐
│      CodeOut VS Code         │
│          Extension           │
└──────────────────────────────┘
```

---

## 🔄 Workflow

### Problem Transfer

```text
LeetCode
   ↓
CodeOut Browser Extension
   ↓
CodeOut Server
   ↓
CodeOut VS Code Extension
```

The browser extension extracts the current problem and sends it to VS Code.

### Code Synchronization

```text
VS Code
   ↓
CodeOut Server
   ↓
Browser Extension
   ↓
page.js
   ↓
LeetCode Monaco Editor
```

CodeOut updates the active LeetCode editor with the code received from VS Code.

### Running Code

```text
VS Code
   ↓
CodeOut Server
   ↓
Browser Extension
   ↓
page.js
   ↓
LeetCode Run
```

LeetCode's native Run functionality is triggered from the page.

### Receiving Results

```text
LeetCode
   ↓
page.js
   ↓
content.js
   ↓
CodeOut Server
   ↓
VS Code
```

The browser extension extracts individual test-case results and sends them back to VS Code.

### Submission

```text
VS Code
   ↓
CodeOut Server
   ↓
Browser Extension
   ↓
LeetCode Submit
```

---

## 🧩 Project Structure

```text
CodeOut_Browser/
│
├── manifest.json
├── background.js
├── content.js
├── page.js
│
├── resources/
│   └── CodeOut_sidebar_icon.svg
│
└── README.md
```

---

## 📄 Components

### `manifest.json`

Defines the Firefox WebExtension configuration, permissions, content scripts, and page access.

### `background.js`

Handles the CodeOut browser action and communicates with the active LeetCode tab.

### `content.js`

Acts as the communication layer between the browser extension, LeetCode page context, and CodeOut WebSocket server.

### `page.js`

Runs in the LeetCode page context and handles operations that require direct access to the LeetCode environment.

It is responsible for:

- Monaco editor interaction
- Updating LeetCode code
- Running code
- Submitting code
- Reading test-case results

---

## 🔌 WebSocket Server

The browser extension connects to the CodeOut local server:

```text
ws://localhost:48721
```

The server bridges communication between the browser extension and VS Code extension.

```text
┌──────────────┐
│    Firefox   │
└──────┬───────┘
       │
       │ WebSocket
       ▼
┌──────────────┐
│   CodeOut    │
│    Server    │
│    :48721    │
└──────┬───────┘
       │
       │ WebSocket
       ▼
┌──────────────┐
│    VS Code   │
└──────────────┘
```

---

## 📨 Communication Commands

CodeOut uses WebSocket messages to coordinate actions between its components.

Common commands include:

```text
register
syncCode
runCode
submit
testResults
```

---

## 🌐 Browser Compatibility

The current implementation targets:

**Mozilla Firefox**

using:

```text
WebExtensions API
Manifest V3
```

---

## 🛠️ Tech Stack

- JavaScript
- WebExtensions API
- Manifest V3
- WebSocket
- LeetCode GraphQL
- Monaco Editor
- DOM APIs

---

## 📦 Installation

### Temporary Firefox Installation

Clone the repository:

```bash
git clone https://github.com/Dev-Gaurav-3/CodeOut_Browser.git
cd CodeOut_Browser
```

Open Firefox and navigate to:

```text
about:debugging
```

Select:

```text
This Firefox
```

Then click:

```text
Load Temporary Add-on...
```

Select:

```text
manifest.json
```

The extension will now be loaded into Firefox.

---

## 💻 Requirements

To use the complete CodeOut workflow:

- Mozilla Firefox
- An active LeetCode session
- CodeOut Browser Extension
- CodeOut VS Code Extension

The CodeOut local server is started automatically by the VS Code extension.

---

## 🔐 Privacy

CodeOut communicates with the VS Code extension through a local server:

```text
localhost:48721
```

The browser-to-VS-Code communication bridge runs locally on the user's machine.

No CodeOut cloud account is required.

---

## 🚧 Project Status

The browser-side CodeOut workflow is implemented and tested.

### Working

- LeetCode problem extraction
- Problem transfer
- Code synchronization
- Monaco editor updates
- Run command
- Submit command
- Individual test-case result extraction
- Accepted result detection
- Wrong Answer detection
- Runtime Error detection
- Compile Error detection
- Time Limit Exceeded detection
- Memory Limit Exceeded detection
- WebSocket reconnection

---

## 🔮 Future Plans

- Support additional online judges
- Judge-specific adapters
- Additional browser support
- Improved result extraction
- More competitive programming integrations

---

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

If you find a bug or have an idea for improving CodeOut, please open an issue.

---

## 📄 License

See the repository license for details.

---

## 👨‍💻 Author

**Gaurav**

Built with ❤️ for competitive programmers, who are tired of switching Leetcode and VS Code.
