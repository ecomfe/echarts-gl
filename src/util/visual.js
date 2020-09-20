export function getVisualColor(data) {
    const style = data.getVisual('style');
    if (style) {
        const drawType = data.getVisual('drawType');
        return style[drawType];
    }
}
export function getVisualOpacity(data) {
    const style = data.getVisual('style');
    return style.opacity;
}
export function getItemVisualColor(data, idx) {
    const style = data.getItemVisual(idx, 'style');
    if (style) {
        const drawType = data.getVisual('drawType');
        return style[drawType];
    }
}
export function getItemVisualOpacity(data, idx) {
    const style = data.getItemVisual(idx, 'style');
    return style && style.opacity;
}