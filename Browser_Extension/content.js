const script = document.createElement("script");

script.src = browser.runtime.getURL("page.js");
(document.head || document.documentElement).appendChild(script);
script.onload = () => {
    script.remove();
};


browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === "CODEOUT_START") {
        console.log("CodeOut started");

        
        // 1. Get current problem slug
        let url = new URL(window.location.href);
        let parts = url.pathname.split("/");
        let questionName = parts[2];
        
        console.log("Problem:", questionName);
        
        
        // 2. Get problem data from GraphQL
        let data = await getProblem(questionName);
        // 3. Get useful problem information
        let question = data.data.question;
        // console.log("FULL QUESTION DATA:", question);
        const examples = getExamples(question.content);
        console.log("Extracted examples:", examples);
        const finalTC = examples.map((example) => {
            return {
                input: example.input,
                expectedOutput: example.expectedOutput
            };
        });
        console.log(finalTC);
        const problem = {
            slug: question.titleSlug,
            title: question.title,
            difficulty: question.difficulty,
            testcases: finalTC,
            codeSnippets: question.codeSnippets
        };

        console.log("Sending problem to CodeOut server:", problem);

        try {
            const response = await fetch("http://localhost:3000/problem", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(problem)
            });

            console.log("Server status:", response.status);

            const responseText = await response.text();
            console.log("Server response:", responseText);

        } catch (error) {
            console.error("Failed to contact CodeOut server:", error);
        }
        
        console.log("Question ID:", question.questionFrontendId);
        console.log("Title:", question.title);
        console.log("Difficulty:", question.difficulty);
        console.log("Testcases:", question.exampleTestcases);
        console.log("Code snippets:", question.codeSnippets);
    }
});

window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (
        event.data?.source === "CodeOut" &&
        event.data?.type === "TEST"
    ) {
        console.log(
            "Received from page.js:",
            event.data.data
        );
    }
});


async function getProblem(titleSlug) {
    const response = await fetch("https://leetcode.com/graphql/", {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            operationName: "questionData",

            variables: {
                titleSlug
            },

            query: `query questionData($titleSlug: String!) {
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
            }`
        })
    });

    const data = await response.json();

    return data;
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