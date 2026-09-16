const script = document.createElement("script");

script.src = browser.runtime.getURL("page.js");

(document.head || document.documentElement).appendChild(script);

script.onload = () => {
    script.remove();
};

let socket;

function connectToServer() {
    socket = new WebSocket("ws://localhost:48721");

    socket.addEventListener("open", () => {
        socket.send(
            JSON.stringify({
                type: "register",
                client: "browser"
            })
        );
    });

    socket.addEventListener("message", async (event) => {
        const data = JSON.parse(event.data);

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

    socket.addEventListener("error", (error) => {
        console.error("CodeOut WebSocket error:", error);
    });

    socket.addEventListener("close", () => {
        setTimeout(connectToServer, 2000);
    });
}

connectToServer();

browser.runtime.onMessage.addListener(async (message) => {
    if (message.type !== "CODEOUT_START") {
        return;
    }

    const url = new URL(window.location.href);

    const match = url.pathname.match(
        /\/(?:problems|problem)\/([^/]+)/
    );

    if (!match) {
        console.error("CodeOut: Could not find problem slug");
        return;
    }

    const questionName = match[1];

    const isContestProblem =
        url.pathname.includes("/contest/");

    const data = await getProblem(questionName);

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

    // Tell page.js whether this is a contest problem
    window.postMessage(
        {
            source: "CodeOut",
            type: "SET_TESTCASES",
            testcases: finalTC,
            isContestProblem
        },
        "*"
    );

    try {
        const response = await fetch(
            "http://localhost:48721/problem",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(problem)
            }
        );

        console.log(
            "CodeOut problem sent:",
            response.status
        );
    } catch (error) {
        console.error(
            "Failed to contact CodeOut server:",
            error
        );
    }
});

window.addEventListener("message", (event) => {
    if (
        event.source !== window ||
        event.data?.source !== "CodeOut"
    ) {
        return;
    }

    if (event.data.type === "LEETCODE_TEST_RESULTS") {
        if (
            !socket ||
            socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        socket.send(
            JSON.stringify({
                command: "testResults",
                results: event.data.results
            })
        );
    }
});

async function getProblem(titleSlug) {
    const response = await fetch(
        "https://leetcode.com/graphql/",
        {
            method: "POST",
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
        }
    );

    return response.json();
}

function getExamples(content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
        content,
        "text/html"
    );

    const examples = [];

    // Normal LeetCode <pre> examples
    const preTags = doc.querySelectorAll("pre");

    for (const pre of preTags) {
        const text = pre.textContent.trim();

        const inputMatch = text.match(
            /Input:\s*([\s\S]*?)(?=\s*Output:)/
        );

        const outputMatch = text.match(
            /Output:\s*([\s\S]*?)(?=\s*Explanation:|$)/
        );

        if (inputMatch && outputMatch) {
            examples.push({
                input: inputMatch[1].trim(),
                expectedOutput: outputMatch[1].trim()
            });
        }
    }

    if (examples.length > 0) {
        return examples;
    }

    // Contest-style examples
    const text = doc.body.innerText
        .replace(/\u00a0/g, " ")
        .replace(/\r/g, "");

    const exampleBlocks = text.split(
        /Example\s+\d+\s*:/i
    );

    for (const block of exampleBlocks.slice(1)) {
        const inputMatch = block.match(
            /Input:\s*([\s\S]*?)(?=\n\s*Output:)/
        );

        const outputMatch = block.match(
            /Output:\s*([\s\S]*?)(?=\n\s*Explanation:|$)/
        );

        if (!inputMatch || !outputMatch) {
            continue;
        }

        examples.push({
            input: inputMatch[1].trim(),
            expectedOutput: outputMatch[1].trim()
        });
    }

    return examples;
}