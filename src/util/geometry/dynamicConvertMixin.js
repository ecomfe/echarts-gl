export default {
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
        if (clear || !this.indices) {
            this.indices = [];
        }
        else {
            this.indices = Array.prototype.slice.call(this.indices);
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
        if (this.indices && this.indices.length > 0) {
            this.indices = this.vertexCount > 0xffff ? new Uint32Array(this.indices) : new Uint16Array(this.indices);
        }

        this.dirty();
    }
};