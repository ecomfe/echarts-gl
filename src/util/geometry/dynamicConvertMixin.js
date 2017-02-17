module.exports = {
    convertToDynamicArray: function (clear) {
        if (clear) {
            this.resetOffset();
        }
        var attributes = this.attributes;
        for (var name in attributes) {
            if (clear || !attributes[name].value) {
                attributes[name].value = [];
            }
            else {
                attributes[name].value = Array.prototype.slice.call(attributes[name].value);
            }
        }
        if (clear || !this.faces) {
            this.faces = [];
        }
        else {
            this.faces = Array.prototype.slice.call(this.faces);
        }
    },

    convertToTypedArray: function () {
        var attributes = this.attributes;
        for (var name in attributes) {
            if (attributes[name].value && attributes[name].value.length > 0) {
                attributes[name].value = new Float32Array(attributes[name].value);
            }
            else {
                attributes[name].value = null;
            }
        }
        if (this.faces && this.faces.length > 0) {
            this.faces = this.vertexCount > 0xffff ? new Uint32Array(this.faces) : new Uint16Array(this.faces);
        }
    }
};