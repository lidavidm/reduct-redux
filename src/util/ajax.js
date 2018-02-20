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
