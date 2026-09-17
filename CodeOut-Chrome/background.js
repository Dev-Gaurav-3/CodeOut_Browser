/**
 * CodeOut - background
 *
 * Runs as an event page in Firefox and as a service worker in Chrome/Edge.
 *
 * This owns the ONE persistent WebSocket to the local CodeOut server for
 * the whole browser. It used to live in content.js, but as of Chrome 147
 * (April 2026), Chrome's Local Network Access (LNA) restrictions block
 * WebSocket connections from a page's own origin to localhost. An
 * extension background context with the matching host_permissions is
 * exempt from that check, which is why the socket lives here instead.
 *
 * Chrome MV3 tears this worker down after ~30s idle - but since Chrome 116,
 * any WebSocket traffic resets that timer, so the keepalive ping below is
 * what keeps both the worker and the socket alive between real commands.
 */

const api = globalThis.browser ?? globalThis.chrome;

const SERVER_ORIGIN = "http://localhost:48721";
const SERVER_WS = "ws://localhost:48721";

/* ------------------------------------------------------------------ */
/* Toolbar click -> tell the active tab's content script to start      */
/* ------------------------------------------------------------------ */

api.action.onClicked.addListener(async (tab) => {
    if (!tab?.id) {
        return;
    }

    try {
        await api.tabs.sendMessage(tab.id, {
            type: "CODEOUT_START"
        });
    } catch (error) {
        // Thrown when no content script is listening on this tab
        // (wrong site, or the page loaded before the extension did).
        console.error(
            "CodeOut: no content script on this tab. Reload the LeetCode page.",
            error
        );
    }
});

/* ------------------------------------------------------------------ */
/* One-off relay for POSTing a scraped problem to the local server     */
/* ------------------------------------------------------------------ */

/**
 * A content-script fetch carries the page's origin (https://leetcode.com),
 * so Chrome subjects it to CORS and to Local Network Access checks. Here in
 * the background, host_permissions grant a bypass for both.
 *
 * The listener is deliberately NOT async: Chrome interprets a returned
 * Promise as "a response is coming" and then logs a port-closed error.
 * Return literal `true` instead, and call sendResponse yourself.
 */
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "CODEOUT_SEND_PROBLEM") {
        return;
    }

    fetch(`${SERVER_ORIGIN}/problem`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(message.problem)
    })
    .then((response) => {
        sendResponse({
            ok: response.ok,
            status: response.status
        });
    })
    .catch((error) => {
        sendResponse({
            ok: false,
            error: String(error)
        });
    });

    return true;
});

/* ------------------------------------------------------------------ */
/* Persistent WebSocket to the local CodeOut server                    */
/* ------------------------------------------------------------------ */

let socket = null;
let reconnectTimer = null;
let keepAliveTimer = null;

// Every LeetCode tab's content script holds a long-lived port here. A
// port being open also counts as extension activity, so this doubles as
// a second, independent way to keep the worker from being recycled.
const ports = new Set();

function connectSocket() {
    if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }

    socket = new WebSocket(SERVER_WS);

    socket.addEventListener("open", () => {
        socket.send(
            JSON.stringify({
                type: "register",
                client: "browser"
            })
        );
        startKeepAlive();
    });

    socket.addEventListener("message", (event) => {
        let data;

        try {
            data = JSON.parse(event.data);
        } catch (error) {
            console.error("CodeOut: bad server payload", error);
            return;
        }

        // Broadcast to every LeetCode tab currently connected. In the
        // common case there's exactly one.
        for (const port of ports) {
            try {
                port.postMessage(data);
            } catch (error) {
                // Port died without firing onDisconnect yet.
                ports.delete(port);
            }
        }
    });

    socket.addEventListener("error", (error) => {
        console.error("CodeOut WebSocket error:", error);
    });

    socket.addEventListener("close", () => {
        stopKeepAlive();
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectSocket, 2000);
    });
}

function startKeepAlive() {
    stopKeepAlive();

    keepAliveTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(
                JSON.stringify({
                    command: "__keepalive__"
                })
            );
        }
    }, 20000);
}

function stopKeepAlive() {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
}

connectSocket();

/* ------------------------------------------------------------------ */
/* Long-lived ports to each LeetCode tab's content script               */
/* ------------------------------------------------------------------ */

api.runtime.onConnect.addListener((port) => {
    if (port.name !== "codeout-tab") {
        return;
    }

    ports.add(port);

    port.onMessage.addListener((message) => {
        if (
            message?.type === "LEETCODE_TEST_RESULTS" &&
            socket?.readyState === WebSocket.OPEN
        ) {
            socket.send(
                JSON.stringify({
                    command: "testResults",
                    results: message.results
                })
            );
        }
    });

    port.onDisconnect.addListener(() => {
        ports.delete(port);
    });
});
