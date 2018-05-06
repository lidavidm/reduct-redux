export const IS_PHONE = window.matchMedia("only screen and (max-device-width: 812px) and (-webkit-min-device-pixel-ratio: 1.5)").matches;
export const IS_TABLET = window.matchMedia("only screen and (max-device-width: 1366px) and (-webkit-min-device-pixel-ratio: 1.5)").matches;

export const IS_MOBILE = IS_PHONE || IS_TABLET;
