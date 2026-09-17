let codeOutTestcases = [];
let codeOutIsContestProblem = false;


function getContestResultPanel() {
    const panels = Array.from(
        document.querySelectorAll('[id^="contest-result-"]')
    );

    return panels[panels.length - 1] ?? null;
}

function getContestOutputs(panel = getContestResultPanel()) {
    if (!panel) {
        return [];
    }

    const hiddenResult = panel.querySelector(
        ".mt-0.h-0.overflow-hidden.opacity-0"
    );

    if (!hiddenResult) {
        return [];
    }

    const editors = Array.from(
        hiddenResult.querySelectorAll(".cm-editor")
    );

    if (editors.length < 2) {
        return [];
    }

    const outputEditor = editors[1];

    return Array.from(
        outputEditor.querySelectorAll(".cm-line")
    )
    .map((line) => line.textContent.trim())
    .filter(Boolean);
}

function normalizeContestOutput(value) {
    return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function contestOutputsMatch(actual, expected) {
    const normalizedActual =
    normalizeContestOutput(actual);

    const normalizedExpected =
    normalizeContestOutput(expected);

    if (normalizedActual === normalizedExpected) {
        return true;
    }

    try {
        return (
            JSON.stringify(
                JSON.parse(normalizedActual)
            ) ===
            JSON.stringify(
                JSON.parse(normalizedExpected)
            )
        );
    } catch {
        return false;
    }
}

function sendContestResults(outputs) {
    const results = codeOutTestcases.map(
        (testcase, index) => {
            const actual = outputs[index] ?? "";
            const expected =
            testcase.expectedOutput ?? "";

            return {
                case: `Case ${index + 1}`,
                    status: contestOutputsMatch(
                        actual,
                        expected
                    )
                    ? "Accepted"
                    : "Wrong Answer",
                    output: normalizeContestOutput(actual)
            };
        }
    );

    window.postMessage(
        {
            source: "CodeOut",
            type: "LEETCODE_TEST_RESULTS",
            results
        },
        "*"
    );
}

function watchContestTestResults() {
    const startPanel = getContestResultPanel();
    const startSignature = getContestSignature(
        startPanel
    );

    let runStarted = !startPanel;
    let lastSignature = "";
    let stableSince = 0;
    let checkTimer;
    let timeoutTimer;

    const cleanup = () => {
        clearInterval(checkTimer);
        clearTimeout(timeoutTimer);
        observer.disconnect();
    };

    const finish = (results) => {
        window.postMessage(
            {
                source: "CodeOut",
                type: "LEETCODE_TEST_RESULTS",
                results
            },
            "*"
        );

        cleanup();
    };

    const observer =
    new MutationObserver(() => {
        const panel =
        getContestResultPanel();

        if (!panel) {
            return;
        }

        if (
            panel !== startPanel ||
            getContestSignature(panel) !==
            startSignature
        ) {
            runStarted = true;
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    checkTimer = setInterval(() => {
        const panel =
        getContestResultPanel();

        if (!panel) {
            return;
        }

        const signature =
        getContestSignature(panel);

        if (
            panel !== startPanel ||
            signature !== startSignature
        ) {
            runStarted = true;
        }

        if (!runStarted) {
            return;
        }

        const panelText =
        panel.textContent ?? "";

        const errorStatus =
        getContestExecutionError(panelText);

        if (errorStatus) {
            const outputs =
            getContestOutputs(panel);

            finish(
                codeOutTestcases.map(
                    (_, index) => ({
                        case: `Case ${index + 1}`,
                            status: errorStatus,
                            output:
                            normalizeContestOutput(
                                outputs[index] ?? ""
                            )
                    })
                )
            );

            return;
        }

        const resultStatus =
        panel.querySelector(
            '[data-e2e-locator="console-result"]'
        )?.textContent.trim();

        if (resultStatus !== "Finished") {
            lastSignature = "";
            stableSince = 0;
            return;
        }

        const outputs =
        getContestOutputs(panel);

        if (
            outputs.length <
            codeOutTestcases.length
        ) {
            lastSignature = signature;
            stableSince = 0;
            return;
        }

        const outputSignature =
        outputs
        .map((output) =>
        normalizeContestOutput(output)
        )
        .join("\u0000");

        if (
            outputSignature !== lastSignature
        ) {
            lastSignature = outputSignature;
            stableSince = Date.now();
            return;
        }

        if (
            Date.now() - stableSince <
            150
        ) {
            return;
        }

        sendContestResults(outputs);
        cleanup();
    }, 100);

    timeoutTimer = setTimeout(() => {
        cleanup();
    }, 15000);
}

function getContestSignature(panel) {
    if (!panel) {
        return "";
    }

    const status =
    panel.querySelector(
        '[data-e2e-locator="console-result"]'
    )?.textContent.trim() ?? "";

    const outputs =
    getContestOutputs(panel);

    return [
        status,
        outputs.join("\u0000"),
        panel.textContent?.length ?? 0
    ].join("|");
}

function getContestExecutionError(text) {
    if (text.includes("Compile Error")) {
        return "Compile Error";
    }

    if (
        text.includes(
            "Time Limit Exceeded"
        )
    ) {
        return "Time Limit Exceeded";
    }

    if (
        text.includes(
            "Memory Limit Exceeded"
        )
    ) {
        return "Memory Limit Exceeded";
    }

    if (text.includes("Runtime Error")) {
        return "Runtime Error";
    }

    return null;
}

function getTestCaseResults() {
    // Normal LeetCode problems
    const cases = Array.from(
        document.querySelectorAll("div")
    ).filter((el) =>
    /^Case \d+$/.test(el.textContent.trim())
    );

    const resultMap = new Map();

    for (const caseText of cases) {
        const caseNumber = caseText.textContent.trim();
        const container = caseText.closest(".cursor-pointer");

        if (!container) {
            continue;
        }

        const text = container.textContent.trim();

        let status = null;

        if (
            container.querySelector(".fa-square-check")
        ) {
            status = "Accepted";
        } else if (
            container.querySelector(".fa-square-xmark") ||
            text.includes("Wrong Answer") ||
            text.includes("Time Limit Exceeded") ||
            text.includes("Memory Limit Exceeded") ||
            text.includes("Compile Error") ||
            text.includes("Runtime Error")
        ) {
            status = "Wrong Answer";
        }

        if (status) {
            resultMap.set(caseNumber, {
                case: caseNumber,
                    status
            });
        }
    }

    const editors = Array.from(
        document.querySelectorAll(".cm-editor")
    );

    let outputs = [];

    if (editors.length >= 2) {
        const outputEditor = editors[1];

        outputs = Array.from(
            outputEditor.querySelectorAll(".cm-line")
        ).map((line) => line.textContent.trim());
    }

    const results = Array.from(
        resultMap.values()
    ).sort((a, b) => {
        const numA = Number(
            a.case.match(/\d+/)[0]
        );

        const numB = Number(
            b.case.match(/\d+/)[0]
        );

        return numA - numB;
    });

    results.forEach((result, index) => {
        result.output = outputs[index] ?? "";
    });

    return results;
}

window.addEventListener("message", (event) => {
    if (event.source !== window) {
        return;
    }

    const { source, type } = event.data ?? {};

    if (source !== "CodeOut") {
        return;
    }

    if (type === "SET_TESTCASES") {
        codeOutTestcases =
        event.data.testcases ?? [];

        codeOutIsContestProblem =
        event.data.isContestProblem === true;

        return;
    }

    if (type === "SET_CODE") {
        setLeetCodeCode(event.data.code);
        return;
    }

    if (type === "RUN_CODE") {
        runLeetCode();
        return;
    }

    if (type === "SUBMIT_CODE") {
        submitLeetCode();
    }
});

function setLeetCodeCode(code) {
    // Normal LeetCode editor
    if (typeof monaco !== "undefined") {
        const editors = monaco.editor.getEditors();

        if (editors.length) {
            editors[0].setValue(code);
            return;
        }
    }

    // Contest CodeMirror editor
    const content = document.querySelector(".cm-content");

    if (!content?.cmView?.view) {
        console.log("❌ CodeMirror editor not found");
        return;
    }

    const view = content.cmView.view;

    view.dispatch({
        changes: {
            from: 0,
            to: view.state.doc.length,
            insert: code
        }
    });
}

function runLeetCode() {
    let runButton = document.querySelector(
        'button[data-e2e-locator="console-run-button"]'
    );

    if (!runButton) {
        runButton = Array.from(
            document.querySelectorAll("button")
        ).find(
            (button) =>
            button.textContent.trim() === "Run"
        );
    }

    if (!runButton) {
        console.log(
            "❌ LeetCode Run button not found"
        );
        return;
    }

    if (codeOutIsContestProblem) {
        watchContestTestResults();
    } else {
        watchTestResults();
    }

    runButton.click();
}

function submitLeetCode() {
    let submitButton = document.querySelector(
        'button[data-e2e-locator="console-submit-button"]'
    );

    if (!submitButton) {
        submitButton = Array.from(
            document.querySelectorAll("button")
        ).find(
            (button) =>
            button.textContent.trim() === "Submit"
        );
    }

    if (!submitButton) {
        console.log(
            "❌ LeetCode Submit button not found"
        );
        return;
    }

    submitButton.click();
}

function watchTestResults() {
    const observer = new MutationObserver(() => {
        const bodyText = document.body.innerText;

        const hasCompileError =
        bodyText.includes("Compile Error");

        const hasTimeLimit =
        bodyText.includes(
            "Time Limit Exceeded"
        );

        const hasMemoryLimit =
        bodyText.includes(
            "Memory Limit Exceeded"
        );

        const hasRuntimeError =
        bodyText.includes("Runtime Error");

        const hasExecutionError =
        hasCompileError ||
        hasTimeLimit ||
        hasMemoryLimit ||
        hasRuntimeError;

        // Normal LeetCode execution errors
        if (hasExecutionError) {
            const results = getTestCaseResults();

            if (results.length === 0) {
                window.postMessage(
                    {
                        source: "CodeOut",
                        type: "LEETCODE_TEST_RESULTS",
                        results: [
                            {
                                case: "Case 1",
                                    status: "Wrong Answer",
                                    output: ""
                            }
                        ]
                    },
                    "*"
                );
            } else {
                results.forEach((result) => {
                    if (
                        result.status !== "Accepted"
                    ) {
                        result.status =
                        "Wrong Answer";
                    }
                });

                window.postMessage(
                    {
                        source: "CodeOut",
                        type: "LEETCODE_TEST_RESULTS",
                        results
                    },
                    "*"
                );
            }

            observer.disconnect();
            return;
        }

        // Normal Accepted / Wrong Answer
        const results = getTestCaseResults();

        if (results.length === 0) {
            return;
        }

        window.postMessage(
            {
                source: "CodeOut",
                type: "LEETCODE_TEST_RESULTS",
                results
            },
            "*"
        );

        observer.disconnect();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
    });
}
