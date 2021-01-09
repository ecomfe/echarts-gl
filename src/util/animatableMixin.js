import Animator from 'zrender/lib/animation/Animator';

var animatableMixin = {

    _animators: null,

    getAnimators: function () {
        this._animators = this._animators || [];

        return this._animators;
    },

    animate: function (path, opts) {
        this._animators = this._animators || [];

        var el = this;

        var target;

        if (path) {
            var pathSplitted = path.split('.');
            var prop = el;
            for (var i = 0, l = pathSplitted.length; i < l; i++) {
                if (!prop) {
                    continue;
                }
                prop = prop[pathSplitted[i]];
            }
            if (prop) {
                target = prop;
            }
        }
        else {
            target = el;
        }
        if (target == null) {
            throw new Error('Target ' + path + ' not exists');
        }

        var animators = this._animators;

        var animator = new Animator(target, opts);
        var self = this;
        animator.during(function () {
            if (self.__zr) {
                self.__zr.refresh();
            }
        }).done(function () {
            var idx = animators.indexOf(animator);
            if (idx >= 0) {
                animators.splice(idx, 1);
            }
        });
        animators.push(animator);

        if (this.__zr) {
            this.__zr.animation.addAnimator(animator);
        }

        return animator;
    },

    stopAnimation: function (forwardToLast) {
        this._animators = this._animators || [];

        var animators = this._animators;
        var len = animators.length;
        for (var i = 0; i < len; i++) {
            animators[i].stop(forwardToLast);
        }
        animators.length = 0;

        return this;
    },

    addAnimatorsToZr: function (zr) {
        if (this._animators) {
            for (var i = 0; i < this._animators.length; i++) {
                zr.animation.addAnimator(this._animators[i]);
            }
        }
    },

    removeAnimatorsFromZr: function (zr) {
        if (this._animators) {
            for (var i = 0; i < this._animators.length; i++) {
                zr.animation.removeAnimator(this._animators[i]);
            }
        }
    }
};

export default animatableMixin;