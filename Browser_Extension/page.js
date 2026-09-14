console.log("CodeOut page.js is running");

window.postMessage(
    {
        source: "CodeOut",
        type: "TEST",
        data: "Hello from page.js"
    },
    "*"
);

function getTestCaseResults() {

    const cases = Array.from(document.querySelectorAll("div"))
        .filter(el => /^Case \d+$/.test(el.textContent.trim()));

    const resultMap = new Map();

    for (const caseText of cases) {

        const caseNumber = caseText.textContent.trim();

        const container = caseText.closest(".cursor-pointer");

        if (!container) {
            continue;
        }

        let status = null;

        if (container.querySelector(".fa-square-check")) {
            status = "Accepted";
        }
        else if (container.querySelector(".fa-square-xmark")) {
            status = "Wrong Answer";
        }

        if (status) {
            resultMap.set(caseNumber, {
                case: caseNumber,
                status: status
            });
        }
    }

    // ------------------------------------
    // Get actual output
    // ------------------------------------

    const editors = Array.from(
        document.querySelectorAll(".cm-editor")
    );

    let outputs = [];

    if (editors.length >= 2) {

        const outputEditor = editors[1];

        outputs = Array.from(
            outputEditor.querySelectorAll(".cm-line")
        )
            .map(line => line.textContent.trim());
    }

    // ------------------------------------
    // Combine results + outputs
    // ------------------------------------

    const results = Array.from(resultMap.values())
        .sort((a, b) => {

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

    if (event.source !== window) return;

    if (
        event.data?.source === "CodeOut" &&
        event.data?.type === "SET_CODE"
    ) {
        const { code } = event.data;
        const editors = monaco.editor.getEditors();
        if (!editors.length) {
            console.log("❌ No Monaco editors found");
            return;
        }

        const editor = editors[0];

        editor.setValue(code);
    }

    if (
        event.data?.source === "CodeOut" &&
        event.data?.type === "RUN_CODE"
    ) {
        runLeetCode();
    }
    if (
        event.data?.source === "CodeOut" &&
        event.data?.type === "SUBMIT_CODE"
    ) {
        submitLeetCode();
    }
});


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

        const results = getTestCaseResults();

        if (results.length === 0) {
            return;
        }

        // We only send when every testcase has finished.
        if (results.some(result =>
            result.status !== "Accepted" &&
            result.status !== "Wrong Answer"
        )) {
            return;
        }

        window.postMessage({
            source: "CodeOut",
            type: "LEETCODE_TEST_RESULTS",
            results: results
        }, "*");

        observer.disconnect();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
    });
}