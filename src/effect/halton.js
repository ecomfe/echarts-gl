
// Generate halton sequence
// https://en.wikipedia.org/wiki/Halton_sequence
function halton(index, base) {

    var result = 0;
    var f = 1 / base;
    var i = index;
    while (i > 0) {
        result = result + f * (i % base);
        i = Math.floor(i / base);
        f = f / base;
    }
    return result;
}


export default halton;