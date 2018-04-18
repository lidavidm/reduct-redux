import { DEVELOPMENT_BUILD } from "../../logging/logging";

/**
 * Display a dialog prompt and resolve when successful (reject if
 * canceled).
 */
export default function password(promptText, password) {
    return new Promise((resolve, reject) => {
        if (DEVELOPMENT_BUILD) {
            resolve();
            return;
        }

        const outerContainer = document.createElement("div");
        outerContainer.classList.add("fade-container");

        const modal = document.createElement("div");
        outerContainer.appendChild(modal);

        const container = document.createElement("div");
        container.classList.add("password-prompt");
        modal.appendChild(container);

        const prompt = document.createElement("p");
        container.appendChild(prompt);
        prompt.innerText = promptText;

        const message = document.createElement("p");
        message.style.color = "#F00";
        container.appendChild(message);

        const form = document.createElement("form");
        container.appendChild(form);

        const input = document.createElement("input");
        form.appendChild(input);
        input.setAttribute("type", "password");
        input.setAttribute("autocomplete", "password");
        const submit = document.createElement("button");
        form.appendChild(submit);
        submit.innerText = "Submit";
        const cancel = document.createElement("button");
        form.appendChild(cancel);
        cancel.setAttribute("type", "button");
        cancel.innerText = "Never Mind!";

        const next = (then) => (ev) => {
            ev.preventDefault();
            outerContainer.classList.remove("visible");
            outerContainer.addEventListener("transitionend", () => {
                outerContainer.remove();
                then();
            });
        };

        form.addEventListener("submit", (ev) => {
            ev.preventDefault();
            if (input.value === password) {
                next(resolve)(ev);
            }
            else {
                message.innerText = "Wrong password!";
            }
        });
        cancel.addEventListener("click", next(reject));

        document.body.appendChild(outerContainer);

        window.setTimeout(function() {
            outerContainer.classList.add("visible");
        }, 500);
    });
}
