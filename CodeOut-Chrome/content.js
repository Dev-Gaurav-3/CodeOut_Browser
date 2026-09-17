/**
 * CodeOut - content script (isolated world)
 *
 * Bridges three things:
 *   background (owns the WebSocket)  <-- port -->  this script  <-- postMessage -->  page.js
 *
 * The WebSocket itself lives in the background service worker, not here.
 * Chrome's Local Network Access restrictions (Chrome 147+) block a
 * WebSocket opened from a page's own origin to localhost; a request from
 * the background context with matching host_permissions is exempt. This
 * script only relays over a long-lived runtime port.
 */

const api = globalThis.browser ?? globalThis.chrome;

let port = null;

/* ------------------------------------------------------------------ */
/* page.js handshake                                                   */
/* ------------------------------------------------------------------ */

/**
 * page.js is normally injected declaratively via `"world": "MAIN"`.
 * On browsers that ignore that key (Chrome < 111, Firefox < 128) it lands
 * in the isolated world instead, where `monaco` is invisible. page.js
 * detects that and stays silent, so if no PAGE_READY arrives we fall back
 * to injecting a <script> tag.
 *
 * The fallback is CSP-dependent and may itself be blocked on Chromium.
 * That is expected - it only ever runs on browsers too old for world:MAIN.
 */

let pageReady = false;
let fallbackInjected = false;

function pingPageScript() {
    window.postMessage(
        {
            source: "CodeOut",
            type: "PING"
        },
        "*"
    );
}

function injectPageScriptFallback() {
    if (fallbackInjected || pageReady) {
        return;
    }

    fallbackInjected = true;

    console.warn(
        "CodeOut: world:MAIN unavailable, falling back to script injection."
    );

    const script = document.createElement("script");

    script.src = api.runtime.getURL("page.js");

    script.onload = () => {
        script.remove();
    };

    (document.head || document.documentElement).appendChild(script);
}

pingPageScript();
setTimeout(pingPageScript, 400);
setTimeout(injectPageScriptFallback, 1000);

/* ------------------------------------------------------------------ */
/* Port to the background's WebSocket                                  */
/* ------------------------------------------------------------------ */

function connectPort() {
    port = api.runtime.connect({ name: "codeout-tab" });

    port.onMessage.addListener((data) => {
        if (data.command === "__keepalive__") {
            return;
        }

        if (data.command === "syncCode") {
            window.postMessage(
                {
                    source: "CodeOut",
                    type: "SET_CODE",
                    code: data.code,
                    language: data.language
                },
                "*"
            );
        }

        if (data.command === "runCode") {
            window.postMessage(
                {
                    source: "CodeOut",
                    type: "RUN_CODE"
                },
                "*"
            );
        }

        if (data.command === "submit") {
            window.postMessage(
                {
                    source: "CodeOut",
                    type: "SUBMIT_CODE"
                },
                "*"
            );
        }
    });

    port.onDisconnect.addListener(() => {
        // Fires if the service worker was recycled or the extension was
        // reloaded. Reconnect so commands keep flowing.
        port = null;
        setTimeout(connectPort, 500);
    });
}

connectPort();

/* ------------------------------------------------------------------ */
/* Toolbar click -> scrape problem -> hand to VS Code                  */
/* ------------------------------------------------------------------ */

/**
 * Synchronous listener. An `async` listener returns a Promise, which Chrome
 * reads as "sendResponse is coming" and then reports as a closed port.
 */
api.runtime.onMessage.addListener((message) => {
    if (message?.type !== "CODEOUT_START") {
        return;
    }

    handleStart();
});

async function handleStart() {
    const url = new URL(window.location.href);

    const match = url.pathname.match(/\/(?:problems|problem)\/([^/]+)/);

    if (!match) {
        console.error("CodeOut: Could not find problem slug");
        return;
    }

    const questionName = match[1];
    const isContestProblem = url.pathname.includes("/contest/");

    let data;

    try {
        data = await getProblem(questionName);
    } catch (error) {
        console.error("CodeOut: GraphQL request failed", error);
        return;
    }

    if (!data?.data?.question) {
        console.error("CodeOut: Problem data not found");
        return;
    }

    const question = data.data.question;

    const examples = getExamples(question.content);

    const finalTC = examples.map((example) => ({
        input: example.input,
        expectedOutput: example.expectedOutput
    }));

    const problem = {
        slug: question.titleSlug,
        questionFrontendId: question.questionFrontendId,
        title: question.title,
        difficulty: question.difficulty,
        testcases: finalTC,
        codeSnippets: question.codeSnippets
    };

    window.postMessage(
        {
            source: "CodeOut",
            type: "SET_TESTCASES",
            testcases: finalTC,
            isContestProblem
        },
        "*"
    );

    // Routed through the background: a direct fetch from here would be
    // blocked by CORS / Private Network Access on Chromium.
    try {
        const result = await api.runtime.sendMessage({
            type: "CODEOUT_SEND_PROBLEM",
            problem
        });

        if (result?.ok) {
            console.log("CodeOut problem sent:", result.status);
        } else {
            console.error(
                "CodeOut: server rejected the problem",
                result?.status ?? result?.error
            );
        }
    } catch (error) {
        console.error("Failed to contact CodeOut server:", error);
    }
}

/* ------------------------------------------------------------------ */
/* Results coming back up from page.js                                 */
/* ------------------------------------------------------------------ */

window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "CodeOut") {
        return;
    }

    if (event.data.type === "PAGE_READY") {
        pageReady = true;
        return;
    }

    if (event.data.type === "LEETCODE_TEST_RESULTS") {
        if (!port) {
            console.warn("CodeOut: results dropped, not connected to background");
            return;
        }

        try {
            port.postMessage({
                type: "LEETCODE_TEST_RESULTS",
                results: event.data.results
            });
        } catch (error) {
            console.warn("CodeOut: failed to relay results", error);
        }
    }
});

/* ------------------------------------------------------------------ */
/* LeetCode GraphQL                                                    */
/* ------------------------------------------------------------------ */

async function getProblem(titleSlug) {
    const response = await fetch("https://leetcode.com/graphql/", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            operationName: "questionData",
            variables: {
                titleSlug
            },
            query: `
            query questionData($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionFrontendId
                    title
                    titleSlug
                    difficulty
                    content
                    exampleTestcases
                    codeSnippets {
                        lang
                        langSlug
                        code
                    }
                }
            }
            `
        })
    });

    return response.json();
}

function getExamples(content) {
    const parser = new DOMParser();

    // Preserve line breaks from LeetCode HTML
    const normalized = content
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|pre)>/gi, "\n");

    const doc = parser.parseFromString(normalized, "text/html");

    const text = doc.body.textContent
        .replace(/\u00a0/g, " ")
        .replace(/\r/g, "")
        .replace(/\n[ \t]+/g, "\n")
        .trim();

    const examples = [];

    // Split the problem into Example 1, Example 2, Example 3...
    const blocks = text.split(/Example\s+\d+\s*:/i);

    for (const block of blocks.slice(1)) {
        const inputMatch = block.match(
            /Input\s*:\s*([\s\S]*?)(?=\s*Output\s*:)/i
        );

        const outputMatch = block.match(
            /Output\s*:\s*([\s\S]*?)(?=\s*(?:Explanation|Constraints|Follow-up|Note)\s*:|$)/i
        );

        if (!inputMatch || !outputMatch) {
            continue;
        }

        const input = inputMatch[1].trim();
        const expectedOutput = outputMatch[1].trim();

        if (!input || !expectedOutput) {
            continue;
        }

        examples.push({
            input,
            expectedOutput
        });
    }

    return examples;
}
