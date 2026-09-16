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
        } else if (data.command === "runCode") {
            window.postMessage(
                {
                    source: "CodeOut",
                    type: "RUN_CODE"
                },
                "*"
            );
        } else if (data.command === "submit") {
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
    const questionName = url.pathname.split("/")[2];

    const data = await getProblem(questionName);
    const question = data.data.question;

    const examples = getExamples(question.content);

    const problem = {
        slug: question.titleSlug,
        questionFrontendId: question.questionFrontendId,
        title: question.title,
        difficulty: question.difficulty,
        testcases: examples.map((example) => ({
            input: example.input,
            expectedOutput: example.expectedOutput
        })),
        codeSnippets: question.codeSnippets
    };

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

        console.log("CodeOut problem sent:", response.status);
    } catch (error) {
        console.error(
            "Failed to contact CodeOut server:",
            error
        );
    }
});

window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "CodeOut") {
        return;
    }

    if (event.data.type === "LEETCODE_TEST_RESULTS") {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
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
    const doc = parser.parseFromString(content, "text/html");
    const examples = [];

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

    return examples;
}