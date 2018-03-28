export default function consent() {
    console.log("Showing consent form");
    return new Promise((resolve) => {
        window.addEventListener("DOMContentLoaded", () => {
            document.querySelector("#consent")
                .classList.add("visible");
            document.querySelector("#consent-agree")
                .addEventListener("click", () => {
                    document.querySelector("#consent")
                        .classList.remove("visible");
                    resolve(true);
                });
            document.querySelector("#consent-disagree")
                .addEventListener("click", () => {
                    document.querySelector("#consent")
                        .classList.remove("visible");
                    resolve(false);
                });
        });
    });
}
