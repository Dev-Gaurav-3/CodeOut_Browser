# CodeOut — Browser Extension

> 🚀 Connect LeetCode with VS Code and eliminate the repetitive work of copying code and test cases.

CodeOut is a browser extension that connects **LeetCode** with the **CodeOut VS Code extension**.

It allows you to send LeetCode problems directly to VS Code, synchronize your code back to LeetCode, run LeetCode test cases from VS Code, and submit solutions without constantly switching between windows.

---

## ✨ Features

- 📥 Send LeetCode problems directly to VS Code
- 🔄 Sync code between LeetCode and VS Code
- ▶️ Run LeetCode test cases from VS Code
- 📤 Submit solutions directly from VS Code
- 🧪 Receive individual test-case results
- ⚡ Real-time communication using WebSockets
- 🔌 Automatic connection with the CodeOut local server
- 🌐 Supports multiple programming languages

---

## 🏗️ Architecture

```text
┌──────────────────────┐
│       LeetCode       │
│                      │
│  Monaco Editor       │
│  Test Cases          │
│  Run / Submit        │
└──────────┬───────────┘
           │
           │ DOM / Monaco
           ▼
┌──────────────────────┐
│      page.js         │
│                      │
│ LeetCode page logic  │
└──────────┬───────────┘
           │
           │ window.postMessage
           ▼
┌──────────────────────┐
│     content.js       │
│                      │
│ Browser extension    │
└──────────┬───────────┘
           │
           │ WebSocket
           ▼
┌──────────────────────┐
│    CodeOut Server    │
│     localhost        │
│      :48721          │
└──────────┬───────────┘
           │
           │ WebSocket
           ▼
┌──────────────────────┐
│  CodeOut VS Code     │
│     Extension        │
└──────────────────────┘