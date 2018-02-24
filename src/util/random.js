/** Random integer in the range [min, max). */
export function getRandInt(min, max) {
    // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#Getting_a_random_integer_between_two_values
    return Math.floor(Math.random() * (max - min)) + min;
}

export function getRandString(length) {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += alphabet[getRandInt(0, alphabet.length)];
    }
    return result;
}
