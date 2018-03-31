export function getJSON(path) {
    return new Promise((resolve, reject) => {
        const xhr = new window.XMLHttpRequest();
        xhr.onload = function() {
            resolve(JSON.parse(xhr.response));
        };

        xhr.open("GET", path);
        xhr.responseType = "text";
        xhr.send();
    });
}

export function postJSON(path, data) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data, null, 2));
}

export function jsonp(path, params) {
    params = params || {};
    return new Promise((resolve, reject) => {
        const callback = `jpc${Date.now()}`;
        let completed = false;
        window[callback] = (data) => {
            completed = true;
            delete window[callback];
            scr.remove();
            resolve(JSON.parse(data));
        };

        // Encode params in query string
        const parts = [];
        params.jsonp = callback;
        // Cachebuster
        params._ = Date.now();
        for (const [ key, val ] of Object.entries(params)) {
            parts.push(`${key}=${window.encodeURIComponent(val)}`);
        }
        const query = `?${parts.join("&")}`;

        const scr = document.createElement("script");
        scr.setAttribute("src", path + query);

        // Set timeout first in case appendChild causes a net::ERR_ABORTED
        window.setTimeout(() => {
            if (completed) return;

            delete window[callback];
            scr.remove();
            reject();
        }, 1000);

        document.body.appendChild(scr);
    });
}
