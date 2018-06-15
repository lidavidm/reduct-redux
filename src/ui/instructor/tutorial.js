/**
 * Display a dialog prompt and resolve when successful (never reject).
 */
export default function tutorial(url) {
    return new Promise((resolve) => {
        const outerContainer = document.querySelector("#tutorial");

        const link = outerContainer.querySelector("a");
        const continueButton = outerContainer.querySelector("button");

        continueButton.style.display = "none";
        link.style.display = "inline";
        link.setAttribute("href", url);
        link.onclick = () => {
            link.style.display = "none";
            continueButton.style.display = "inline";
        };
        continueButton.onclick = () => {
            outerContainer.classList.remove("visible");
        };

        window.setTimeout(function() {
            outerContainer.classList.add("visible");
        }, 200);
    });
}
