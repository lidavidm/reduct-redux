import * as immutable from "immutable";

export const ToolboxMeta = immutable.Record({
    unlimited: false,
});

export const Meta = immutable.Record({
    toolbox: new ToolboxMeta(),
});
