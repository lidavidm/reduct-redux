export function getJSON(path) {
    return new Promise((resolve, reject) => {
        const xhr = new window.XMLHttpRequest();
        xhr.onload = function() {
            try {
                resolve(JSON.parse(xhr.response));
            }
            catch (e) {
                console.error(path, e);
                reject(e);
            }
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

const PREFIXES = ["jpa", "jpb", "jpc", "jpd"];
let prefixCounter = 0;

export function jsonp(path, params) {
    params = params || {};
    return new Promise((resolve, reject) => {
        // Guard against multiple requests made at same millisecond
        const callback = `${PREFIXES[prefixCounter]}${Date.now()}`;
        prefixCounter = (prefixCounter + 1) % (PREFIXES.length);
        let completed = false;
        window[callback] = (data) => {
            completed = true;
            delete window[callback];
            scr.remove();
            resolve(data);
        };

        // Encode params in query string
        const parts = [];
        params.callback = callback;
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
