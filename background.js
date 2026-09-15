browser.action.onClicked.addListener((tab) => {
    console.log("CodeOut clicked");

    browser.tabs.sendMessage(tab.id, {
        type: "CODEOUT_START"
    });
});