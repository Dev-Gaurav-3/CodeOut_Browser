function getTestCaseResults() {
    const cases = Array.from(document.querySelectorAll("div"))
        .filter((el) => /^Case \d+$/.test(el.textContent.trim()));

    const resultMap = new Map();

    for (const caseText of cases) {
        const caseNumber = caseText.textContent.trim();
        const container = caseText.closest(".cursor-pointer");

        if (!container) {
            continue;
        }

        const text = container.textContent.trim();

        let status = null;

        if (container.querySelector(".fa-square-check")) {
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

    const results = Array.from(resultMap.values()).sort((a, b) => {
        const numA = Number(a.case.match(/\d+/)[0]);
        const numB = Number(b.case.match(/\d+/)[0]);

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

    if (type === "SET_CODE") {
        setLeetCodeCode(event.data.code);
    } else if (type === "RUN_CODE") {
        runLeetCode();
    } else if (type === "SUBMIT_CODE") {
        submitLeetCode();
    }
});

function setLeetCodeCode(code) {
    const editors = monaco.editor.getEditors();

    if (!editors.length) {
        console.log("❌ No Monaco editors found");
        return;
    }

    editors[0].setValue(code);
}

function runLeetCode() {
    const runButton = document.querySelector(
        'button[data-e2e-locator="console-run-button"]'
    );

    if (!runButton) {
        console.log("❌ LeetCode Run button not found");
        return;
    }

    watchTestResults();
    runButton.click();
}

function submitLeetCode() {
    const submitButton = document.querySelector(
        'button[data-e2e-locator="console-submit-button"]'
    );

    if (!submitButton) {
        console.log("❌ LeetCode Submit button not found");
        return;
    }

    submitButton.click();
}

function watchTestResults() {
    const observer = new MutationObserver(() => {
        const bodyText = document.body.innerText;

        const hasExecutionError =
            bodyText.includes("Compile Error") ||
            bodyText.includes("Time Limit Exceeded") ||
            bodyText.includes("Memory Limit Exceeded") ||
            bodyText.includes("Runtime Error");

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
                    if (result.status !== "Accepted") {
                        result.status = "Wrong Answer";
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