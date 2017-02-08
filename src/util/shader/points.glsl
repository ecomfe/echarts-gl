@export ecgl.points.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform float elapsedTime : 0;

attribute vec3 position : POSITION;
#ifdef VERTEX_COLOR
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;
#endif
attribute float size;

#ifdef ANIMATING
attribute float delay;
#endif

void main()
{
    gl_Position = worldViewProjection * vec4(position, 1.0);

#ifdef ANIMATING
    gl_PointSize = size * (sin((elapsedTime + delay) * 3.14) * 0.5 + 1.0);
#else
    gl_PointSize = size;
#endif

#ifdef VERTEX_COLOR
    v_Color = a_Color;
#endif
}

@end

@export ecgl.points.fragment

uniform vec4 color: [1, 1, 1, 1];
#ifdef VERTEX_COLOR
varying vec4 v_Color;
#endif

uniform sampler2D sprite;

void main()
{
    gl_FragColor = color;

#ifdef VERTEX_COLOR
    gl_FragColor *= v_Color;
#endif

#ifdef SPRITE_ENABLED
    gl_FragColor *= texture2D(sprite, gl_PointCoord);
#endif

    if (gl_FragColor.a == 0.0) {
        discard;
    }
}
@end