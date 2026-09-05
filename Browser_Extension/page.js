console.log("CodeOut page.js is running");

window.postMessage(
    {
        source: "CodeOut",
        type: "TEST",
        data: "Hello from page.js"
    },
    "*"
);