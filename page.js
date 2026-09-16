let codeOutTestcases = [];
let codeOutIsContestProblem = false;

function getTestCaseResults() {
    // Contest problems
    if (codeOutIsContestProblem) {
        return codeOutTestcases.map((_, index) => ({
            case: `Case ${index + 1}`,
            status: "READY",
            output: "Not available during contest"
        }));
    }

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

    watchTestResults();

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

        // Contest problem
        if (codeOutIsContestProblem) {
            if (hasExecutionError) {
                let status = "Runtime Error";

                if (hasCompileError) {
                    status = "Compile Error";
                } else if (hasTimeLimit) {
                    status = "Time Limit Exceeded";
                } else if (hasMemoryLimit) {
                    status = "Memory Limit Exceeded";
                }

                window.postMessage(
                    {
                        source: "CodeOut",
                        type: "LEETCODE_TEST_RESULTS",
                        results: codeOutTestcases.map(
                            (_, index) => ({
                                case: `Case ${index + 1}`,
                                status,
                                output:
                                    "Not available during contest"
                            })
                        )
                    },
                    "*"
                );

                observer.disconnect();
                return;
            }

            // Contest execution finished.
            // LeetCode doesn't provide correctness/output.
            //
            // Wait until the contest result area
            // actually appears before sending results.
            const contestMessage =
                bodyText.includes(
                    "Not available during contest"
                );

            if (!contestMessage) {
                return;
            }

            window.postMessage(
                {
                    source: "CodeOut",
                    type: "LEETCODE_TEST_RESULTS",
                    results: codeOutTestcases.map(
                        (_, index) => ({
                            case: `Case ${index + 1}`,
                            status: "READY",
                            output:
                                "Not available during contest"
                        })
                    )
                },
                "*"
            );

            observer.disconnect();
            return;
        }

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